import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, inject, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { ConditionPickerComponent } from '../condition-picker/condition-picker.component';
import { CONDITION_RECORDS, ConditionRecord } from '../conditions/condition-records';
import { CountriesService } from '../services/countries.service';
import { GameService } from '../services/game.service';
import { Country } from '../models/countries.model';
import { forkJoin, map, shareReplay, catchError, of } from 'rxjs';
import { FormsModule } from '@angular/forms';

type PickerTarget = { axis: 'row' | 'col'; index: number } | null;
type GuessTarget = { row: number; col: number } | null;
export type GameMode = 'single-player' | 'local-pvp' | 'online-pvp';
type Mark = 'X' | 'O' | null;
type PlayerNum = 1 | 2;
type GamePhase = 'conditions' | 'playing' | 'finished';
type Winner = 'X' | 'O' | 'draw' | null;

interface MatchHistoryEntry {
  number: number;
  result: PlayerNum | 'draw';
}

const WIN_LINES: [number, number][][] = [
  [[0,0],[0,1],[0,2]],
  [[1,0],[1,1],[1,2]],
  [[2,0],[2,1],[2,2]],
  [[0,0],[1,0],[2,0]],
  [[0,1],[1,1],[2,1]],
  [[0,2],[1,2],[2,2]],
  [[0,0],[1,1],[2,2]],
  [[0,2],[1,1],[2,0]],
];

const COUNTDOWN_SECONDS = 5;

@Component({
  selector: 'app-tic-tac-toe',
  imports: [CommonModule, FormsModule, RouterModule, ConditionPickerComponent],
  templateUrl: './tic-tac-toe.component.html',
  styleUrl: './tic-tac-toe.component.css',
})
export class TicTacToeComponent implements OnInit, OnDestroy {
  private _countriesService = inject(CountriesService);
  private _gameService = inject(GameService);
  private _cdr = inject(ChangeDetectorRef);
  private _route = inject(ActivatedRoute);
  private _router = inject(Router);

  public gameMode: GameMode = 'single-player';
  public countries$ = this._countriesService.getAllCountries().pipe(shareReplay(1));
  public cornerLogo = './128.png';

  public rowConditions: (ConditionRecord | null)[] = [null, null, null];
  public columnConditions: (ConditionRecord | null)[] = [null, null, null];

  public cells: string[][] = [['', '', ''], ['', '', ''], ['', '', '']];
  public cellFlags: string[][] = [['', '', ''], ['', '', ''], ['', '', '']];
  public cellFlagImages: string[][] = [['', '', ''], ['', '', ''], ['', '', '']];
  public lockedCells: boolean[][] = [[false, false, false], [false, false, false], [false, false, false]];
  /** PvP only: which mark (X/O) occupies each cell. */
  public cellMarks: Mark[][] = [[null, null, null], [null, null, null], [null, null, null]];

  public pickerTarget: PickerTarget = null;
  public pickerInvalidIds: string[] = [];
  public isLoadingPicker = false;

  public guessTarget: GuessTarget = null;
  public guessInput = '';
  public guessError = '';
  public isCheckingGuess = false;

  public guessSuggestions: Country[] = [];
  public showSuggestions = false;
  public highlightedIndex = -1;

  // --- PvP-specific state ---
  public gamePhase: GamePhase = 'conditions';
  public currentPlayer: 'X' | 'O' = 'X';
  public winner: Winner = null;
  public winningLine: [number, number][] | null = null;
  /** Total condition picks needed before play starts: 3 rows + 3 cols. */
  private _conditionPicksMade = 0;

  /** Which player number (1/2) currently plays which mark. Swaps every new game. */
  public playerNumberForMark: Record<'X' | 'O', PlayerNum> = { X: 1, O: 2 };

  /** Full match history for this PvP session (persists across games until mode switch). */
  public matchHistory: MatchHistoryEntry[] = [];

  /** Seconds remaining before the next game auto-starts; null when not counting down. */
  public countdownSeconds: number | null = null;
  private _countdownInterval: ReturnType<typeof setInterval> | null = null;

  private _allCountries: Country[] = [];

