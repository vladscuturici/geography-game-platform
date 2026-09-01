import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, forkJoin, map, of, shareReplay } from 'rxjs';

import { ConditionPickerComponent } from '../condition-picker/condition-picker.component';
import { CONDITION_RECORDS, ConditionRecord } from '../conditions/condition-records';
import { CountriesService } from '../services/countries.service';
import { GameService } from '../services/game.service';
import { Country } from '../models/countries.model';

type Phase = 'waiting' | 'conditions' | 'playing' | 'finished';
type Mark = 'X' | 'O';
type PlayerNum = 1 | 2;
type ScreenState = 'username' | 'menu' | 'join-code' | 'connecting' | 'room' | 'error';
type PickerTarget = { axis: 'row' | 'col'; index: number } | null;
type GuessTarget = { row: number; col: number } | null;

interface CellData {
  country: string;
  flag: string;
  flagImage: string;
  mark: Mark;
}

interface MatchHistoryEntry {
  number: number;
  result: PlayerNum | 'draw';
}

interface RoomState {
  type: 'room_state';
  you: PlayerNum;
  connected: number;
  phase: Phase;
  currentPlayer: Mark;
  playerNumberForMark: Record<Mark, PlayerNum>;
  rowConditionIds: (string | null)[];
  columnConditionIds: (string | null)[];
  cells: (CellData | null)[][];
  winner: Mark | 'draw' | null;
  winningLine: [number, number][] | null;
  lastWrongGuess: { row: number; col: number } | null;
  wrongGuessSeq: number;
  matchHistory: MatchHistoryEntry[];
  player1Name: string;
  player2Name: string;
}

// const WS_BASE = 'wss://wavelength-server.vladscuturici.workers.dev';
// const API_BASE = 'https://wavelength-server.vladscuturici.workers.dev';
const WS_BASE = 'ws://127.0.0.1:8787';
const API_BASE = 'http://127.0.0.1:8787';
export const MAX_USERNAME_LENGTH = 10;

