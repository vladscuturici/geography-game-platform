// country21.component.ts
import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, inject, OnInit } from '@angular/core';
import { shareReplay } from 'rxjs';
import { CountriesService } from '../services/countries.service';
import { GameService } from '../services/game.service';
import { Country } from '../models/countries.model';

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

const TOTAL_POOL_SIZE = 14;
const HAND_SIZE = 3;
const OFFER_SIZE = TOTAL_POOL_SIZE - HAND_SIZE; // 11
const THRESHOLD_MARGIN_RATIO = 0.1;
const MAX_ROLL_ATTEMPTS = 25;
const DEAL_ANIM_MS = 380;

/**
 * Size tiers used to build a balanced pool instead of pure random sampling.
 * `max` is the exclusive upper bound for the tier (Infinity for the top tier).
 * `count` is how many countries to draw from that tier per round.
 * Counts should sum to TOTAL_POOL_SIZE (14 here: 4 + 6 + 4).
 */
const POOL_TIERS: { max: number; count: number }[] = [
  { max: 9_000_000, count: 4 },
  { max: 50_000_000, count: 6 },
  { max: Infinity, count: 4 },
];

type RoundPhase = 'playing' | 'locked' | 'busted';

@Component({
  selector: 'app-country21',
  imports: [CommonModule],
  templateUrl: './country21.component.html',
  styleUrl: './country21.component.css',
})
export class Country21Component implements OnInit {
  private _countriesService = inject(CountriesService);
  private _gameService = inject(GameService);
  private _cdr = inject(ChangeDetectorRef);

  public countries$ = this._countriesService.getAllCountries().pipe(shareReplay(1));

  private _allCountries: Country[] = [];
  public stat: StatDefinition = POPULATION_STAT;

  public isLoading = true;

  public hand: Country[] = [];
  private _offerPool: Country[] = [];
  public offerIndex = 0;
  public currentOffer: Country | null = null;

  public threshold = 0;
  public currentSum = 0;

  public phase: RoundPhase = 'playing';
  public isFlashing = false;
  public isDealing = false;
  public lastScore: number | null = null;

  public justTakenName: string | null = null;

  private _gameNumber = 0;

  public roundHistory: { country: string; value: number }[] = [];
  public gameHistory: { gameNumber: number; score: number; busted: boolean }[] = [];

  /** Tracks which flag images have finished loading, to avoid a flash of stale artwork. */
  private _loadedFlags = new Set<string>();

  ngOnInit(): void {
    this.countries$.subscribe(countries => {
      this._allCountries = countries.filter(
        c => typeof this.stat.extractValue(c) === 'number' && this.stat.extractValue(c) > 0
      );
      this.isLoading = false;
      this._startNewRound();
      this._cdr.markForCheck();
    });
  }

  private _shuffle(arr: Country[]): Country[] {
    return [...arr].sort(() => Math.random() - 0.5);
  }

  private _pickRandomPool(size: number): Country[] {
    // Bucket the full country list by tier, using the active stat.
    const buckets: Country[][] = POOL_TIERS.map(() => []);
    let lastMax = -Infinity;
    for (const country of this._allCountries) {
      const value = this.stat.extractValue(country);
      const tierIndex = POOL_TIERS.findIndex(t => value < t.max);
      const idx = tierIndex === -1 ? POOL_TIERS.length - 1 : tierIndex;
      buckets[idx].push(country);
    }

    const picked: Country[] = [];
    const usedNames = new Set<string>();
    let shortfall = 0;

    // First pass: draw each tier's quota (shuffled within the tier).
    POOL_TIERS.forEach((tier, i) => {
      const shuffled = this._shuffle(buckets[i]);
      const take = shuffled.slice(0, tier.count);
      take.forEach(c => usedNames.add(c.name));
      picked.push(...take);
      if (take.length < tier.count) {
        shortfall += tier.count - take.length;
      }
    });

    // Second pass: if any tier came up short (not enough countries in that
    // bucket), backfill from the remaining unused pool so we still hit `size`.
    if (shortfall > 0) {
      const remaining = this._shuffle(
        this._allCountries.filter(c => !usedNames.has(c.name))
      );
      const backfill = remaining.slice(0, shortfall);
      picked.push(...backfill);
    }

    // Trim/pad defensively to the requested size, then shuffle the combined
    // pool so tier order doesn't leak into hand vs. offer split.
    return this._shuffle(picked).slice(0, size);
  }

