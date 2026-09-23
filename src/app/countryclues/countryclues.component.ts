import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, HostListener, inject, OnInit } from '@angular/core';
import { CONDITION_RECORDS, ConditionRecord } from '../conditions/condition-records';
import { CountriesService } from '../services/countries.service';
import { GameService, BingoConditionMatrix } from '../services/game.service';
import { Country } from '../models/countries.model';
import { shareReplay } from 'rxjs';

const TOTAL_CLUES = 5;
const MAX_SUGGESTIONS = 8;

type GamePhase = 'loading' | 'playing' | 'ended';

interface Clue {
  condition: ConditionRecord;
  matchIndex: number;
  matchCount: number;
}

interface HistoryEntry {
  roundNumber: number;
  guesses: number | null; // null = failed
}

@Component({
  selector: 'app-countryclues',
  imports: [CommonModule],
  templateUrl: './countryclues.component.html',
  styleUrl: './countryclues.component.css',
})
export class CountrycluesComponent implements OnInit {
  private _countriesService = inject(CountriesService);
  private _gameService = inject(GameService);
  private _cdr = inject(ChangeDetectorRef);

  public countries$ = this._countriesService.getAllCountries().pipe(shareReplay(1));

  public readonly totalClues = TOTAL_CLUES;
  public phase: GamePhase = 'loading';

  public target: Country | null = null;
  public clues: Clue[] = [];
  public revealedCount = 1;
  public wrongGuesses: Country[] = [];
  public guessCount = 0;
  public won = false;
  public showResult = false;

  // Autocomplete state
  public query = '';
  public suggestions: Country[] = [];
  public highlightIndex = 0;

  public gameHistory: HistoryEntry[] = [];
  private _roundNumber = 0;

  private _allCountries: Country[] = [];
  private _countryByCode = new Map<string, Country>();
  private _matrix: BingoConditionMatrix | null = null;
  private _recordByLabel = new Map<string, ConditionRecord>();
  private _conditionsByCountry = new Map<string, number[]>();
  private _matchSets = new Map<number, Set<string>>(); // condition index -> country codes
  private _puzzles = new Map<string, number[]>(); // alpha2 -> valid clue indices
  private _eligible: Country[] = [];
  private _played = new Set<string>();

  ngOnInit(): void {
    CONDITION_RECORDS.forEach(r => this._recordByLabel.set(r.label, r));

    this.countries$.subscribe(countries => {
      this._allCountries = countries;
      this._countryByCode = new Map(countries.map(c => [c.alpha2Code, c]));
      this._tryInit();
    });

    this._gameService.getBingoConditionMatrix().subscribe({
      next: matrix => {
        this._matrix = matrix;
        this._tryInit();
      },
      error: err => console.error('Failed to load bingo condition matrix', err),
    });
  }

  // --- Init: wait for countries + matrix, index conditions per country ---

  private _tryInit(): void {
    if (this.phase !== 'loading') return;
    if (this._allCountries.length === 0 || !this._matrix) return;

    const matrix = this._matrix;
    this._conditionsByCountry.clear();
    this._matchSets.clear();

    matrix.matches.forEach((codes, i) => this._matchSets.set(i, new Set(codes)));

    matrix.conditions.forEach((label, matchIndex) => {
      if (!this._recordByLabel.has(label)) return;
      for (const code of matrix.matches[matchIndex] ?? []) {
        const list = this._conditionsByCountry.get(code) ?? [];
        list.push(matchIndex);
        this._conditionsByCountry.set(code, list);
      }
    });

    // Only countries whose clues single them out are playable.
    this._puzzles.clear();
    for (const c of this._allCountries) {
      const clues = this._buildUniqueClues(c.alpha2Code);
      if (clues) this._puzzles.set(c.alpha2Code, clues);
    }
    this._eligible = this._allCountries.filter(c => this._puzzles.has(c.alpha2Code));
    console.log(`Country Clues: ${this._eligible.length} / ${this._allCountries.length} countries playable`);

    this._startRound();
  }

  // --- Uniqueness helpers ---

  private _intersect(pool: Set<string>, idx: number): Set<string> {
    const m = this._matchSets.get(idx);
    if (!m) return new Set();
    return new Set([...pool].filter(code => m.has(code)));
  }

  /** Returns TOTAL_CLUES condition indices that identify `code` uniquely, or null. */
  private _buildUniqueClues(code: string): number[] | null {
    const own = this._conditionsByCountry.get(code) ?? [];
    if (own.length < TOTAL_CLUES) return null;

    const size = (i: number) => this._matchSets.get(i)?.size ?? 0;
    const everyone = new Set(this._allCountries.map(c => c.alpha2Code));

    // 1. Preferred: the 5 rarest conditions
    const rarest = [...own].sort((a, b) => size(a) - size(b)).slice(0, TOTAL_CLUES);
    const rarestPool = rarest.reduce((pool, i) => this._intersect(pool, i), everyone);
    if (rarestPool.size === 1) return rarest;

    // 2. Fallback: greedily pick the condition that shrinks the pool the most
    let pool = everyone;
    const chosen: number[] = [];
    while (chosen.length < TOTAL_CLUES) {
      let best = -1;
      let bestPool: Set<string> | null = null;
      for (const i of own) {
        if (chosen.includes(i)) continue;
        const next = this._intersect(pool, i);
        if (
          !bestPool ||
          next.size < bestPool.size ||
          (next.size === bestPool.size && size(i) < size(best))
        ) {
          best = i;
          bestPool = next;
        }
      }
      if (best < 0 || !bestPool) return null;
      chosen.push(best);
      pool = bestPool;
    }
    return pool.size === 1 ? chosen : null;
  }

