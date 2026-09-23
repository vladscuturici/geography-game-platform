// populationmatch.component.ts
import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, inject, NgZone, OnInit } from '@angular/core';
import { AfterViewInit, ElementRef, ViewChildren, QueryList } from '@angular/core';
import { shareReplay } from 'rxjs';
import { CountriesService } from '../services/countries.service';
import { GameService } from '../services/game.service';
import { Country } from '../models/countries.model';
import { RouterModule } from '@angular/router';

interface StatDefinition {
  id: string;
  label: string;
  unit: string;
  extractValue: (country: Country) => number;
  formatValue: (value: number) => string;
}

const POPULATION_STAT: StatDefinition = {
  id: 'population',
  label: 'population',
  unit: 'people',
  extractValue: c => c.population,
  formatValue: v => {
    const abs = Math.abs(v);
    if (abs >= 1_000_000_000) {
      return (v / 1_000_000_000).toFixed(1) + 'B';
    }
    if (abs >= 1_000_000) {
      return Math.round(v / 1_000_000) + 'M';
    }
    if (abs >= 1_000) {
      return Math.round(v / 1_000) + 'K';
    }
    if (abs >= 100) {
      return (v / 1_000).toFixed(1) + 'K';
    }
    return Math.round(v).toString();
  },
};

const TOTAL_POOL_SIZE = 21;
const TARGET_RATIO_LOW = 0.2;
const TARGET_RATIO_HIGH = 0.8;
const DEAL_ANIM_MS = 380;

/**
 * Same tiering approach as Country21: draw a balanced spread of small/mid/large
 * countries instead of pure random sampling. Counts should sum to TOTAL_POOL_SIZE.
 */
const POOL_TIERS: { max: number; count: number }[] = [
  { max: 9_000_000, count: 6 },
  { max: 50_000_000, count: 9 },
  { max: Infinity, count: 6 },
];

interface Slot {
  country: Country;
  tierIndex: number;
}

type RoundPhase = 'selecting' | 'locked';