  private _sumOf(countries: Country[]): number {
    return countries.reduce((total, c) => total + this.stat.extractValue(c), 0);
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

  private _startNewRound(): void {
    this._gameNumber++;
    this.phase = 'playing';
    this.isFlashing = false;
    this.isDealing = false;
    this.lastScore = null;
    this.roundHistory = [];

    let pool: Country[] = [];
    let hand: Country[] = [];
    let offerPool: Country[] = [];
    let sum3 = 0;
    let sum21 = 0;
    let low = 0;
    let high = 0;
    let attempts = 0;

    do {
      pool = this._pickRandomPool(Math.min(TOTAL_POOL_SIZE, this._allCountries.length));
      hand = pool.slice(0, HAND_SIZE);
      offerPool = pool.slice(HAND_SIZE);
      sum3 = this._sumOf(hand);
      sum21 = this._sumOf(pool);
      const margin = THRESHOLD_MARGIN_RATIO * sum21;
      low = sum3 + margin;
      high = sum21 - margin;
      attempts++;
    } while (low > high && attempts < MAX_ROLL_ATTEMPTS);

    if (low > high) {
      low = sum3;
      high = sum21;
    }

    this.hand = hand;
    this._offerPool = offerPool;
    this.offerIndex = 0;
    this.currentOffer = this._offerPool[0] ?? null;

    this.threshold = this._roundToDisplayedPrecision(low + Math.random() * (high - low));
    this.currentSum = sum3;

    this.roundHistory = hand.map(c => ({ country: c.name, value: this.stat.extractValue(c) }));
  }

  public restart(): void {
    this._startNewRound();
  }

  public get cardsRemaining(): number {
    return this._offerPool.length - this.offerIndex;
  }

  public get offerPosition(): { current: number; total: number } {
    return { current: Math.min(this.offerIndex + 1, this._offerPool.length), total: this._offerPool.length };
  }

  public get resultFillPercent(): number {
    if (this.threshold <= 0) return 0;
    const ratio = this.currentSum / this.threshold;
    return Math.min(Math.max(ratio, 0), 1) * 100;
  }

  public onTake(): void {
    if (this.phase !== 'playing' || !this.currentOffer || this.isFlashing) return;

    const taken = this.currentOffer;
    const takenValue = this.stat.extractValue(taken);
    this.currentSum += takenValue;
    this.hand = [...this.hand, taken];
    this.roundHistory = [...this.roundHistory, { country: taken.name, value: takenValue }];

    this.isFlashing = true;
    this.justTakenName = taken.name;

    const willBust = this.currentSum > this.threshold;

    setTimeout(() => {
      this.isFlashing = false;
      if (willBust) {
        this._endRound(true);
      } else {
        this.offerIndex++;
        this.currentOffer = this._offerPool[this.offerIndex] ?? null;
        if (!this.currentOffer) {
          this._endRound(false);
        } else {
          this.isDealing = true;
          setTimeout(() => {
            this.isDealing = false;
            this._cdr.markForCheck();
          }, DEAL_ANIM_MS);
        }
      }
      this._cdr.markForCheck();
    }, 450);

    setTimeout(() => {
      this.justTakenName = null;
      this._cdr.markForCheck();
    }, 950); // 450ms take delay + 500ms flip animation
  }

  public onLockIn(): void {
    if (this.phase !== 'playing' || this.isFlashing) return;
    this._endRound(false);
  }

  private _endRound(busted: boolean): void {
    this.currentOffer = null;

    if (busted) {
      this.phase = 'busted';
      this.lastScore = 0;
    } else {
      const outcome = this._gameService.scoreRound(this.currentSum, this.threshold);
      this.phase = 'locked';
      this.lastScore = outcome.score;
    }

    this.gameHistory = [
      ...this.gameHistory,
      { gameNumber: this._gameNumber, score: this.lastScore ?? 0, busted },
    ];
  }

  public toGreenSaturation(score: number): string {
    const ratio = Math.min(Math.max(score / 100, 0), 1);
    const lightness = 100 - ratio * 60;
    return `hsl(120, 70%, ${lightness}%)`;
  }

  public formatStat(value: number): string {
    return this.stat.formatValue(value);
  }

  public get sumProgressRatio(): number {
    if (this.threshold <= 0) return 0;
    return Math.min(this.currentSum / this.threshold, 1.15);
  }

  public onFlagLoad(name: string): void {
    this._loadedFlags.add(name);
  }

  public isFlagLoaded(name: string): boolean {
    return this._loadedFlags.has(name);
  }
}