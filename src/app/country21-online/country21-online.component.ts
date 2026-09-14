import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, ElementRef, inject, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { shareReplay } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Country } from '../models/countries.model';
import { CountriesService } from '../services/countries.service';

type Phase = 'waiting' | 'playing' | 'finished';
type PlayerNum = 1 | 2 | 3 | 4;
type ScreenState = 'username' | 'menu' | 'join-code' | 'connecting' | 'room' | 'error';

interface CountryCard {
  name: string;
  population: number;
  flagSvg: string;
  alpha3Code: string;
}

interface OtherPlayer {
  playerNum: PlayerNum;
  name: string;
  cardCount: number;
  locked: boolean;
  sum?: number;
  threshold?: number;
  busted?: boolean;
  score?: number;
}

interface MatchHistoryEntry {
  round: number;
  standings: { playerNum: PlayerNum; score: number; busted: boolean }[];
}

interface RoomState {
  type: 'room_state';
  you: PlayerNum;
  connected: number;
  phase: Phase;
  roundNumber: number;
  totalRounds: number;
  gameOver: boolean;
  cardsRemainingInOffer: number;
  currentOffer: CountryCard | null;
  currentDecider: PlayerNum | null;
  you_hand: CountryCard[];
  you_sum: number;
  you_threshold: number;
  you_locked: boolean;
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

@Component({
  selector: 'app-country21-online',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './country21-online.component.html',
  styleUrl: './country21-online.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Country21OnlineComponent implements OnInit {
  private _cdr = inject(ChangeDetectorRef);
  private _destroyRef = inject(DestroyRef);
  private _route = inject(ActivatedRoute);
  private _countriesService = inject(CountriesService);

  public screen: ScreenState = 'username';
  public username = '';
  public joinCodeInput = '';
  public errorMessage = '';

  public roomCode = '';
  public socket: WebSocket | null = null;
  public state: RoomState | null = null;

  public countries$ = this._countriesService.getAllCountries().pipe(shareReplay(1));
  private _allCountries: Country[] = [];

  // Only used to briefly animate the "just taken" card in your own hand.
  public justTakenName: string | null = null;
  private _justTakenTimeout: ReturnType<typeof setTimeout> | null = null;

  // Small in-round log of "X took Y" / "X passed" / "Y was discarded" lines.
  // The server only ever sends a full state snapshot, not discrete events,
  // so these are inferred by diffing each new snapshot against the last one.
  public gameLog: string[] = [];

  // Drives the offer card's "leaving" animation: down if you took it,
  // right if someone else did. Purely cosmetic, derived the same way.
  public offerLeavingCard: CountryCard | null = null;
  public offerLeavingDirection: 'down' | 'right' | null = null;
  private _offerLeaveTimeout: ReturnType<typeof setTimeout> | null = null;

  public readonly minPlayers = MIN_PLAYERS;
  public readonly maxPlayers = MAX_PLAYERS;

  @ViewChild('gameLogList') private _gameLogListRef?: ElementRef<HTMLElement>;
  @ViewChild('handCardsList') private _handCardsListRef?: ElementRef<HTMLElement>;

  ngOnInit(): void {
    this.countries$.pipe(takeUntilDestroyed(this._destroyRef)).subscribe((countries) => {
      this._allCountries = countries.filter((c) => typeof c.population === 'number' && c.population > 0);
      this._cdr.markForCheck();
    });

    const codeFromUrl = this._route.snapshot.paramMap.get('code');
    if (codeFromUrl) {
      this.joinCodeInput = codeFromUrl.toUpperCase();
    }

    this._destroyRef.onDestroy(() => {
      this.socket?.close();
      if (this._justTakenTimeout) clearTimeout(this._justTakenTimeout);
      if (this._offerLeaveTimeout) clearTimeout(this._offerLeaveTimeout);
    });
  }

  private _scrollHandToEnd(): void {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const el = this._handCardsListRef?.nativeElement;
        if (el) el.scrollTo({ left: el.scrollWidth, behavior: 'smooth' });
      });
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
      const res = await fetch(`${API_BASE}/country21/room`, { method: 'POST' });
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
    const ws = new WebSocket(`${WS_BASE}/country21/room/${code}/ws?name=${name}`);

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

  /**
   * The server payload should always include these arrays, but we normalize
   * defensively so a stale/partial message (e.g. an older cached room state,
   * or a schema mismatch during dev) can't crash the client mid-round.
   */
  private normalizeRoomState(raw: any): RoomState {
    return {
      type: 'room_state',
      you: raw.you,
      connected: raw.connected ?? 0,
      phase: raw.phase ?? 'waiting',
      roundNumber: raw.roundNumber ?? 0,
      totalRounds: raw.totalRounds ?? 6,
      gameOver: !!raw.gameOver,
      cardsRemainingInOffer: raw.cardsRemainingInOffer ?? 0,
      currentOffer: raw.currentOffer ?? null,
      currentDecider: raw.currentDecider ?? null,
      you_hand: Array.isArray(raw.you_hand) ? raw.you_hand : [],
      you_sum: raw.you_sum ?? 0,
      you_threshold: raw.you_threshold ?? 0,
      you_locked: !!raw.you_locked,
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
      const prev = this.state;
      const prevHandLen = prev?.you_hand.length ?? 0;
      const isFirstState = prev === null; // NEW
      this.state = next;

      this._updateGameLog(prev, next);
      this._updateOfferAnimation(prev, next);

      if (isFirstState) {
        this._scrollLogToBottom(); // NEW — handles rejoining a room with existing log/history
      }

      if (next.you_hand.length > prevHandLen) {
        const newest = next.you_hand[next.you_hand.length - 1];
        this.justTakenName = newest?.name ?? null;
        this._scrollHandToEnd(); // NEW
        if (this._justTakenTimeout) clearTimeout(this._justTakenTimeout);
        this._justTakenTimeout = setTimeout(() => {
          this.justTakenName = null;
          this._cdr.markForCheck();
        }, 900);
      }

      this._cdr.markForCheck();
    } catch (err) {
      console.error('[country21] template/state error', err, rawNext);
    }
  }

  /**
   * Infers take/pass/discard events by diffing consecutive room_state
   * snapshots (the server only ever broadcasts full state, never discrete
   * events) and appends short lines to the small in-round log. The log
   * resets whenever a new round starts.
   */
  private _updateGameLog(prev: RoomState | null, next: RoomState): void {
    if (!prev || next.roundNumber !== prev.roundNumber) {
      this.gameLog = [];
      this._scrollLogToBottom();
      return;
    }
    if (next.phase !== 'playing') return; // only narrate live play, not round-end transitions

    const offerChanged = (prev.currentOffer?.name ?? null) !== (next.currentOffer?.name ?? null);

    if (offerChanged && prev.currentOffer) {
      const takerName = this._findTaker(prev, next);
      if (takerName) {
        this._pushLog(`${takerName} took ${prev.currentOffer.name}`);
      } else {
        if (prev.currentDecider) {
          this._pushLog(`${this.nameForPlayer(prev.currentDecider)} passed`);
        }
        this._pushLog(`${prev.currentOffer.name} was discarded`);
      }
    } else if (
      !offerChanged &&
      prev.currentDecider &&
      next.currentDecider &&
      prev.currentDecider !== next.currentDecider
    ) {
      // Same card still up, but the turn moved on — the previous decider passed.
      this._pushLog(`${this.nameForPlayer(prev.currentDecider)} passed`);
    }

    // Lock-ins can happen independently of the offer/decider changing.
    if (!prev.you_locked && next.you_locked) {
      this._pushLog(`${this.username || 'You'} locked in`);
    }
    for (const o of next.others) {
      const prevOther = prev.others.find((p) => p.playerNum === o.playerNum);
      if (prevOther && !prevOther.locked && o.locked) {
        this._pushLog(`${o.name} locked in`);
      }
    }
  }

  /** Whoever's hand/card-count grew is who took the previous offer card. */
  private _findTaker(prev: RoomState, next: RoomState): string | null {
    if (next.you_hand.length > prev.you_hand.length) {
      return this.username || 'You';
    }
    for (const o of next.others) {
      const prevOther = prev.others.find((p) => p.playerNum === o.playerNum);
      if (prevOther && o.cardCount > prevOther.cardCount) {
        return o.name;
      }
    }
    return null;
  }

  private _pushLog(entry: string): void {
    this.gameLog = [...this.gameLog, entry].slice(-40);
    this._scrollLogToBottom();
  }

  private _scrollLogToBottom(): void {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const el = this._gameLogListRef?.nativeElement;
        if (el) el.scrollTop = el.scrollHeight;
      });
    });
  }

  /**
   * Drives the offer card's "leaving" animation: down if you took it, right
   * if someone else did. The authoritative state has already moved on by
   * the time this fires, so this just briefly overlays the old card on top
   * of the new one while it animates out.
   */
  private _updateOfferAnimation(prev: RoomState | null, next: RoomState): void {
    if (!prev || next.roundNumber !== prev.roundNumber || next.phase !== 'playing') return;
    if (!prev.currentOffer) return;
    const offerChanged = prev.currentOffer.name !== (next.currentOffer?.name ?? null);
    if (!offerChanged) return;

    const takenByYou = next.you_hand.length > prev.you_hand.length;
    const takenByOther = !takenByYou && this._findTaker(prev, next) !== null;
    if (!takenByYou && !takenByOther) return; // discarded — nothing flies off screen

    this.offerLeavingCard = prev.currentOffer;
    this.offerLeavingDirection = takenByYou ? 'down' : 'right';

    if (this._offerLeaveTimeout) clearTimeout(this._offerLeaveTimeout);
    this._offerLeaveTimeout = setTimeout(() => {
      this.offerLeavingCard = null;
      this.offerLeavingDirection = null;
      this._cdr.markForCheck();
    }, 560);
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

  // --- Game actions ----------------------------------------------------------

  private buildCountryPool(): CountryCard[] {
    return this._allCountries.map((c) => ({
      name: c.name,
      population: c.population,
      flagSvg: c.flags.svg,
      alpha3Code: c.alpha3Code,
    }));
  }

  /** Ready-up is usable from the lobby and from the finished/results screen. */
  public get canReady(): boolean {
    return !!this.state && this.state.connected >= MIN_PLAYERS;
  }

  public toggleReady(): void {
    if (!this.state) return;
    if (this.state.youReady) {
      this.send({ type: 'unready' });
    } else {
      this.send({ type: 'ready', countries: this.buildCountryPool() });
    }
  }

  public take(): void {
    this.send({ type: 'take' });
  }

  public pass(): void {
    this.send({ type: 'pass' });
  }

  public lockIn(): void {
    this.send({ type: 'lock_in' });
  }

  // --- Template helpers --------------------------------------------------------

  public get isMyTurn(): boolean {
    return !!this.state && this.state.phase === 'playing' && this.state.currentDecider === this.state.you;
  }

  public get lockedInWaitingRoom(): boolean {
    return !this.state || this.state.phase === 'waiting';
  }

  /** All seats (you + others), sorted by player number, for lobby & reveal lists. */
  public get allSeats(): { playerNum: PlayerNum; name: string; isYou: boolean }[] {
    if (!this.state) return [];
    const seats = [
      { playerNum: this.state.you, name: this.username || 'You', isYou: true },
      ...this.state.others.map((o) => ({ playerNum: o.playerNum, name: o.name, isYou: false })),
    ];
    return seats.sort((a, b) => a.playerNum - b.playerNum);
  }

  /** Safe helper for the lobby's "waiting for player…" placeholder slots. */
  public emptySeats(): number[] {
    if (!this.state) return [];
    const count = Math.max(this.maxPlayers - this.state.connected, 0);
    return Array.from({ length: count }, (_, i) => i);
  }

  public sumForPlayer(num: PlayerNum): number {
    if (this.state?.you === num) return this.state.you_sum;
    return this.otherByNum(num)?.sum ?? 0;
  }

  public thresholdForPlayer(num: PlayerNum): number {
    if (this.state?.you === num) return this.state.you_threshold;
    return this.otherByNum(num)?.threshold ?? 0;
  }

  public otherByNum(num: PlayerNum): OtherPlayer | undefined {
    return this.state?.others.find((o) => o.playerNum === num);
  }

  /** This round's standings, sorted (already sorted server-side by score desc). */
  public get latestStandings(): MatchHistoryEntry['standings'] {
    const history = this.state?.matchHistory ?? [];
    return history.length > 0 ? history[history.length - 1].standings : [];
  }

  /** Cumulative points per player across the rounds played so far *this match*. */
  public get currentGameStandings(): { playerNum: PlayerNum; total: number }[] {
    const totals = new Map<PlayerNum, number>();
    for (const entry of this.state?.matchHistory ?? []) {
      for (const s of entry.standings) {
        totals.set(s.playerNum, (totals.get(s.playerNum) ?? 0) + s.score);
      }
    }
    return [...totals.entries()]
      .map(([playerNum, total]) => ({ playerNum, total }))
      .sort((a, b) => b.total - a.total);
  }

  /**
   * The constant during-game sidebar table: name, this round's points
   * (or '–' before any round has finished), and running total, ranked by
   * total descending. Falls back to every seated player at 0/'–' before
   * round 1 has finished (matchHistory is still empty at that point).
   */
  public get currentGameTable(): { playerNum: PlayerNum; roundLabel: string; total: number }[] {
    if (!this.state) return [];
    if (this.state.matchHistory.length === 0) {
      return this.allSeats.map((s) => ({ playerNum: s.playerNum, roundLabel: '–', total: 0 }));
    }
    const showLatestRound = this.state.phase === 'finished';
    const latest = this.latestStandings;
    return this.currentGameStandings.map((t) => {
      const entry = showLatestRound ? latest.find((s) => s.playerNum === t.playerNum) : undefined;
      const roundLabel = entry ? (entry.busted ? '✗' : String(entry.score)) : '–';
      return { playerNum: t.playerNum, total: t.total, roundLabel };
    });
  }

  /**
   * Games won per player across this room's whole session. Iterates over
   * every currently seated player (not just Object.keys(sessionWins)) so
   * players with zero wins still show up on the board, at 0.
   */
  public get overallStandings(): { playerNum: PlayerNum; wins: number }[] {
    const wins = this.state?.sessionWins ?? {};
    const seatNums = this.allSeats.map((s) => s.playerNum);
    return seatNums
      .map((playerNum) => ({ playerNum, wins: wins[playerNum] ?? 0 }))
      .sort((a, b) => b.wins - a.wins);
  }

  public get maxSessionWins(): number {
    return Math.max(1, ...this.overallStandings.map((s) => s.wins));
  }

  public nameForPlayer(num: PlayerNum): string {
    if (this.state?.you === num) return this.username || 'You';
    return this.state?.others.find((o) => o.playerNum === num)?.name ?? `Player ${num}`;
  }

  public get handSumRatio(): number {
    if (!this.state || this.state.you_threshold <= 0) return 0;
    return Math.min(this.state.you_sum / this.state.you_threshold, 1.15);
  }

  public get resultFillPercent(): number {
    if (!this.state || this.state.you_threshold <= 0) return 0;
    const ratio = this.state.you_sum / this.state.you_threshold;
    return Math.min(Math.max(ratio, 0), 1) * 100;
  }

  public get youBusted(): boolean {
    return !!this.state && this.state.you_sum > this.state.you_threshold;
  }

  public get youScore(): number | undefined {
    const mine = this.latestStandings.find((s) => s.playerNum === this.state?.you);
    return mine?.score;
  }

  /**
   * Same "round to a clean displayed figure" behaviour as the single-player
   * mode — the server gives us an exact integer threshold, this just rounds
   * it for display the identical way local mode rounds its own threshold.
   */
  private _roundToDisplayedPrecision(v: number): number {
    const abs = Math.abs(v);
    if (abs >= 1_000_000_000) return Math.round(v / 100_000_000) * 100_000_000;
    if (abs >= 1_000_000) return Math.round(v / 1_000_000) * 1_000_000;
    if (abs >= 1_000) return Math.round(v / 1_000) * 1_000;
    if (abs >= 100) return Math.round(v / 100) * 100;
    return Math.round(v);
  }

  public get displayedThreshold(): number {
    return this.state ? this._roundToDisplayedPrecision(this.state.you_threshold) : 0;
  }

  public toGreenSaturation(score: number): string {
    const ratio = Math.min(Math.max(score / 100, 0), 1);
    const lightness = 100 - ratio * 60;
    return `hsl(120, 70%, ${lightness}%)`;
  }

  /** Same color ramp, but against a caller-supplied max instead of a fixed 100. */
  public toGreenSaturationRatio(value: number, max: number): string {
    const ratio = max > 0 ? Math.min(Math.max(value / max, 0), 1) : 0;
    const lightness = 100 - ratio * 60;
    return `hsl(120, 70%, ${lightness}%)`;
  }

  /** Population formatting for the card-back reveal, matching local mode's style. */
  public formatPopulation(value: number): string {
    const abs = Math.abs(value);
    if (abs >= 1_000_000_000) return (value / 1_000_000_000).toFixed(1) + 'B';
    if (abs >= 1_000_000) return Math.round(value / 1_000_000) + 'M';
    if (abs >= 1_000) return Math.round(value / 1_000) + 'K';
    if (abs >= 100) return (value / 1_000).toFixed(1) + 'K';
    return Math.round(value).toString();
  }

  public copyRoomLink(): void {
    const link = `${window.location.origin}${window.location.pathname}/room/${this.roomCode}`;
    navigator.clipboard?.writeText(link);
  }
}