@Component({
  selector: 'app-tic-tac-toe-online',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    ConditionPickerComponent,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
  ],
  templateUrl: './tic-tac-toe-online.component.html',
  styleUrl: './tic-tac-toe-online.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TicTacToeOnlineComponent implements OnInit {
  private _cdr = inject(ChangeDetectorRef);
  private _destroyRef = inject(DestroyRef);
  private _route = inject(ActivatedRoute);
  private _countriesService = inject(CountriesService);
  private _gameService = inject(GameService);

  public cornerLogo = './128.png';

  // --- Connection flow (mirrors wavelength-online) ---
  public screen: ScreenState = 'username';
  public username = '';
  public joinCodeInput = '';
  public errorMessage = '';
  public roomCode = '';
  public socket: WebSocket | null = null;
  public state: RoomState | null = null;

  public countries$ = this._countriesService.getAllCountries().pipe(shareReplay(1));
  private _allCountries: Country[] = [];

  // --- Condition picking ---
  public pickerTarget: PickerTarget = null;
  public pickerInvalidIds: string[] = [];
  public isLoadingPicker = false;

  // --- Guessing ---
  public guessTarget: GuessTarget = null;
  public guessInput = '';
  public guessError = '';
  public isCheckingGuess = false;
  public guessSuggestions: Country[] = [];
  public showSuggestions = false;
  public highlightedIndex = -1;

  // --- Wrong-guess flash (one-shot, driven by server's wrongGuessSeq) ---
  public wrongGuessCell: { row: number; col: number } | null = null;
  private _lastSeenWrongGuessSeq = 0;
  private _wrongGuessTimeout: ReturnType<typeof setTimeout> | null = null;

  // --- Auto-restart countdown, purely client-side display, same 5s as local ---
  public countdownSeconds: number | null = null;
  private _countdownInterval: ReturnType<typeof setInterval> | null = null;
  private _nextGameSent = false;

  ngOnInit(): void {
    this.countries$.pipe(takeUntilDestroyed(this._destroyRef)).subscribe((countries) => {
      this._allCountries = countries;
      this._cdr.markForCheck();
    });

    const codeFromUrl = this._route.snapshot.paramMap.get('code');
    if (codeFromUrl) {
      this.joinCodeInput = codeFromUrl.toUpperCase();
    }

    this._destroyRef.onDestroy(() => {
      this.socket?.close();
      this._clearCountdown();
      if (this._wrongGuessTimeout) clearTimeout(this._wrongGuessTimeout);
    });
  }

  // ---------------------------------------------------------------------
  // Connection flow
  // ---------------------------------------------------------------------

  public confirmUsername(): void {
    const trimmed = this.username.trim();
    if (!trimmed) return;
    this.username = trimmed;
    if (this.joinCodeInput) {
      this.joinRoom();
    } else {
      this.screen = 'menu';
    }
  }

  public get usernameTooLong(): boolean {
    return this.username.trim().length > MAX_USERNAME_LENGTH;
  }

  public get usernameRemaining(): number {
    return MAX_USERNAME_LENGTH - this.username.length;
  }

  public chooseCreate(): void {
    this.createRoom();
  }

  public chooseJoin(): void {
    this.screen = 'join-code';
  }

  private async createRoom(): Promise<void> {
    this.screen = 'connecting';
    try {
      const res = await fetch(`${API_BASE}/tictactoe/room`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to create room');
      const data = await res.json();
      this.roomCode = data.code;
      this.connectSocket(this.roomCode);
    } catch (err) {
      this.showError('Could not create room. Try again.');
    }
  }

  public joinRoom(): void {
    const code = this.joinCodeInput.trim().toUpperCase();
    if (!code) return;
    this.roomCode = code;
    this.screen = 'connecting';
    this.connectSocket(code);
  }

  private connectSocket(code: string): void {
    const name = encodeURIComponent(this.username.trim().slice(0, MAX_USERNAME_LENGTH));
    const ws = new WebSocket(`${WS_BASE}/tictactoe/room/${code}/ws?name=${name}`);

    ws.onopen = () => {
      this.socket = ws;
      this.screen = 'room';
      this._cdr.markForCheck();
    };

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.type === 'room_state') {
        this.handleRoomState(msg as RoomState);
      }
    };

    ws.onerror = () => {
      this.showError('Connection failed. Check the room code and try again.');
    };

    ws.onclose = () => {
      if (this.screen === 'room') {
        this.showError('Connection lost.');
      }
    };
  }

  private showError(message: string): void {
    this.errorMessage = message;
    this.screen = 'error';
    this.socket?.close();
    this.socket = null;
    this._cdr.markForCheck();
  }

  public copyRoomLink(): void {
    const link = `${window.location.origin}${window.location.pathname}#/tic-tac-toe/online-pvp/room/${this.roomCode}`;
    navigator.clipboard?.writeText(link);
  }

  private send(payload: unknown): void {
    this.socket?.send(JSON.stringify(payload));
  }

  // ---------------------------------------------------------------------
  // State handling
  // ---------------------------------------------------------------------

  private handleRoomState(next: RoomState): void {
    const prevPhase = this.state?.phase;
    this.state = next;

    // Detect a fresh wrong guess via the sequence number and flash it.
    if (next.lastWrongGuess && next.wrongGuessSeq !== this._lastSeenWrongGuessSeq) {
      this._lastSeenWrongGuessSeq = next.wrongGuessSeq;
      this.wrongGuessCell = next.lastWrongGuess;
      if (this._wrongGuessTimeout) clearTimeout(this._wrongGuessTimeout);
      this._wrongGuessTimeout = setTimeout(() => {
        this.wrongGuessCell = null;
        this._cdr.markForCheck();
      }, 500);
    }

    // Reset any local guess-modal state if a new game just started.
    if (prevPhase !== next.phase) {
      if (next.phase === 'conditions' && prevPhase !== undefined) {
        this.guessTarget = null;
        this.guessInput = '';
        this.guessError = '';
      }
      if (next.phase === 'finished') {
        this._startCountdown();
      } else {
        this._clearCountdown();
      }
    }

    this._cdr.markForCheck();
  }

  private _startCountdown(): void {
    this._nextGameSent = false;
    this.countdownSeconds = 5;
    this._clearCountdown();
    this._countdownInterval = setInterval(() => {
      this.countdownSeconds = (this.countdownSeconds ?? 1) - 1;
      if (this.countdownSeconds <= 0) {
        this._clearCountdown();
        if (!this._nextGameSent) {
          this._nextGameSent = true;
          this.send({ type: 'next_game' });
        }
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

  // ---------------------------------------------------------------------
  // Derived view state
  // ---------------------------------------------------------------------

  public get isMyTurn(): boolean {
    if (!this.state) return false;
    return this.state.you === this.state.playerNumberForMark[this.state.currentPlayer];
  }

  public get myPlayerNum(): PlayerNum | null {
    return this.state?.you ?? null;
  }

  public get rowConditions(): (ConditionRecord | null)[] {
    if (!this.state) return [null, null, null];
    return this.state.rowConditionIds.map((id) => this._findCondition(id));
  }

  public get columnConditions(): (ConditionRecord | null)[] {
    if (!this.state) return [null, null, null];
    return this.state.columnConditionIds.map((id) => this._findCondition(id));
  }

  private _findCondition(id: string | null): ConditionRecord | null {
    if (!id) return null;
    return CONDITION_RECORDS.find((c) => c.id === id) ?? null;
  }

  public get usedConditionIds(): string[] {
    if (!this.state) return [];
    return [...this.state.rowConditionIds, ...this.state.columnConditionIds].filter((id): id is string => !!id);
  }

  public get pickerDisabledIds(): string[] {
    return [...this.usedConditionIds, ...this.pickerInvalidIds];
  }

  public get allConditionsSet(): boolean {
    if (!this.state) return false;
    return (
      this.state.rowConditionIds.every((c) => c !== null) && this.state.columnConditionIds.every((c) => c !== null)
    );
  }

  public cellAt(row: number, col: number): CellData | null {
    return this.state?.cells[row][col] ?? null;
  }

  public isWinningCell(row: number, col: number): boolean {
    if (!this.state?.winningLine) return false;
    return this.state.winningLine.some(([r, c]) => r === row && c === col);
  }

  public isWrongGuessCell(row: number, col: number): boolean {
    return this.wrongGuessCell?.row === row && this.wrongGuessCell?.col === col;
  }

  public get player1Wins(): number {
    return this.state?.matchHistory.filter((m) => m.result === 1).length ?? 0;
  }

  public get player2Wins(): number {
    return this.state?.matchHistory.filter((m) => m.result === 2).length ?? 0;
  }

  public get drawCount(): number {
    return this.state?.matchHistory.filter((m) => m.result === 'draw').length ?? 0;
  }

  public get matchHistoryReversed(): MatchHistoryEntry[] {
    return this.state ? this.state.matchHistory.slice().reverse() : [];
  }

  // ---------------------------------------------------------------------
  // Condition picking (same validity logic as local-pvp)
  // ---------------------------------------------------------------------

  public onSelectRowCondition(row: number): void {
    if (!this.state || this.state.phase !== 'conditions' || !this.isMyTurn) return;
    if (this.state.rowConditionIds[row]) return;
    this._openPicker({ axis: 'row', index: row });
  }

  public onSelectColumnCondition(col: number): void {
    if (!this.state || this.state.phase !== 'conditions' || !this.isMyTurn) return;
    if (this.state.columnConditionIds[col]) return;
    this._openPicker({ axis: 'col', index: col });
  }

  private _openPicker(target: Exclude<PickerTarget, null>): void {
    if (this.isLoadingPicker || !this.state) return;
    const oppositeIds = target.axis === 'row' ? this.state.columnConditionIds : this.state.rowConditionIds;
    const oppositeConditions = oppositeIds
      .map((id) => this._findCondition(id))
      .filter((c): c is ConditionRecord => c !== null);

    if (oppositeConditions.length === 0) {
      this.pickerInvalidIds = [];
      this.pickerTarget = target;
      this._cdr.markForCheck();
      return;
    }

    this.isLoadingPicker = true;
    const candidateChecks$ = CONDITION_RECORDS.map((candidate) => {
      const validityChecks$ = oppositeConditions.map((oppCondition) =>
        (target.axis === 'row'
          ? this._gameService.isValidColumnRowCombination(candidate.label, oppCondition.label)
          : this._gameService.isValidColumnRowCombination(oppCondition.label, candidate.label)
        ).pipe(catchError(() => of(false)))
      );
      return forkJoin(validityChecks$).pipe(map((results) => ({ id: candidate.id, isValid: results.every(Boolean) })));
    });

    forkJoin(candidateChecks$).subscribe({
      next: (results) => {
        this.pickerInvalidIds = results.filter((r) => !r.isValid).map((r) => r.id);
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
    this.send({ type: 'pick_condition', axis, index, conditionId: record.id });
    this.pickerTarget = null;
    this.pickerInvalidIds = [];
  }

  public onPickerDismissed(): void {
    this.pickerTarget = null;
    this.pickerInvalidIds = [];
  }

  // ---------------------------------------------------------------------
  // Guessing (same validity logic as local-pvp)
  // ---------------------------------------------------------------------

  public onGuessCell(row: number, col: number): void {
    if (!this.state || this.state.phase !== 'playing' || !this.isMyTurn) return;
    if (this.cellAt(row, col)) return;
    if (!this.state.rowConditionIds[row] || !this.state.columnConditionIds[col]) return;

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
      .filter((c) => c.name.toLowerCase().includes(query))
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
    if (!this.guessTarget || !this.state) return;
    const { row, col } = this.guessTarget;
    const rowCondition = this._findCondition(this.state.rowConditionIds[row]);
    const colCondition = this._findCondition(this.state.columnConditionIds[col]);
    if (!rowCondition || !colCondition) return;

    const query = this.guessInput.trim().toLowerCase();
    if (!query) {
      this.guessError = 'Type a country name.';
      return;
    }

    const match = this._allCountries.find((c) => c.name.toLowerCase() === query);
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

    this._gameService.isCorrectCountryTicTacToe(match.alpha2Code, rowCondition.label, colCondition.label).subscribe({
      next: (isCorrect) => {
        if (isCorrect) {
          this.send({
            type: 'guess_cell',
            row,
            col,
            correct: true,
            country: match.name,
            flag: match.flag,
            flagImage: match.flags.svg,
          });
        } else {
          this.send({ type: 'guess_cell', row, col, correct: false });
        }
        this._cdr.markForCheck();
      },
      error: () => {
        this._cdr.markForCheck();
      },
    });
  }
}