  public wrongGuessCell: { row: number; col: number } | null = null;
  private _wrongGuessTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.countries$.subscribe(countries => (this._allCountries = countries));
  }

  ngOnInit(): void {
    this._route.paramMap.subscribe(params => {
      const mode = params.get('mode') as GameMode | null;
      this.gameMode = mode ?? 'single-player';
      this._resetSession();
      this._resetBoardState();
      this._initializeForMode();
      this._cdr.markForCheck();
    });
  }

  ngOnDestroy(): void {
    this._clearCountdown();
    if (this._wrongGuessTimeout) clearTimeout(this._wrongGuessTimeout);
  }

  /** Wipes cross-game session data (score, player/mark assignment). Only on mode switch. */
  private _resetSession(): void {
    this.matchHistory = [];
    this.playerNumberForMark = { X: 1, O: 2 };
    this._clearCountdown();
    this.countdownSeconds = null;
  }

  private _resetBoardState(): void {
    this.cells = [['', '', ''], ['', '', ''], ['', '', '']];
    this.cellFlags = [['', '', ''], ['', '', ''], ['', '', '']];
    this.cellFlagImages = [['', '', ''], ['', '', ''], ['', '', '']];
    this.lockedCells = [[false, false, false], [false, false, false], [false, false, false]];
    this.cellMarks = [[null, null, null], [null, null, null], [null, null, null]];
    this.rowConditions = [null, null, null];
    this.columnConditions = [null, null, null];
    this.winner = null;
    this.winningLine = null;
    this.pickerTarget = null;
    this.pickerInvalidIds = [];
    this.guessTarget = null;
    this.guessInput = '';
    this.guessError = '';
    this._clearCountdown();
    this.countdownSeconds = null;
    this.wrongGuessCell = null;
    if (this._wrongGuessTimeout) { 
      clearTimeout(this._wrongGuessTimeout); this._wrongGuessTimeout = null; 
    }
  }

  public onSelectMode(mode: GameMode): void {
    this._router.navigate(['/tic-tac-toe', mode]);
  }

  private _initializeForMode(): void {
    if (this.gameMode === 'single-player') {
      this.gamePhase = 'playing';
      this._randomizeConditions();
    } else if (this.gameMode === 'local-pvp') {
      this.gamePhase = 'conditions';
      this.currentPlayer = 'X';
      this._conditionPicksMade = 0;
    }
    // online-pvp left untouched for now.
  }

  private _randomizeConditions(): void {
    this.isLoadingPicker = true;
    this._cdr.markForCheck();

    const shuffledPool = [...CONDITION_RECORDS].sort(() => Math.random() - 0.5);
    const rows: ConditionRecord[] = [];
    const cols: ConditionRecord[] = [];

    this._pickNextRandomCondition(shuffledPool, rows, cols, 0);
  }

  /**
   * Picks conditions one at a time (row, col, row, col, row, col), backtracking
   * to the previous slot if no remaining candidate is valid against everything
   * picked so far — same pairwise check _openPicker uses for the manual flow.
   */
  private _pickNextRandomCondition(
    pool: ConditionRecord[],
    rows: ConditionRecord[],
    cols: ConditionRecord[],
    step: number
  ): void {
    const total = 6; // 3 rows + 3 cols
    if (step >= total) {
      this.rowConditions = [rows[0], rows[1], rows[2]];
      this.columnConditions = [cols[0], cols[1], cols[2]];
      this.isLoadingPicker = false;
      this._cdr.markForCheck();
      return;
    }

    const isRow = step % 2 === 0;
    const used = new Set([...rows, ...cols].map(c => c.id));
    const candidates = pool.filter(c => !used.has(c.id));
    const opposite = isRow ? cols : rows;

    this._findValidCandidate(candidates, opposite, isRow, 0, chosen => {
      if (chosen) {
        if (isRow) rows.push(chosen); else cols.push(chosen);
        this._pickNextRandomCondition(pool, rows, cols, step + 1);
      } else {
        // No candidate works against what's already picked — back up a step
        // and let the caller retry with a different earlier choice.
        if (isRow) rows.pop(); else cols.pop();
        if (step === 0) {
          // Nothing at all works (shouldn't normally happen) — just restart fresh.
          this._randomizeConditions();
        } else {
          this._pickNextRandomCondition(pool, rows, cols, step - 1);
        }
      }
    });
  }

  /** Walks shuffled candidates in order, returning the first that's valid against all opposite-axis picks so far (or null if none work). */
  private _findValidCandidate(
    candidates: ConditionRecord[],
    opposite: ConditionRecord[],
    isRow: boolean,
    index: number,
    done: (chosen: ConditionRecord | null) => void
  ): void {
    if (index >= candidates.length) {
      done(null);
      return;
    }
    const candidate = candidates[index];

    if (opposite.length === 0) {
      done(candidate);
      return;
    }

    const checks$ = opposite.map(opp =>
      (isRow
        ? this._gameService.isValidColumnRowCombination(candidate.label, opp.label)
        : this._gameService.isValidColumnRowCombination(opp.label, candidate.label)
      ).pipe(catchError(() => of(false)))
    );

    forkJoin(checks$).subscribe(results => {
      if (results.every(Boolean)) {
        done(candidate);
      } else {
        this._findValidCandidate(candidates, opposite, isRow, index + 1, done);
      }
    });
  }

  public get usedConditionIds(): string[] {
    return [...this.rowConditions, ...this.columnConditions]
      .filter((c): c is ConditionRecord => c !== null)
      .map(c => c.id);
  }

  public get pickerDisabledIds(): string[] {
    return [...this.usedConditionIds, ...this.pickerInvalidIds];
  }

  public get allConditionsSet(): boolean {
    return this.rowConditions.every(c => c !== null) && this.columnConditions.every(c => c !== null);
  }

  public get isPvp(): boolean {
    return this.gameMode === 'local-pvp';
  }

  // --- Score tracker ---

  public get player1Wins(): number {
    return this.matchHistory.filter(m => m.result === 1).length;
  }

  public get player2Wins(): number {
    return this.matchHistory.filter(m => m.result === 2).length;
  }

  public get drawCount(): number {
    return this.matchHistory.filter(m => m.result === 'draw').length;
  }

  private _recordMatchResult(): void {
    if (!this.isPvp) return;
    let result: PlayerNum | 'draw';
    if (this.winner === 'draw') {
      result = 'draw';
    } else if (this.winner) {
      result = this.playerNumberForMark[this.winner];
    } else {
      return;
    }
    this.matchHistory = [...this.matchHistory, { number: this.matchHistory.length + 1, result }];
  }

  // --- Countdown / auto-restart ---

  private _startPvpCountdown(): void {
    this.countdownSeconds = COUNTDOWN_SECONDS;
    this._cdr.markForCheck();
    this._clearCountdown();
    this._countdownInterval = setInterval(() => {
      this.countdownSeconds = (this.countdownSeconds ?? 1) - 1;
      if (this.countdownSeconds <= 0) {
        this._clearCountdown();
        this._startNextPvpGame();
        return;
      }
      this._cdr.markForCheck();
    }, 1000);
  }

  private _clearCountdown(): void {
    if (this._countdownInterval) {
      clearInterval(this._countdownInterval);
      this._countdownInterval = null;
    }
  }

  private _startNextPvpGame(): void {
    this.countdownSeconds = null;
    // Swap which mark each player plays so nobody is stuck as X/O every game.
    this.playerNumberForMark = { X: this.playerNumberForMark.O, O: this.playerNumberForMark.X };
    this._resetBoardState();
    this._initializeForMode();
    this._cdr.markForCheck();
  }

  // --- Condition picking ---

  public onSelectRowCondition(row: number): void {
    if (this.isPvp && this.gamePhase !== 'conditions') return;
    if (this.allConditionsSet || this.rowConditions[row]) return;
    this._openPicker({ axis: 'row', index: row });
  }

  public onSelectColumnCondition(col: number): void {
    if (this.isPvp && this.gamePhase !== 'conditions') return;
    if (this.allConditionsSet || this.columnConditions[col]) return;
    this._openPicker({ axis: 'col', index: col });
  }

  private _openPicker(target: Exclude<PickerTarget, null>): void {
    if (this.isLoadingPicker) return;
    const oppositeConditions = (target.axis === 'row' ? this.columnConditions : this.rowConditions)
      .filter((c): c is ConditionRecord => c !== null);

    if (oppositeConditions.length === 0) {
      this.pickerInvalidIds = [];
      this.pickerTarget = target;
      this._cdr.markForCheck();
      return;
    }

    this.isLoadingPicker = true;
    const candidateChecks$ = CONDITION_RECORDS.map(candidate => {
      const validityChecks$ = oppositeConditions.map(oppCondition =>
        (target.axis === 'row'
          ? this._gameService.isValidColumnRowCombination(candidate.label, oppCondition.label)
          : this._gameService.isValidColumnRowCombination(oppCondition.label, candidate.label)
        ).pipe(catchError(() => of(false)))
      );
      return forkJoin(validityChecks$).pipe(map(results => ({ id: candidate.id, isValid: results.every(Boolean) })));
    });

    forkJoin(candidateChecks$).subscribe({
      next: results => {
        this.pickerInvalidIds = results.filter(r => !r.isValid).map(r => r.id);
        this.isLoadingPicker = false;
        this.pickerTarget = target;
        this._cdr.markForCheck();
      },
      error: () => (this.isLoadingPicker = false),
    });
  }

  public onConditionPicked(record: ConditionRecord): void {
    if (!this.pickerTarget) return;
    const { axis, index } = this.pickerTarget;
    if (axis === 'row') {
      this.rowConditions[index] = record;
    } else {
      this.columnConditions[index] = record;
    }
    this.pickerTarget = null;
    this.pickerInvalidIds = [];

    if (this.isPvp) {
      this._conditionPicksMade++;
      if (this._conditionPicksMade >= 6) {
        this.gamePhase = 'playing';
        this.currentPlayer = 'X';
      } else {
        this.currentPlayer = this.currentPlayer === 'X' ? 'O' : 'X';
      }
    }
    this._cdr.markForCheck();
  }

  public onPickerDismissed(): void {
    this.pickerTarget = null;
    this.pickerInvalidIds = [];
  }

  // --- Guessing ---

  public onGuessCell(row: number, col: number): void {
    if (this.isPvp && this.gamePhase !== 'playing') return;
    if (!this.isPvp && !this.allConditionsSet) return;
    if (!this.rowConditions[row] || !this.columnConditions[col]) return;
    if (this.lockedCells[row][col]) return;

    this.guessTarget = { row, col };
    this.guessInput = '';
    this.guessError = '';
    this.guessSuggestions = [];
    this.showSuggestions = false;
  }

  public onGuessCancel(): void {
    this.guessTarget = null;
    this.guessInput = '';
    this.guessError = '';
    this.guessSuggestions = [];
    this.showSuggestions = false;
  }

  public onGuessInputChange(): void {
    this.guessError = '';
    const query = this.guessInput.trim().toLowerCase();
    if (!query) {
      this.guessSuggestions = [];
      this.showSuggestions = false;
      this.highlightedIndex = -1;
      return;
    }
    this.guessSuggestions = this._allCountries
      .filter(c => c.name.toLowerCase().includes(query))
      .sort((a, b) => {
        const aStarts = a.name.toLowerCase().startsWith(query);
        const bStarts = b.name.toLowerCase().startsWith(query);
        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;
        return a.name.localeCompare(b.name);
      })
      .slice(0, 6);
    this.showSuggestions = this.guessSuggestions.length > 0;
    this.highlightedIndex = -1;
  }

  public onSuggestionSelect(country: Country): void {
    this.guessInput = country.name;
    this.guessSuggestions = [];
    this.showSuggestions = false;
    this.highlightedIndex = -1;
  }

  public onGuessInputBlur(): void {
    setTimeout(() => {
      this.showSuggestions = false;
      this.highlightedIndex = -1;
    }, 120);
  }

  public onArrowDown(event: Event): void {
    if (!this.showSuggestions || this.guessSuggestions.length === 0) return;
    event.preventDefault();
    this.highlightedIndex = (this.highlightedIndex + 1) % this.guessSuggestions.length;
  }

  public onArrowUp(event: Event): void {
    if (!this.showSuggestions || this.guessSuggestions.length === 0) return;
    event.preventDefault();
    this.highlightedIndex = this.highlightedIndex <= 0 ? this.guessSuggestions.length - 1 : this.highlightedIndex - 1;
  }

  public onEnterPressed(event: Event): void {
    event.preventDefault();
    if (this.showSuggestions && this.highlightedIndex >= 0) {
      this.onSuggestionSelect(this.guessSuggestions[this.highlightedIndex]);
    } else if (this.showSuggestions && this.guessSuggestions.length === 1) {
      this.onSuggestionSelect(this.guessSuggestions[0]);
    }
    this.showSuggestions = false;
    this.onGuessSubmit();
  }

  public onGuessSubmit(): void {
    if (!this.guessTarget) return;
    const { row, col } = this.guessTarget;
    const rowCondition = this.rowConditions[row];
    const colCondition = this.columnConditions[col];
    if (!rowCondition || !colCondition) return;

    const query = this.guessInput.trim().toLowerCase();
    if (!query) {
      this.guessError = 'Type a country name.';
      return;
    }

    const match = this._allCountries.find(c => c.name.toLowerCase() === query);
    if (!match) {
      this.guessError = `"${this.guessInput}" isn't a recognized country name.`;
      return;
    }

    // Close the modal immediately — the result lands on the cell itself.
    this.guessTarget = null;
    this.guessInput = '';
    this.guessError = '';
    this.guessSuggestions = [];
    this.showSuggestions = false;
    this._cdr.markForCheck();

    const guessingPlayer = this.currentPlayer; // capture before any turn flip happens elsewhere

    this._gameService
      .isCorrectCountryTicTacToe(match.alpha2Code, rowCondition.label, colCondition.label)
        .subscribe({
          next: isCorrect => {
            if (isCorrect) {
              this.cells[row][col] = match.name;
              this.cellFlags[row][col] = match.flag;
              this.cellFlagImages[row][col] = match.flags.svg;
              this.lockedCells[row][col] = true;

              if (this.isPvp) {
                this.cellMarks[row][col] = guessingPlayer;
                this._checkPvpGameEnd();
              }
            } else {
              if (this.isPvp) {
                this.currentPlayer = guessingPlayer === 'X' ? 'O' : 'X';
              }
              this._flashWrongGuess(row, col);
            }
            this._cdr.markForCheck();
          },
          error: () => {
            this._cdr.markForCheck();
          },
        });
  }

  private _flashWrongGuess(row: number, col: number): void {
    this.wrongGuessCell = { row, col };
    if (this._wrongGuessTimeout) clearTimeout(this._wrongGuessTimeout);
    this._wrongGuessTimeout = setTimeout(() => {
      this.wrongGuessCell = null;
      this._cdr.markForCheck();
    }, 500);
  }

  public isWrongGuessCell(row: number, col: number): boolean {
    return this.wrongGuessCell?.row === row && this.wrongGuessCell?.col === col;
  }

  private _checkPvpGameEnd(): void {
    for (const line of WIN_LINES) {
      const [a, b, c] = line;
      const markA = this.cellMarks[a[0]][a[1]];
      const markB = this.cellMarks[b[0]][b[1]];
      const markC = this.cellMarks[c[0]][c[1]];
      if (markA && markA === markB && markB === markC) {
        this.winner = markA;
        this.winningLine = line;
        this.gamePhase = 'finished';
        this._recordMatchResult();
        this._startPvpCountdown();
        return;
      }
    }

    const allFilled = this.cellMarks.every(row => row.every(m => m !== null));
    if (allFilled) {
      this.winner = 'draw';
      this.gamePhase = 'finished';
      this._recordMatchResult();
      this._startPvpCountdown();
      return;
    }

    this.currentPlayer = this.currentPlayer === 'X' ? 'O' : 'X';
  }

  public isWinningCell(row: number, col: number): boolean {
    if (!this.winningLine) return false;
    return this.winningLine.some(([r, c]) => r === row && c === col);
  }

  public onPlayAgain(): void {
    this._resetBoardState();
    this._initializeForMode();
  }

  public get isSingleplayerComplete(): boolean {
    return !this.isPvp && this.allConditionsSet && this.cells.every(row => row.every(c => c));
  }
}