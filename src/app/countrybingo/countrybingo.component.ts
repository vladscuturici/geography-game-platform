import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, inject, OnDestroy, OnInit } from '@angular/core';
import { RouterModule } from '@angular/router';
import { CONDITION_RECORDS, ConditionRecord } from '../conditions/condition-records';
import { CountriesService } from '../services/countries.service';
import { GameService, BingoConditionMatrix } from '../services/game.service';
import { Country } from '../models/countries.model';
import { shareReplay } from 'rxjs';

const GRID_SIZE = 4;
const TOTAL_CELLS = GRID_SIZE * GRID_SIZE; // 16
const MIN_MATCHES_TO_USE_CONDITION = 3;

const FILLER_DOUBLE = 6;
const FILLER_SINGLE = 4;
const FILLER_NONE = 6;
const TOTAL_SKIPS = 5;
const GAME_DURATION_SECONDS = 180;
type GameMode = 'local' | 'online';
type GamePhase = 'setup' | 'loading-matrix' | 'dealing-deck' | 'playing' | 'ended';
type CellResult = 'correct' | 'wrong' | null;

interface PlacedCountry {
  name: string;
  alpha2Code: string;
  alpha3Code: string;
  flag: string;
  flagSvg: string;
}

interface GridCell {
  condition: ConditionRecord;
  matchIndex: number;
  placed: PlacedCountry | null;
  locked: boolean;
  result: CellResult;
}

@Component({
  selector: 'app-countrybingo',
  imports: [CommonModule, RouterModule],
  templateUrl: './countrybingo.component.html',
  styleUrl: './countrybingo.component.css',
})
export class CountrybingoComponent implements OnInit, OnDestroy {
  private _countriesService = inject(CountriesService);
  private _gameService = inject(GameService);
  private _cdr = inject(ChangeDetectorRef);

  public countries$ = this._countriesService.getAllCountries().pipe(shareReplay(1));
  public cornerLogo = './128.png';

  public readonly gridSize = GRID_SIZE;
  public grid: GridCell[] = [];

  public phase: GamePhase = 'loading-matrix';
  public deck: Country[] = [];
  private _dealIndex = 0;
  public currentCountry: Country | null = null;
  public cardsRemaining = 0;

  public readonly gameDurationSeconds = GAME_DURATION_SECONDS;
  public timeRemaining = GAME_DURATION_SECONDS;
  private _timerHandle: ReturnType<typeof setInterval> | null = null;

  public readonly totalSkips = TOTAL_SKIPS;
  public skipsRemaining = TOTAL_SKIPS;

  public correctCount = 0;
  public filledCount = 0;
  public readonly totalCells = TOTAL_CELLS;

  private _allCountries: Country[] = [];
  private _countryByCode = new Map<string, Country>();
  private _matrix: BingoConditionMatrix | null = null;
  
  private _roundNumber = 0;
  public gameHistory: { roundNumber: number; score: number }[] = [];

  ngOnInit(): void {
    this.countries$.subscribe(countries => {
      this._allCountries = countries;
      this._countryByCode = new Map(countries.map(c => [c.alpha2Code, c]));
      this._tryInitBoard();
    });

    // DO NOT REMOVE THOSE COMMENTS
    // this._gameService.createTicTacToeConditionMatrix().subscribe();
    // this._gameService.createBingoConditionMatrix().subscribe();

    this._gameService.getBingoConditionMatrix().subscribe({
      next: matrix => {
        this._matrix = matrix;
        this._tryInitBoard();
      },
      error: err => console.error('Failed to load bingo condition matrix', err),
    });
  }

  ngOnDestroy(): void {
    this._clearTimer();
  }

  /** Waits for both the country list and the condition matrix before building the board. */
  private _tryInitBoard(): void {
    if (this.phase !== 'loading-matrix') return; // already built (e.g. on play-again)
    if (this._allCountries.length === 0 || !this._matrix) return;

    this._buildGridConditions();
    this.phase = 'setup';
    this._cdr.markForCheck();
  }

  // --- Setup: pick 16 independent conditions ---

