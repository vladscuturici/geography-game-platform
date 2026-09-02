import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormControl } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { Observable, combineLatest, map, shareReplay, startWith } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Country } from '../models/countries.model';
import { CountriesService } from '../services/countries.service';
import { WavelengthWheelComponent } from '../wavelength-wheel/wavelength-wheel.component';

type RoundPhase = 'waiting' | 'psychic' | 'guesser' | 'reveal';
type ScreenState = 'username' | 'menu' | 'join-code' | 'connecting' | 'room' | 'error';

interface WavelengthCategory {
  id: string;
  title: string;
  leftLabel: string;
  rightLabel: string;
}

interface RoundResult {
  round: number;
  category: string;
  country: string;
  points: number;
  psychicPlayer: 1 | 2;
}

interface GameResult {
  game: number;
  score: number;
}

interface RoomState {
  type: 'room_state';
  you: 1 | 2;
  connected: number;
  round: number;
  totalRounds: number;
  psychicPlayer: 1 | 2;
  phase: RoundPhase;
  category: WavelengthCategory;
  target: number | null;
  lockedCountry: string;
  lockedGuess: number | null;
  lastPoints: number;
  teamScore: number;
  history: RoundResult[];
  gameOver: boolean;
  player1Name: string;
  player2Name: string;
  nextRoundReadyCount: number;
  playAgainReadyCount: number;
  youReadyForNextRound: boolean;
  youReadyForPlayAgain: boolean;
  gameHistory: GameResult[];
}

const WS_BASE = 'wss://wavelength-server.vladscuturici.workers.dev';
const API_BASE = 'https://wavelength-server.vladscuturici.workers.dev';
export const MAX_USERNAME_LENGTH = 12;
export const MIN_USERNAME_LENGTH = 3;