@Component({
  selector: 'app-populationmatch',
  imports: [CommonModule, RouterModule],
  templateUrl: './populationmatch.component.html',
  styleUrl: './populationmatch.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PopulationmatchComponent implements OnInit {
  private _countriesService = inject(CountriesService);
  private _gameService = inject(GameService);
  private _cdr = inject(ChangeDetectorRef);
  private _zone = inject(NgZone);


  public countries$ = this._countriesService.getAllCountries().pipe(shareReplay(1));

  private _allCountries: Country[] = [];
  private _tierBuckets: Country[][] = [];
  public stat: StatDefinition = POPULATION_STAT;

  public isLoading = true;

  public board: Slot[] = [];
  public selected = new Set<number>();
  public dealingIndices = new Set<number>();

  public target = 0;
  public phase: RoundPhase = 'selecting';
  public lastScore: number | null = null;

  private _roundNumber = 0;
  public gameHistory: { roundNumber: number; score: number }[] = [];

  private _loadedFlags = new Set<string>();

  ngOnInit(): void {
    this.countries$.subscribe(countries => {
      this._allCountries = countries.filter(
        c => typeof this.stat.extractValue(c) === 'number' && this.stat.extractValue(c) > 0
      );
      this._tierBuckets = this._buildTierBuckets(this._allCountries);
      this.isLoading = false;
      this._startNewRound();
      this._cdr.markForCheck();
    });
  }

  private _shuffle<T>(arr: T[]): T[] {
    return [...arr].sort(() => Math.random() - 0.5);
  }

  private _buildTierBuckets(countries: Country[]): Country[][] {
    const buckets: Country[][] = POOL_TIERS.map(() => []);
    for (const country of countries) {
      const value = this.stat.extractValue(country);
      const tierIndex = POOL_TIERS.findIndex(t => value < t.max);
      const idx = tierIndex === -1 ? POOL_TIERS.length - 1 : tierIndex;
      buckets[idx].push(country);
    }
    return buckets;
  }

  private _pickInitialBoard(): Slot[] {
    const slots: Slot[] = [];
    const usedNames = new Set<string>();
    let shortfall = 0;

    POOL_TIERS.forEach((tier, tierIndex) => {
      const shuffled = this._shuffle(this._tierBuckets[tierIndex]);
      const take = shuffled.slice(0, tier.count);
      take.forEach(c => usedNames.add(c.name));
      take.forEach(country => slots.push({ country, tierIndex }));
      if (take.length < tier.count) {
        shortfall += tier.count - take.length;
      }
    });

    if (shortfall > 0) {
      const remaining = this._shuffle(this._allCountries.filter(c => !usedNames.has(c.name)));
      const backfill = remaining.slice(0, shortfall);
      backfill.forEach(country => slots.push({ country, tierIndex: POOL_TIERS.length - 1 }));
    }

    return this._shuffle(slots).slice(0, TOTAL_POOL_SIZE);
  }

  /** Draws one replacement for `tierIndex`, avoiding names in `exclude` where possible. */
  private _pickReplacement(tierIndex: number, exclude: Set<string>): Country {
    const bucket = this._tierBuckets[tierIndex];
    const candidates = bucket.filter(c => !exclude.has(c.name));
    const pool = candidates.length > 0 ? candidates : bucket; // defensive fallback for tiny tiers
    return pool[Math.floor(Math.random() * pool.length)];
  }

  private _sumOf(slots: Slot[]): number {
    return slots.reduce((total, s) => total + this.stat.extractValue(s.country), 0);
  }

  private _sumOfSmallestPair(slots: Slot[]): number {
    const values = slots.map(s => this.stat.extractValue(s.country)).sort((a, b) => a - b);
    if (values.length < 2) return values[0] ?? 0;
    return values[0] + values[1];
  }

  private _roundToDisplayedPrecision(v: number): number {
    const abs = Math.abs(v);
    if (abs >= 1_000_000_000) {
      return Math.round(v / 100_000_000) * 100_000_000;
    }
    if (abs >= 1_000_000) {
      return Math.round(v / 1_000_000) * 1_000_000;
    }
    if (abs >= 1_000) {
      return Math.round(v / 1_000) * 1_000;
    }
    if (abs >= 100) {
      return Math.round(v / 100) * 100;
    }
    return Math.round(v);
  }

  private _rollTarget(slots: Slot[]): number {
    const sumAll = this._sumOf(slots);
    const floorBound = this._sumOfSmallestPair(slots);

    let low = Math.max(floorBound, TARGET_RATIO_LOW * sumAll);
    let high = TARGET_RATIO_HIGH * sumAll;

    if (low > high) {
      low = floorBound;
      high = sumAll;
    }

    return this._roundToDisplayedPrecision(low + Math.random() * (high - low));
  }

  private _startNewRound(): void {
    this._roundNumber++;
    this.board = this._pickInitialBoard();
    this.selected = new Set<number>();
    this.dealingIndices = new Set<number>();
    this.phase = 'selecting';
    this.lastScore = null;
    this.target = this._rollTarget(this.board);
  }

  private _pendingToggle = false;

  private _lastToggleAt = 0;
  private readonly _toggleCooldownMs = 60; // real wall-clock throttle, not rAF/zone-based

public toggleSelect(index: number): void {
  this._zone.runOutsideAngular(() => {
    if (this.phase !== 'selecting') return;

    const now = performance.now();
    if (now - this._lastToggleAt < this._toggleCooldownMs) return;
    this._lastToggleAt = now;

    if (this.selected.has(index)) {
      this.selected.delete(index);
    } else {
      this.selected.add(index);
    }

    this._zone.run(() => this._cdr.markForCheck());
  });
}

  public isSelected(index: number): boolean {
    return this.selected.has(index);
  }

  public get currentSum(): number {
    let sum = 0;
    this.selected.forEach(i => {
      sum += this.stat.extractValue(this.board[i].country);
    });
    return sum;
  }

  public get resultFillPercent(): number {
      if (this.lastScore === null) return 0;
      return Math.min(Math.max(this.lastScore, 0), 100);
  }

  public get sumProgressRatio(): number {
    if (this.target <= 0) return 0;
    return Math.min(this.currentSum / this.target, 1.15);
  }

  public onLockIn(): void {
    if (this.phase !== 'selecting' || this.selected.size === 0) return;

    const outcome = this._gameService.scorePopulationMatch(this.currentSum, this.target);
    this.phase = 'locked';
    this.lastScore = outcome.score;

    this.gameHistory = [
      ...this.gameHistory,
      { roundNumber: this._roundNumber, score: this.lastScore },
    ];
  }

  public onNextRound(): void {
    if (this.phase !== 'locked') return;

    const exclude = new Set<string>();
    this.board.forEach(s => exclude.add(s.country.name));
    this.selected.forEach(i => exclude.add(this.board[i].country.name));

    const newBoard = [...this.board];
    const newlyDealt = new Set<number>();

    this.selected.forEach(i => {
      const tierIndex = this.board[i].tierIndex;
      const replacement = this._pickReplacement(tierIndex, exclude);
      exclude.add(replacement.name); // <-- add this line
      newBoard[i] = { country: replacement, tierIndex };
      newlyDealt.add(i);
    });

    this._roundNumber++;
    this.board = newBoard;
    this.selected = new Set<number>();
    this.phase = 'selecting';
    this.lastScore = null;
    this.target = this._rollTarget(this.board);

    this.dealingIndices = newlyDealt;
    setTimeout(() => {
      this.dealingIndices = new Set<number>();
      this._cdr.markForCheck();
    }, DEAL_ANIM_MS);
  }

  public toGreenSaturation(score: number): string {
    const ratio = Math.min(Math.max(score / 100, 0), 1);
    const lightness = 100 - ratio * 60;
    return `hsl(120, 70%, ${lightness}%)`;
  }

  public formatStat(value: number): string {
    return this.stat.formatValue(value);
  }

  public onFlagLoad(name: string): void {
    this._loadedFlags.add(name);
  }

  public isFlagLoaded(name: string): boolean {
    return this._loadedFlags.has(name);
  }
}