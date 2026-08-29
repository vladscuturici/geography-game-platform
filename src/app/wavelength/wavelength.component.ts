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
import { WavelengthWheelComponent } from '../wavelength-wheel/wavelength-wheel.component';

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
    WavelengthWheelComponent,
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

  public toGreenSaturation(points: number): string {
    const clamped = Math.min(Math.max((points / 5) * 100, 0), 100);
    const lightness = 100 - (clamped / 100) * 60;
    return `hsl(120, 70%, ${lightness}%)`;
  }
}