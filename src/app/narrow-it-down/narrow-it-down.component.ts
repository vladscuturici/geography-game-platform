import { Component, inject, OnInit, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CountriesService } from '../services/countries.service';
import { RandomCountryPicker } from '../strategies/item-pick-strategy';
import { BehaviorSubject, combineLatest, map, shareReplay } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { GameService } from '../services/game.service';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSliderModule } from '@angular/material/slider';
import { MatButtonModule } from '@angular/material/button';
import { ReactiveFormsModule, FormControl } from '@angular/forms';
import { Country } from '../models/countries.model';

@Component({
  selector: 'app-narrow-it-down',
  imports: [
    CommonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSliderModule,
    MatButtonModule,
    ReactiveFormsModule,
  ],
  templateUrl: './narrow-it-down.component.html',
  styleUrl: './narrow-it-down.component.css',
})
export class NarrowItDownComponent implements OnInit {
  _countriesService = inject(CountriesService);
  _gameService = inject(GameService);
  _randomPicker = new RandomCountryPicker();
  private _destroyRef = inject(DestroyRef);

  public countries$ = this._countriesService.getAllCountries().pipe(
    map((countries) => countries.filter((c) => c.population > 0)),
    shareReplay(1)
  );
  private _reroll$ = new BehaviorSubject<void>(undefined);
  public justSolved = false;

  // --- Real population bounds ---
  private readonly POP_FLOOR = 1;
  private readonly POP_CEIL = 2_000_000_000;
  private readonly PIVOT = 9_000_000; // world median population

  // Exponent applied to normalized log-distance from the pivot.
  // <1 stretches values near the pivot, compresses values far from it.
  // Try values between 0.35 (very aggressive stretch) and 0.6 (gentler).
  private readonly CURVE_EXPONENT = 0.45;

  private readonly logFloor = Math.log10(this.POP_FLOOR);
  private readonly logCeil = Math.log10(this.POP_CEIL);
  private readonly logPivot = Math.log10(this.PIVOT);
  // log-distance spans on each side of the pivot (kept separate since they're not equal)
  private readonly logSpanBelow = this.logPivot - this.logFloor; // pivot -> floor
  private readonly logSpanAbove = this.logCeil - this.logPivot;  // pivot -> ceil

  private readonly SLIDER_RESOLUTION = 10_000;
  private readonly SLIDER_MID = this.SLIDER_RESOLUTION / 2;

  public sliderMin = 0;
  public sliderMax = this.SLIDER_RESOLUTION;
  public sliderStep = 1;

  public minControl = new FormControl<number>(this.POP_FLOOR, { nonNullable: true });
  public maxControl = new FormControl<number>(this.POP_CEIL, { nonNullable: true });

  public sliderMinControl = new FormControl<number>(0, { nonNullable: true });
  public sliderMaxControl = new FormControl<number>(this.SLIDER_RESOLUTION, { nonNullable: true });

  // Text shown in the Min/Max inputs. While the user is actively typing we
  // show raw digits (no separators, so caret position doesn't jump around);
  // on blur we re-format with "." thousands separators. Initialized from
  // the controls' starting values so the dots show up before first focus.
  public minDisplay = this.formatDots(this.minControl.value);
  public maxDisplay = this.formatDots(this.maxControl.value);

  public currentCountry: Country | null = null;
  public currentScore: number = 0;
  public hasGuessed = false;

  // --- Session history ---
  public guessHistory: { gameNumber: number; countryName: string; points: number }[] = [];

  public get averageScore(): number {
    if (this.guessHistory.length === 0) return 0;
    const total = this.guessHistory.reduce((sum, entry) => sum + entry.points, 0);
    return Math.round((total / this.guessHistory.length) * 10) / 10;
  }

  public randomCountry$ = combineLatest([this.countries$, this._reroll$]).pipe(
    map(([countries]) => this._randomPicker.pick(countries)),
    shareReplay(1)
  );

  ngOnInit(): void {
    this.syncSliderFromControls();
    this.randomCountry$
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe((country) => {
        this.currentCountry = country;
      });
  }

  // --- Symmetric-log (power-scaled) mapping ---

  private populationToSlider(pop: number): number {
    const p = this.clamp(pop, this.POP_FLOOR, this.POP_CEIL);
    const logP = Math.log10(p);

    if (logP === this.logPivot) return this.SLIDER_MID;

    if (logP > this.logPivot) {
      const d = (logP - this.logPivot) / this.logSpanAbove;
      const bent = Math.pow(d, this.CURVE_EXPONENT);
      return Math.round(this.SLIDER_MID + bent * this.SLIDER_MID);
    } else {
      const d = (this.logPivot - logP) / this.logSpanBelow;
      const bent = Math.pow(d, this.CURVE_EXPONENT);
      return Math.round(this.SLIDER_MID - bent * this.SLIDER_MID);
    }
  }

  private sliderToPopulation(index: number): number {
    const i = this.clamp(index, 0, this.SLIDER_RESOLUTION);

    if (i === this.SLIDER_MID) return this.PIVOT;

    if (i > this.SLIDER_MID) {
      const bent = (i - this.SLIDER_MID) / this.SLIDER_MID;
      const d = Math.pow(bent, 1 / this.CURVE_EXPONENT);
      const logP = this.logPivot + d * this.logSpanAbove;
      return Math.round(10 ** logP);
    } else {
      const bent = (this.SLIDER_MID - i) / this.SLIDER_MID;
      const d = Math.pow(bent, 1 / this.CURVE_EXPONENT);
      const logP = this.logPivot - d * this.logSpanBelow;
      return Math.round(10 ** logP);
    }
  }