  private _buildGridConditions(): void {
    const matrix = this._matrix!;
    const usableIndices = matrix.conditions
      .map((label, matchIndex) => ({ label, matchIndex }))
      .filter(entry => (matrix.matches[entry.matchIndex]?.length ?? 0) >= MIN_MATCHES_TO_USE_CONDITION);

    const shuffled = this._shuffle(usableIndices);
    const chosen: { label: string; matchIndex: number }[] = [];

    for (const entry of shuffled) {
      if (chosen.length >= TOTAL_CELLS) break;
      const record = CONDITION_RECORDS.find(r => r.label === entry.label);
      if (!record) continue;
      chosen.push(entry);
    }

    this.grid = chosen.map(entry => ({
      condition: CONDITION_RECORDS.find(r => r.label === entry.label)!,
      matchIndex: entry.matchIndex,
      placed: null,
      locked: false,
      result: null,
    }));
  }

  private _resetBoardState(): void {
    this._clearTimer();
    this.phase = 'setup';
    this.deck = [];
    this._dealIndex = 0;
    this.currentCountry = null;
    this.cardsRemaining = 0;
    this.skipsRemaining = TOTAL_SKIPS;
    this.correctCount = 0;
    this.filledCount = 0;
    this.timeRemaining = GAME_DURATION_SECONDS;
  }

  private _shuffle<T>(arr: T[]): T[] {
    return [...arr].sort(() => Math.random() - 0.5);
  }

  public get allConditionsSet(): boolean {
    return this.grid.length === TOTAL_CELLS;
  }

  // --- Deck construction ---

  public onStartGame(): void {
    if (!this.allConditionsSet || this.phase !== 'setup') return;
    this.phase = 'dealing-deck';
    this._cdr.markForCheck();
    this._buildDeck();
  }

  private _matchesFor(cellIndex: number): string[] {
    return this._matrix?.matches[this.grid[cellIndex].matchIndex] ?? [];
  }

  private _buildDeck(): void {
    const used = new Set<string>();
    const cards: Country[] = [];
    const TARGET_TOTAL = TOTAL_CELLS + FILLER_DOUBLE + FILLER_SINGLE + FILLER_NONE;

    const takeCountry = (code: string): boolean => {
      if (used.has(code)) return false;
      const country = this._countryByCode.get(code);
      if (!country) return false;
      used.add(code);
      cards.push(country);
      return true;
    };

    // 1. Guaranteed solver per cell. Falls back to any unused match for that
    // cell if the shuffled-order pick was already claimed by an earlier cell,
    // so this stage always contributes exactly one card per solvable cell.
    for (let i = 0; i < this.grid.length; i++) {
      const pool = this._matchesFor(i).filter(c => !used.has(c));
      if (pool.length === 0) continue;
      const code = pool[Math.floor(Math.random() * pool.length)];
      takeCountry(code);
    }

    // 2. Double-match filler — exhaustively scan all cell pairs for
    // intersecting, unused matches instead of relying on limited random
    // sampling, so we place exactly FILLER_DOUBLE whenever it's possible.
    const placeFromPairs = (target: number): number => {
      let placed = 0;
      const pairs: [number, number][] = [];
      for (let i = 0; i < this.grid.length; i++) {
        for (let j = i + 1; j < this.grid.length; j++) pairs.push([i, j]);
      }
      for (const [i, j] of this._shuffle(pairs)) {
        if (placed >= target) break;
        const setA = new Set(this._matchesFor(i));
        const intersection = this._matchesFor(j).filter(c => setA.has(c) && !used.has(c));
        if (intersection.length === 0) continue;
        const code = intersection[Math.floor(Math.random() * intersection.length)];
        if (takeCountry(code)) placed++;
      }
      return placed;
    };
    placeFromPairs(FILLER_DOUBLE);

    // 3. Extra single-match filler — exhaustively scan all cells for unused
    // matches instead of giving up after a fixed number of random misses.
    const placeFromCells = (target: number): number => {
      let placed = 0;
      const cellOrder = this._shuffle(this.grid.map((_, i) => i));
      let progressed = true;
      while (placed < target && progressed) {
        progressed = false;
        for (const i of cellOrder) {
          if (placed >= target) break;
          const pool = this._matchesFor(i).filter(c => !used.has(c));
          if (pool.length === 0) continue;
          const code = pool[Math.floor(Math.random() * pool.length)];
          if (takeCountry(code)) {
            placed++;
            progressed = true;
          }
        }
      }
      return placed;
    };
    placeFromCells(FILLER_SINGLE);

    // 4. Zero-match bait cards.
    const boardUnion = new Set<string>();
    this.grid.forEach((_, i) => this._matchesFor(i).forEach(c => boardUnion.add(c)));

    const noMatchPool = this._shuffle(
      this._allCountries.filter(c => !boardUnion.has(c.alpha2Code) && !used.has(c.alpha2Code))
    );
    let baitIndex = 0;
    for (; baitIndex < FILLER_NONE && baitIndex < noMatchPool.length; baitIndex++) {
      takeCountry(noMatchPool[baitIndex].alpha2Code);
    }

    // 5. Top-up: if any earlier stage came up short (small/overlapping match
    // pools, etc.), pad with more bait cards so every game deals the same
    // total number of cards, keeping `cardsRemaining` constant across games.
    for (; cards.length < TARGET_TOTAL && baitIndex < noMatchPool.length; baitIndex++) {
      takeCountry(noMatchPool[baitIndex].alpha2Code);
    }
    // Last resort (extremely small country pools only): allow use of any
    // remaining unused country regardless of match status, just to hit count.
    if (cards.length < TARGET_TOTAL) {
      const anyUnused = this._shuffle(
        this._allCountries.filter(c => !used.has(c.alpha2Code))
      );
      for (const c of anyUnused) {
        if (cards.length >= TARGET_TOTAL) break;
        takeCountry(c.alpha2Code);
      }
    }

    this.deck = this._shuffle(cards);
    this._dealIndex = 0;
    this.phase = 'playing';
    this._startTimer();
    this._dealNext();
  }