@Component({
  selector: 'app-wavelength-online',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RouterModule,
    MatButtonModule,
    MatInputModule,
    MatFormFieldModule,
    MatAutocompleteModule,
    WavelengthWheelComponent,
  ],
  templateUrl: './wavelength-online.component.html',
  styleUrl: './wavelength-online.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WavelengthOnlineComponent implements OnInit {
  private _cdr = inject(ChangeDetectorRef);
  private _destroyRef = inject(DestroyRef);
  private _route = inject(ActivatedRoute);
  private _router = inject(Router);
  private _countriesService = inject(CountriesService);

  public screen: ScreenState = 'username';
  public username = '';
  public joinCodeInput = '';
  public errorMessage = '';

  public roomCode = '';
  public socket: WebSocket | null = null;
  public state: RoomState | null = null;

  public needleValue = 50;
  public coverValue = 0;
  private coverAnimId: number | null = null;

  public countries$ = this._countriesService.getAllCountries().pipe(shareReplay(1));
  public countryControl = new FormControl<Country | null>(null);
  public filteredCountries$!: Observable<Country[]>;

  // Flat cache of all countries, kept in sync with countries$, so we can
  // look up flag/details for the locked country by name (the server only
  // sends us the country name string, not the full Country object).
  private _allCountries: Country[] = [];

  public displayFn(country: Country): string {
    return country?.name ?? '';
  }

  private _filterCountries(countries: Country[], value: string | Country | null): Country[] {
    const filterValue = (typeof value === 'string' ? value : value?.name ?? '').toLowerCase();
    return countries.filter((country) => country.name.toLowerCase().includes(filterValue));
  }

  ngOnInit(): void {
    this.filteredCountries$ = combineLatest([
      this.countries$,
      this.countryControl.valueChanges.pipe(startWith('')),
    ]).pipe(
      map(([countries, filterValue]) => this._filterCountries(countries, filterValue)),
      takeUntilDestroyed(this._destroyRef)
    );

    this.countries$
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe((countries) => {
        this._allCountries = countries;
        this._cdr.markForCheck();
      });

    const codeFromUrl = this._route.snapshot.paramMap.get('code');
    if (codeFromUrl) {
      this.joinCodeInput = codeFromUrl.toUpperCase();
    }
    this._destroyRef.onDestroy(() => {
      this.socket?.close();
      if (this.coverAnimId !== null) cancelAnimationFrame(this.coverAnimId);
    });
  }

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
      const res = await fetch(`${API_BASE}/room`, { method: 'POST' });
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
    const ws = new WebSocket(`${WS_BASE}/room/${code}/ws?name=${name}`);

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

  public displayState: RoomState | null = null;

  private handleRoomState(next: RoomState): void {
    const prevPhase = this.state?.phase;
    this.state = next;
    const iAmPsychic = next.you === next.psychicPlayer;

    if (next.phase === 'psychic' && prevPhase !== 'psychic') {
      this.countryControl.reset();
      this.needleValue = 50;
    }
    if (next.phase === 'reveal' && prevPhase !== 'reveal' && next.lockedGuess !== null) {
      this.needleValue = next.lockedGuess;
    }

    if (prevPhase !== next.phase) {
      if (next.phase === 'waiting') {
        // Not enough players yet — nothing sensitive to hide, show immediately.
        if (this.coverAnimId !== null) cancelAnimationFrame(this.coverAnimId);
        this.coverValue = 0;
        this.displayState = next;
      } else if (next.phase === 'psychic') {
        if (prevPhase === undefined || prevPhase === 'waiting') {
          // First real round starting (either just connected, or the room just
          // filled up) — no meaningful prior cover state to animate from.
          if (this.coverAnimId !== null) cancelAnimationFrame(this.coverAnimId);
          this.coverValue = iAmPsychic ? 0 : 100;
          this.displayState = next;
        } else if (iAmPsychic) {
          this.animateCover(0, 100, 300, () => {
            this.displayState = this.state;
            this._cdr.markForCheck();
            this.animateCover(100, 0, 450);
          });
        } else {
          this.animateCover(0, 100, 650, () => {
            this.displayState = this.state;
            this._cdr.markForCheck();
          });
        }
      } else if (next.phase === 'guesser') {
        if (iAmPsychic) {
          this.animateCover(0, 100);
        } else {
          this.displayState = next;
        }
      } else if (next.phase === 'reveal') {
        this.displayState = next;
        this.animateCover(100, 0);
      }
    } else {
      this.displayState = next;
    }

    this._cdr.markForCheck();
  }

  public get wheelPhase(): 'psychic' | 'guesser' | 'reveal' {
    if (!this.state) return 'psychic';
    if (this.state.phase === 'reveal') return 'reveal';
    if (this.state.phase === 'guesser' && !this.isPsychic) return 'guesser';
    return 'psychic';
  }

  public get wheelTarget(): number {
    return this.state?.target ?? 50;
  }

  private animateCover(from: number, to: number, duration = 650, onComplete?: () => void): void {
    if (this.coverAnimId !== null) cancelAnimationFrame(this.coverAnimId);
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      this.coverValue = from + (to - from) * eased;
      this._cdr.markForCheck();
      if (t < 1) {
        this.coverAnimId = requestAnimationFrame(step);
      } else {
        this.coverAnimId = null;
        onComplete?.();
      }
    };
    this.coverAnimId = requestAnimationFrame(step);
  }

  private showError(message: string): void {
    this.errorMessage = message;
    this.screen = 'error';
    this.socket?.close();
    this.socket = null;
    this._cdr.markForCheck();
  }

  public get isPsychic(): boolean {
    return !!this.state && this.state.you === this.state.psychicPlayer;
  }

  public get psychicName(): string {
    if (!this.state) return '';
    return this.state.psychicPlayer === 1 ? this.state.player1Name : this.state.player2Name;
  }

  public get guesserName(): string {
    if (!this.state) return '';
    return this.state.psychicPlayer === 1 ? this.state.player2Name : this.state.player1Name;
  }

  // The full Country object for the currently locked-in country, looked up
  // by name from the cached country list. Used to show the flag mini-tile.
  public get lockedCountryObj(): Country | undefined {
    const name = this.displayState?.lockedCountry;
    if (!name) return undefined;
    return this._allCountries.find((c) => c.name === name);
  }

  public onNeedleChange(value: number): void {
    this.needleValue = Math.min(100, Math.max(0, value));
  }

  public confirmCountry(): void {
    const value = this.countryControl.value;
    // Require an actual selected Country object — a raw typed string (never
    // matched to a suggestion) is not accepted, even on Enter.
    if (!value || typeof value === 'string') return;
    this.send({ type: 'lock_country', country: value.name });
  }

  public get hasValidCountrySelected(): boolean {
    const value = this.countryControl.value;
    return !!value && typeof value !== 'string';
  }

  public onEnterKey(): void {
    setTimeout(() => this.confirmCountry());
  }

  public confirmGuess(): void {
    this.send({ type: 'lock_guess', value: this.needleValue });
  }

  public nextRound(): void {
    this.send({ type: 'next_round' });
  }

  public playAgain(): void {
    this.send({ type: 'play_again' });
  }

  private send(payload: unknown): void {
    this.socket?.send(JSON.stringify(payload));
  }

  public copyRoomLink(): void {
    const link = `${window.location.origin}${window.location.pathname}#/wavelength/online/room/${this.roomCode}`;
    navigator.clipboard?.writeText(link);
  }

  public get roundsMaxScore(): number {
    return (this.state?.history.length ?? 0) * 5;
  }

  public pointsColor(points: number): string {
    if (points === 0) return '#9aa0ab'; // light gray
    const clamped = Math.min(Math.max(points, 0), 5);
    const hue = (clamped / 5) * 120; // red(0) -> green(120)
    return `hsl(${hue}, 65%, 62%)`;
  }

  public toGreenSaturation(points: number): string {
    const clamped = Math.min(Math.max((points / 5) * 100, 0), 100);
    const lightness = 100 - (clamped / 100) * 60;
    return `hsl(120, 70%, ${lightness}%)`;
  }
}