  // --- Round setup ---

  private _startRound(): void {
    if (this._eligible.length === 0) return;

    let pool = this._eligible.filter(c => !this._played.has(c.alpha2Code));
    if (pool.length === 0) {
      this._played.clear();
      pool = this._eligible;
    }

    const target = pool[Math.floor(Math.random() * pool.length)];
    this._played.add(target.alpha2Code);
    this.target = target;

    const matrix = this._matrix!;
    const countOf = (idx: number) => matrix.matches[idx]?.length ?? 0;

    // Most common first, rarest last
    const chosen = [...this._puzzles.get(target.alpha2Code)!].sort(
      (a, b) => countOf(b) - countOf(a)
    );

    this.clues = chosen.map(matchIndex => ({
      condition: this._recordByLabel.get(matrix.conditions[matchIndex])!,
      matchIndex,
      matchCount: countOf(matchIndex),
    }));

    this.revealedCount = 1;
    this.wrongGuesses = [];
    this.guessCount = 0;
    this.won = false;
    this.showResult = false;
    this.query = '';
    this.suggestions = [];
    this.highlightIndex = 0;
    this.phase = 'playing';
    this._cdr.markForCheck();
  }

  // --- Autocomplete ---

  private _normalize(s: string): string {
    return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  }

  public onQueryInput(value: string): void {
    this.query = value;
    this.highlightIndex = 0;
    const q = this._normalize(value);

    if (!q) {
      this.suggestions = [];
      return;
    }

    const guessed = new Set(this.wrongGuesses.map(c => c.alpha2Code));
    const available = this._allCountries.filter(c => !guessed.has(c.alpha2Code));
    const starts: Country[] = [];
    const contains: Country[] = [];

    for (const c of available) {
      const name = this._normalize(c.name);
      if (name.startsWith(q)) starts.push(c);
      else if (name.includes(q)) contains.push(c);
    }

    this.suggestions = [...starts, ...contains].slice(0, MAX_SUGGESTIONS);
  }

  public onKeydown(event: KeyboardEvent): void {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (this.suggestions.length) {
        this.highlightIndex = (this.highlightIndex + 1) % this.suggestions.length;
      }
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (this.suggestions.length) {
        this.highlightIndex =
          (this.highlightIndex - 1 + this.suggestions.length) % this.suggestions.length;
      }
    } else if (event.key === 'Enter') {
      event.preventDefault();
      this.onSubmit();
    } else if (event.key === 'Escape') {
      this.query = '';
      this.suggestions = [];
    }
  }

  public onSubmit(): void {
    const pick = this.suggestions[this.highlightIndex];
    if (pick) this.onGuess(pick);
  }

  // --- Guessing ---

  public onGuess(country: Country): void {
    if (this.phase !== 'playing' || !this.target) return;

    this.guessCount++;
    this.query = '';
    this.suggestions = [];
    this.highlightIndex = 0;

    if (country.alpha2Code === this.target.alpha2Code) {
      this._endGame(true);
      return;
    }

    this.wrongGuesses = [...this.wrongGuesses, country];

    if (this.wrongGuesses.length >= TOTAL_CLUES) {
      this._endGame(false);
      return;
    }

    this.revealedCount++; // wrong guess -> new clue
    this._cdr.markForCheck();
  }

  public onGiveUp(): void {
    if (this.phase !== 'playing') return;
    this._endGame(false);
  }

  private _endGame(won: boolean): void {
    this.phase = 'ended';
    this.won = won;
    this.showResult = true;
    this.revealedCount = TOTAL_CLUES;

    this._roundNumber++;
    this.gameHistory = [
      ...this.gameHistory,
      { roundNumber: this._roundNumber, guesses: won ? this.guessCount : null },
    ];
    this._cdr.markForCheck();
  }

  @HostListener('document:keydown.escape')
  public onCloseResult(): void {
    if (!this.showResult) return;
    this.showResult = false;
    this._cdr.markForCheck();
  }

  public onPlayAgain(): void {
    this._startRound();
  }

  // --- History sidebar colouring: fewer guesses = greener, failed = red ---

  public historyColor(entry: HistoryEntry): string {
    if (entry.guesses === null) return 'hsl(0, 70%, 82%)';
    const ratio = Math.min(Math.max((TOTAL_CLUES - entry.guesses + 1) / TOTAL_CLUES, 0), 1);
    const lightness = 100 - ratio * 60;
    return `hsl(120, 70%, ${lightness}%)`;
  }
}