  private _startTimer(): void {
    this._clearTimer();
    this.timeRemaining = GAME_DURATION_SECONDS;
    this._timerHandle = setInterval(() => {
      this.timeRemaining--;
      if (this.timeRemaining <= 0) {
        this.timeRemaining = 0;
        this._clearTimer();
        this.currentCountry = null;
        this._endGame();
        return;
      }
      this._cdr.markForCheck();
    }, 1000);
  }

  private _clearTimer(): void {
    if (this._timerHandle !== null) {
      clearInterval(this._timerHandle);
      this._timerHandle = null;
    }
  }

  // --- Dealing / placing / skipping ---

  private _dealNext(): void {
    if (this._dealIndex >= this.deck.length) {
      this.currentCountry = null;
      this._endGame();
      return;
    }
    this.currentCountry = this.deck[this._dealIndex];
    this._dealIndex++;
    this.cardsRemaining = this.deck.length - this._dealIndex;
    this._cdr.markForCheck();
  }

  public onPlaceCurrent(cellIndex: number): void {
    if (this.phase !== 'playing' || !this.currentCountry) return;
    const cell = this.grid[cellIndex];
    if (cell.locked) return;

    const country = this.currentCountry;
    cell.placed = {
      name: country.name,
      alpha2Code: country.alpha2Code,
      alpha3Code: country.alpha3Code,
      flag: country.flag,
      flagSvg: country.flags.svg,
    };
    cell.locked = true;
    this.filledCount++;

    if (this.filledCount >= this.totalCells) {
      this.currentCountry = null;
      this._endGame();
      return;
    }

    this._dealNext();
  }

  public onSkipCurrent(): void {
    if (this.phase !== 'playing' || !this.currentCountry) return;
    this._dealNext();
  }

  // --- End-game scoring: still uses the service, but synchronous now (matrix already cached) ---

  private _endGame(): void {
    this._clearTimer();
    this.phase = 'ended';
    this.correctCount = 0;

    this.grid.forEach(cell => {
      if (!cell.placed) {
        cell.result = 'wrong';
        return;
      }
      const matches = this._matrix?.matches[cell.matchIndex] ?? [];
      const isCorrect = matches.includes(cell.placed.alpha2Code);
      cell.result = isCorrect ? 'correct' : 'wrong';
      if (isCorrect) this.correctCount++;
    });

    this._roundNumber++;
    this.gameHistory = [
      ...this.gameHistory,
      { roundNumber: this._roundNumber, score: this.correctCount },
    ];

    this._cdr.markForCheck();
  }

  public toGreenSaturation(score: number): string {
    const ratio = Math.min(Math.max(score / this.totalCells, 0), 1);
    const lightness = 100 - ratio * 60;
    return `hsl(120, 70%, ${lightness}%)`;
  }

  public onPlayAgain(): void {
    this._resetBoardState();
    this._buildGridConditions();
  }
}