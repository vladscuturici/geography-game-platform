import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormControl } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { Observable, combineLatest, map, shareReplay, startWith } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Country } from '../models/countries.model';
import { CountriesService } from '../services/countries.service';
import { WavelengthCategory, pickRandomCategory } from '../categories/wavelength.categories';

type RoundPhase = 'psychic' | 'guesser' | 'reveal';

interface RoundResult {
  round: number;
  category: string;
  country: string;
  points: number;
  psychicPlayer: number;
}

const TOTAL_ROUNDS = 6;
const RED_WIDTH = 5;
const GREEN_WIDTH = 12;
const YELLOW_WIDTH = 20;

@Component({
  selector: 'app-wavelength',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
    MatAutocompleteModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
  ],
  templateUrl: './wavelength.component.html',
  styleUrl: './wavelength.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WavelengthComponent implements OnInit {
  private _countriesService = inject(CountriesService);
  private _destroyRef = inject(DestroyRef);
  private _cdr = inject(ChangeDetectorRef);

  // --- Country combobox (matches daily-country) ---
  public countries$ = this._countriesService.getAllCountries().pipe(shareReplay(1));
  public countryControl = new FormControl<Country | null>(null);
  public filteredCountries$!: Observable<Country[]>;
  public coverValue = 0;
  private coverAnimId: number | null = null;

  public displayFn(country: Country): string {
    return country?.name ?? '';
  }

  private _filterCountries(countries: Country[], value: string | Country | null): Country[] {
    const filterValue = (typeof value === 'string' ? value : value?.name ?? '').toLowerCase();
    return countries.filter((country) => country.name.toLowerCase().includes(filterValue));
  }

  // --- Game state ---
  public round = 1;
  public currentPlayer: 1 | 2 = 1;
  public phase: RoundPhase = 'psychic';
  public category: WavelengthCategory = pickRandomCategory();
  public target = 50;

  public lockedCountry = '';

  public needleValue = 50;
  public lockedGuess: number | null = null;
  public lastPoints = 0;

  public teamScore = 0;
  public history: RoundResult[] = [];
  public gameOver = false;

  ngOnInit(): void {
    this.filteredCountries$ = combineLatest([
      this.countries$,
      this.countryControl.valueChanges.pipe(startWith('')),
    ]).pipe(
      map(([countries, filterValue]) => this._filterCountries(countries, filterValue)),
      takeUntilDestroyed(this._destroyRef)
    );

    this.startGame();
    this._destroyRef.onDestroy(() => {
      if (this.coverAnimId !== null) cancelAnimationFrame(this.coverAnimId);
    });
  }

  private animateCover(from: number, to: number, duration = 650): void {
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
      }
    };
    this.coverAnimId = requestAnimationFrame(step);
  }

  public startGame(): void {
    this.round = 1;
    this.currentPlayer = 1;
    this.teamScore = 0;
    this.history = [];
    this.gameOver = false;
    this.startRound();
  }

  private startRound(): void {
    this.category = pickRandomCategory();
    this.target = Math.round(Math.random() * 100);
    this.countryControl.reset();
    this.lockedCountry = '';
    this.needleValue = 50;
    this.lockedGuess = null;
    this.lastPoints = 0;
    this.phase = 'psychic';
    if (this.coverAnimId !== null) cancelAnimationFrame(this.coverAnimId);
    this.coverValue = 0; // dial starts open for the psychic
  }

  public get psychicPlayerLabel(): string {
    return `Player ${this.currentPlayer}`;
  }

  public get guesserPlayerLabel(): string {
    return `Player ${this.currentPlayer === 1 ? 2 : 1}`;
  }

  // --- Psychic phase ---

  public confirmCountry(): void {
    const value = this.countryControl.value;
    const name = typeof value === 'string' ? value : value?.name;
    if (!name || !name.trim()) return;
    this.lockedCountry = name.trim();
    this.needleValue = 50;
    this.phase = 'guesser';
    this.animateCover(0, 100); // sweep the cover shut so the guesser can't see the zones
  }

  public onEnterKey(): void {
    setTimeout(() => this.confirmCountry());
  }

  // --- Guesser phase ---
  public onNeedleChange(value: number): void {
    this.needleValue = Math.min(100, Math.max(0, value));
  }

  public confirmGuess(): void {
    this.lockedGuess = this.needleValue;
    this.lastPoints = this.scoreForGuess(this.target, this.lockedGuess);
    this.teamScore += this.lastPoints;
    this.history = [
      ...this.history,
      {
        round: this.round,
        category: this.category.title,
        country: this.lockedCountry,
        points: this.lastPoints,
        psychicPlayer: this.currentPlayer,
      },
    ];
    this.phase = 'reveal';
    this.animateCover(100, 0); // sweep the cover open to reveal the answer
  }

  private scoreForGuess(target: number, guess: number): number {
    const diff = Math.abs(target - guess);
    if (diff <= RED_WIDTH) return 5;
    if (diff <= GREEN_WIDTH) return 3;
    if (diff <= YELLOW_WIDTH) return 1;
    return 0;
  }

  // --- Round progression ---
  public nextRound(): void {
    if (this.round >= TOTAL_ROUNDS) {
      this.gameOver = true;
      return;
    }
    this.round += 1;
    this.currentPlayer = this.currentPlayer === 1 ? 2 : 1;
    this.startRound();
  }

  public playAgain(): void {
    this.startGame();
  }

  // --- Wheel geometry helpers ---
  public valueToAngle(value: number): number {
    const v = Math.min(100, Math.max(0, value));
    return 180 - v * 1.8;
  }

  public get redZone(): { from: number; to: number } {
    return {
      from: Math.max(0, this.target - RED_WIDTH),
      to: Math.min(100, this.target + RED_WIDTH),
    };
  }

  public get greenZoneLeft(): { from: number; to: number } {
    return {
      from: Math.max(0, this.target - GREEN_WIDTH),
      to: Math.max(0, this.target - RED_WIDTH),
    };
  }

  public get greenZoneRight(): { from: number; to: number } {
    return {
      from: Math.min(100, this.target + RED_WIDTH),
      to: Math.min(100, this.target + GREEN_WIDTH),
    };
  }

  public get yellowZoneLeft(): { from: number; to: number } {
    return {
      from: Math.max(0, this.target - YELLOW_WIDTH),
      to: Math.max(0, this.target - GREEN_WIDTH),
    };
  }

  public get yellowZoneRight(): { from: number; to: number } {
    return {
      from: Math.min(100, this.target + GREEN_WIDTH),
      to: Math.min(100, this.target + YELLOW_WIDTH),
    };
  }

  public wedgePath(from: number, to: number, cx = 150, cy = 150, r = 140): string {
    if (to <= from) return '';
    const a1 = this.valueToAngle(from);
    const a2 = this.valueToAngle(to);

    // Sample the arc as short straight segments instead of using an SVG "A"
    // command. For large spans (like the cover sweep, up to 180°) the A
    // command's endpoint+radius pair is ambiguous between two circles, and
    // the sweep-flag that resolves it correctly for small zone wedges can
    // pick the wrong one at larger spans — producing an inward-cutting spike
    // instead of a rim-hugging fan. Sampling sidesteps the ambiguity entirely.
    const steps = Math.max(2, Math.ceil(Math.abs(a1 - a2) / 4));
    let d = `M ${cx} ${cy}`;
    for (let i = 0; i <= steps; i++) {
      const angle = a1 + ((a2 - a1) * i) / steps;
      const p = this.polar(cx, cy, r, angle);
      d += ` L ${p.x.toFixed(2)} ${p.y.toFixed(2)}`;
    }
    d += ' Z';
    return d;
  }

  private polar(cx: number, cy: number, r: number, angleDeg: number): { x: number; y: number } {
    const rad = (angleDeg * Math.PI) / 180;
    return {
      x: cx + r * Math.cos(rad),
      y: cy - r * Math.sin(rad),
    };
  }

  public needleTransform(value: number, cx = 150, cy = 150): string {
    const angle = this.valueToAngle(value);
    const rotation = 90 - angle;
    return `rotate(${rotation} ${cx} ${cy})`;
  }

  // --- Drag handling on the wheel ---
  private wheelEl: HTMLElement | null = null;

  public onDragStart(event: PointerEvent, el: HTMLElement): void {
    if (this.phase !== 'guesser') return;
    this.wheelEl = el;
    this.updateFromPointer(event);
    (event.target as HTMLElement).setPointerCapture?.(event.pointerId);
  }

  public onDragMove(event: PointerEvent): void {
    if (this.phase !== 'guesser') return;
    if (event.buttons === 0 && event.pointerType === 'mouse') return;
    this.updateFromPointer(event);
  }

  private updateFromPointer(event: PointerEvent): void {
    if (!this.wheelEl) return;
    const rect = this.wheelEl.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.bottom;
    const dx = event.clientX - cx;
    const dy = cy - event.clientY;
    let angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI;

    // atan2 returns -180..180. If the pointer dips below the wheel's baseline
    // (dy < 0), the angle comes back negative even on the left side (e.g.
    // -170° instead of 170°). Naively clamping negative angles to 0 always
    // snaps to the rightmost value, which is wrong when the pointer was
    // actually on the left. Snap to whichever edge (0° or 180°) matches the
    // side the pointer is on instead.
    if (angleDeg < 0) {
      angleDeg = dx < 0 ? 180 : 0;
    } else {
      angleDeg = Math.min(180, angleDeg);
    }

    const value = Math.round((180 - angleDeg) / 1.8);
    this.onNeedleChange(value);
  }

  public toGreenSaturation(points: number): string {
    const clamped = Math.min(Math.max((points / 5) * 100, 0), 100);
    const lightness = 100 - (clamped / 100) * 60;
    return `hsl(120, 70%, ${lightness}%)`;
  }
}