import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { shareReplay } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CONDITION_RECORDS, ConditionRecord } from '../conditions/condition-records';
import { CountriesService } from '../services/countries.service';
import { GameService, BingoConditionMatrix } from '../services/game.service';
import { Country } from '../models/countries.model';

type PlayerNum = 1 | 2 | 3 | 4;
type ScreenState = 'username' | 'menu' | 'join-code' | 'connecting' | 'room' | 'error';
type LocalPhase = 'idle' | 'dealing' | 'playing' | 'ended';
type CellResult = 'correct' | 'wrong' | null;

interface DealtCountry {
  name: string;
  alpha2Code: string;
  alpha3Code: string;
  flag: string;
  flagSvg: string;
}

interface GridCellSpec {
  label: string;
  matchIndex: number;
}

interface GridCell {
  condition: ConditionRecord;
  matchIndex: number;
  placed: DealtCountry | null;
  locked: boolean;
  result: CellResult;
}

interface OtherPlayer {
  playerNum: PlayerNum;
  name: string;
  submitted: boolean;
  score?: number;
}

interface RoundStanding {
  playerNum: PlayerNum;
  score: number;
}

interface MatchHistoryEntry {
  round: number;
  standings: RoundStanding[];
}

interface RoomState {
  type: 'room_state';
  you: PlayerNum;
  connected: number;
  phase: 'waiting' | 'playing';
  roundNumber: number;
  grid: GridCellSpec[];
  deck: DealtCountry[];
  you_submitted: boolean;
  you_score?: number;
  others: OtherPlayer[];
  matchHistory: MatchHistoryEntry[];
  readyCount: number;
  youReady: boolean;
  sessionWins: Record<number, number>;
}

const WS_BASE = 'wss://wavelength-server.vladscuturici.workers.dev';
const API_BASE = 'https://wavelength-server.vladscuturici.workers.dev';
// const WS_BASE = 'ws://127.0.0.1:8787';
// const API_BASE = 'http://127.0.0.1:8787';

export const MAX_USERNAME_LENGTH = 12;
export const MIN_USERNAME_LENGTH = 3;
const MIN_PLAYERS = 2;
const MAX_PLAYERS = 4;

const GRID_SIZE = 4;
const TOTAL_CELLS = GRID_SIZE * GRID_SIZE;
const GAME_DURATION_SECONDS = 180;
const TOTAL_SKIPS = 5;