  private syncSliderFromControls(): void {
    this.sliderMinControl.setValue(this.populationToSlider(this.minControl.value), {
      emitEvent: false,
    });
    this.sliderMaxControl.setValue(this.populationToSlider(this.maxControl.value), {
      emitEvent: false,
    });
  }

  public sliderLabelFormat = (index: number): string => this.formatDots(this.sliderToPopulation(index));

  // --- Number formatting (1.200.000 style) ---

  public formatDots(value: number | null | undefined): string {
    return value == null || isNaN(value) ? '' : value.toLocaleString('de-DE');
  }

  private parseDots(raw: string): number {
    const digitsOnly = raw.replace(/\./g, '').replace(/[^\d-]/g, '');
    const parsed = Number(digitsOnly);
    return isNaN(parsed) ? 0 : parsed;
  }

  public onMinFocus(): void {
    this.minDisplay = this.minControl.value != null ? String(this.minControl.value) : '';
  }

  public onMaxFocus(): void {
    this.maxDisplay = this.maxControl.value != null ? String(this.maxControl.value) : '';
  }

  public onMinInput(raw: string): void {
    this.minDisplay = raw;
    const parsed = this.parseDots(raw);
    if (!isNaN(parsed)) {
      this.minControl.setValue(parsed, { emitEvent: false });
      this.syncSliderFromControls();
    }
  }

  public onMaxInput(raw: string): void {
    this.maxDisplay = raw;
    const parsed = this.parseDots(raw);
    if (!isNaN(parsed)) {
      this.maxControl.setValue(parsed, { emitEvent: false });
      this.syncSliderFromControls();
    }
  }

  public onMinBlur(): void {
    const parsed = this.parseDots(this.minDisplay);
    const clamped = this.clamp(parsed, this.POP_FLOOR, this.maxControl.value);
    this.minControl.setValue(clamped, { emitEvent: false });
    this.minDisplay = this.formatDots(clamped);
    this.syncSliderFromControls();
  }

  public onMaxBlur(): void {
    const parsed = this.parseDots(this.maxDisplay);
    const clamped = this.clamp(parsed, this.minControl.value, this.POP_CEIL);
    this.maxControl.setValue(clamped, { emitEvent: false });
    this.maxDisplay = this.formatDots(clamped);
    this.syncSliderFromControls();
  }

  public onSliderMinChanged(index: string | number): void {
    const pop = this.sliderToPopulation(Number(index));
    const clamped = this.clamp(pop, this.POP_FLOOR, this.maxControl.value);
    this.minControl.setValue(clamped, { emitEvent: false });
    this.minDisplay = this.formatDots(clamped);
  }

  public onSliderMaxChanged(index: string | number): void {
    const pop = this.sliderToPopulation(Number(index));
    const clamped = this.clamp(pop, this.minControl.value, this.POP_CEIL);
    this.maxControl.setValue(clamped, { emitEvent: false });
    this.maxDisplay = this.formatDots(clamped);
  }

  private clamp(value: number, min: number, max: number): number {
    if (value == null || isNaN(value)) return min;
    return Math.min(Math.max(value, min), max);
  }

  public nextCountry(): void {
    if (this.currentCountry && this.hasGuessed) {
      this.guessHistory = [
        ...this.guessHistory,
        {
          gameNumber: this.guessHistory.length + 1,
          countryName: this.currentCountry.name,
          points: this.currentScore,
        },
      ];
    }

    this.justSolved = false;
    this.hasGuessed = false;
    this._resetRange();
    this._reroll$.next();

    // Unlock for the new round
    this.minControl.enable({ emitEvent: false });
    this.maxControl.enable({ emitEvent: false });
    this.sliderMinControl.enable({ emitEvent: false });
    this.sliderMaxControl.enable({ emitEvent: false });
  }

  private _resetRange(): void {
    this.minControl.setValue(this.POP_FLOOR, { emitEvent: false });
    this.maxControl.setValue(this.POP_CEIL, { emitEvent: false });
    this.minDisplay = this.formatDots(this.POP_FLOOR);
    this.maxDisplay = this.formatDots(this.POP_CEIL);
    this.syncSliderFromControls();
  }

  public toGreenSaturation(score: number): string {
    const clamped = Math.min(Math.max(score, 0), 100);
    const lightness = 100 - (clamped / 100) * 60;
    return `hsl(120, 70%, ${lightness}%)`;
  }

  public onGuess() {
    if (!this.currentCountry) return;

    this.currentScore = this._gameService.narrowItDownScore(
      this.currentCountry.population,
      this.minControl.value,
      this.maxControl.value
    );
    this.hasGuessed = true;

    // Lock everything down until "Next country"
    this.minControl.disable({ emitEvent: false });
    this.maxControl.disable({ emitEvent: false });
    this.sliderMinControl.disable({ emitEvent: false });
    this.sliderMaxControl.disable({ emitEvent: false });
  }
}