@Component({
  selector: 'app-countrybingo-online',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './countrybingo-online.component.html',
  styleUrl: './countrybingo-online.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CountrybingoOnlineComponent implements OnInit {
  private _cdr = inject(ChangeDetectorRef);
  private _destroyRef = inject(DestroyRef);
  private _route = inject(ActivatedRoute);
  private _countriesService = inject(CountriesService);
  private _gameService = inject(GameService);

  public screen: ScreenState = 'username';
  public username = '';
  public joinCodeInput = '';
  public errorMessage = '';

  public roomCode = '';
  public socket: WebSocket | null = null;
  public state: RoomState | null = null;

  public countries$ = this._countriesService.getAllCountries().pipe(shareReplay(1));
  private _allCountries: Country[] = [];
  private _matrix: BingoConditionMatrix | null = null;

  public readonly minPlayers = MIN_PLAYERS;
  public readonly maxPlayers = MAX_PLAYERS;
  public readonly totalCells = TOTAL_CELLS;
  public readonly gameDurationSeconds = GAME_DURATION_SECONDS;
  public readonly totalSkips = TOTAL_SKIPS;

  // --- Local, per-player game state (mirrors the singleplayer component) ---
  public localPhase: LocalPhase = 'idle';
  public grid: GridCell[] = [];
  private _deck: DealtCountry[] = [];
  private _dealIndex = 0;
  public currentCountry: DealtCountry | null = null;
  public cardsRemaining = 0;
  public timeRemaining = GAME_DURATION_SECONDS;
  private _timerHandle: ReturnType<typeof setInterval> | null = null;
  public skipsRemaining = TOTAL_SKIPS;
  public correctCount = 0;
  public filledCount = 0;

  public viewingLeaderboard = false;
  private _scoreSubmitted = false;
  private _lastPlayedRound = 0;

  ngOnInit(): void {
    this.countries$.pipe(takeUntilDestroyed(this._destroyRef)).subscribe((countries) => {
      this._allCountries = countries;
      this._cdr.markForCheck();
    });

    this._gameService.getBingoConditionMatrix().pipe(takeUntilDestroyed(this._destroyRef)).subscribe({
      next: (matrix) => {
        this._matrix = matrix;
        this._cdr.markForCheck();
      },
      error: (err) => console.error('Failed to load bingo condition matrix', err),
    });

    const codeFromUrl = this._route.snapshot.paramMap.get('code');
    if (codeFromUrl) {
      this.joinCodeInput = codeFromUrl.toUpperCase();
    }

    this._destroyRef.onDestroy(() => {
      this.socket?.close();
      this._clearTimer();
    });
  }

  // --- Username / menu flow -------------------------------------------------

  public confirmUsername(): void {
    const trimmed = this.username.trim();
    if (trimmed.length < MIN_USERNAME_LENGTH) return;
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

  public get usernameTooShort(): boolean {
    return this.username.trim().length > 0 && this.username.trim().length < MIN_USERNAME_LENGTH;
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
      const res = await fetch(`${API_BASE}/countrybingo/room`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to create room');
      const data = await res.json();
      this.roomCode = data.code;
      this.connectSocket(this.roomCode);
    } catch {
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
    const ws = new WebSocket(`${WS_BASE}/countrybingo/room/${code}/ws?name=${name}`);

    ws.onopen = () => {
      this.socket = ws;
      this.screen = 'room';
      this._cdr.markForCheck();
    };

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.type === 'room_state') {
        this.handleRoomState(msg);
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

  private normalizeRoomState(raw: any): RoomState {
    return {
      type: 'room_state',
      you: raw.you,
      connected: raw.connected ?? 0,
      phase: raw.phase === 'playing' ? 'playing' : 'waiting',
      roundNumber: raw.roundNumber ?? 0,
      grid: Array.isArray(raw.grid) ? raw.grid : [],
      deck: Array.isArray(raw.deck) ? raw.deck : [],
      you_submitted: !!raw.you_submitted,
      you_score: raw.you_score,
      others: Array.isArray(raw.others) ? raw.others : [],
      matchHistory: Array.isArray(raw.matchHistory) ? raw.matchHistory : [],
      readyCount: raw.readyCount ?? 0,
      youReady: !!raw.youReady,
      sessionWins: raw.sessionWins && typeof raw.sessionWins === 'object' ? raw.sessionWins : {},
    };
  }

  private handleRoomState(rawNext: any): void {
    try {
      const next = this.normalizeRoomState(rawNext);
      this.state = next;

      const isNewRound = next.phase === 'playing' && next.roundNumber !== this._lastPlayedRound;
      if (isNewRound && next.grid.length === TOTAL_CELLS) {
        this._startLocalRound(next);
      }

      this._cdr.markForCheck();
    } catch (err) {
      console.error('[countrybingo] state error', err, rawNext);
    }
  }

  private showError(message: string): void {
    this.errorMessage = message;
    this.screen = 'error';
    this.socket?.close();
    this.socket = null;
    this._cdr.markForCheck();
  }

  private send(payload: unknown): void {
    this.socket?.send(JSON.stringify(payload));
  }

  // --- Ready voting ------------------------------------------------------------

  private buildCountryPool(): DealtCountry[] {
    return this._allCountries.map((c) => ({
      name: c.name,
      alpha2Code: c.alpha2Code,
      alpha3Code: c.alpha3Code,
      flag: c.flag,
      flagSvg: c.flags.svg,
    }));
  }

  public get canReady(): boolean {
    return !!this.state && this.state.connected >= MIN_PLAYERS;
  }

  /** True once the room is actually ready to deal a new round (everyone has finished the last one, if any). */
  public get readyActionable(): boolean {
    return !!this.state && this.state.phase === 'waiting';
  }

  public toggleReady(): void {
    if (!this.state) return;
    if (this.state.youReady) {
      this.send({ type: 'unready' });
    } else {
      this.send({
        type: 'ready',
        countries: this.buildCountryPool(),
        matrix: this._matrix,
      });
    }
  }

  // --- Local round lifecycle (mirrors the singleplayer component) --------------

  private _startLocalRound(next: RoomState): void {
    this._clearTimer();
    this._lastPlayedRound = next.roundNumber;
    this.viewingLeaderboard = false;
    this._scoreSubmitted = false;

    this.grid = next.grid.map((spec) => ({
      condition: CONDITION_RECORDS.find((r) => r.label === spec.label)!,
      matchIndex: spec.matchIndex,
      placed: null,
      locked: false,
      result: null,
    }));

    this._deck = next.deck;
    this._dealIndex = 0;
    this.currentCountry = null;
    this.skipsRemaining = TOTAL_SKIPS;
    this.correctCount = 0;
    this.filledCount = 0;

    this.localPhase = 'dealing';
    this._cdr.markForCheck();

    // Grid/deck arrive fully formed from the server — no async assembly needed,
    // but we keep a brief 'dealing' beat for visual consistency with singleplayer.
    setTimeout(() => {
      this.localPhase = 'playing';
      this._startTimer();
      this._dealNext();
    }, 250);
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
        this._endLocalRound();
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

  private _dealNext(): void {
    if (this._dealIndex >= this._deck.length) {
      this.currentCountry = null;
      this._endLocalRound();
      return;
    }
    this.currentCountry = this._deck[this._dealIndex];
    this._dealIndex++;
    this.cardsRemaining = this._deck.length - this._dealIndex;
    this._cdr.markForCheck();
  }

  public onPlaceCurrent(cellIndex: number): void {
    if (this.localPhase !== 'playing' || !this.currentCountry) return;
    const cell = this.grid[cellIndex];
    if (cell.locked) return;

    cell.placed = this.currentCountry;
    cell.locked = true;
    this.filledCount++;

    if (this.filledCount >= this.totalCells) {
      this.currentCountry = null;
      this._endLocalRound();
      return;
    }

    this._dealNext();
  }

  public onSkipCurrent(): void {
    if (this.localPhase !== 'playing' || !this.currentCountry) return;
    this._dealNext();
  }

  private _endLocalRound(): void {
    this._clearTimer();
    this.localPhase = 'ended';
    this.correctCount = 0;

    this.grid.forEach((cell) => {
      if (!cell.placed) {
        cell.result = 'wrong';
        return;
      }
      const matches = this._matrix?.matches[cell.matchIndex] ?? [];
      const isCorrect = matches.includes(cell.placed.alpha2Code);
      cell.result = isCorrect ? 'correct' : 'wrong';
      if (isCorrect) this.correctCount++;
    });

    if (!this._scoreSubmitted) {
      this._scoreSubmitted = true;
      this.send({ type: 'submit_score', score: this.correctCount });
    }

    this._cdr.markForCheck();
  }

  public onSeeLeaderboard(): void {
    this.viewingLeaderboard = true;
    this._cdr.markForCheck();
  }

  // --- Template helpers --------------------------------------------------------

  /** Single ranked table: name, this round's score (or '-' until that player
   *  finishes), and overall rounds won — sorted by wins descending. Uses the
   *  live submitted/score fields (not matchHistory) so scores appear as each
   *  player finishes, not only once everyone has. */
  public get leaderboardRows(): { playerNum: PlayerNum; name: string; roundLabel: string; wins: number }[] {
    if (!this.state) return [];
    const wins = this.state.sessionWins ?? {};

    const rows = this.allSeats.map((seat) => {
      let roundLabel = '-';
      if (seat.isYou) {
        roundLabel = this.state!.you_submitted ? `${this.state!.you_score ?? 0}/${this.totalCells}` : '-';
      } else {
        const other = this.state!.others.find((o) => o.playerNum === seat.playerNum);
        roundLabel = other?.submitted ? `${other.score ?? 0}/${this.totalCells}` : '-';
      }
      return {
        playerNum: seat.playerNum,
        name: seat.name,
        roundLabel,
        wins: wins[seat.playerNum] ?? 0,
      };
    });

    return rows.sort((a, b) => b.wins - a.wins);
  }

  public get allSeats(): { playerNum: PlayerNum; name: string; isYou: boolean }[] {
    if (!this.state) return [];
    const seats = [
      { playerNum: this.state.you, name: this.username || 'You', isYou: true },
      ...this.state.others.map((o) => ({ playerNum: o.playerNum, name: o.name, isYou: false })),
    ];
    return seats.sort((a, b) => a.playerNum - b.playerNum);
  }

  public emptySeats(): number[] {
    if (!this.state) return [];
    const count = Math.max(this.maxPlayers - this.state.connected, 0);
    return Array.from({ length: count }, (_, i) => i);
  }

  public nameForPlayer(num: PlayerNum): string {
    if (this.state?.you === num) return this.username || 'You';
    return this.state?.others.find((o) => o.playerNum === num)?.name ?? `Player ${num}`;
  }

  public toGreenSaturation(score: number, max: number = this.totalCells): string {
    const ratio = max > 0 ? Math.min(Math.max(score / max, 0), 1) : 0;
    const lightness = 100 - ratio * 60;
    return `hsl(120, 70%, ${lightness}%)`;
  }

  public copyRoomLink(): void {
    const link = `${window.location.origin}${window.location.pathname}/room/${this.roomCode}`;
    navigator.clipboard?.writeText(link);
  }
}