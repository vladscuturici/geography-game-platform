import { ChangeDetectionStrategy, Component, DestroyRef, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormControl } from '@angular/forms';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { Observable, combineLatest, map, shareReplay, startWith, take, BehaviorSubject } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Country } from '../../models/countries.model';
import { GuessRow } from '../../models/game.model';
import { CountriesService } from '../../services/countries.service';
import { GameService } from '../../services/game.service';
import { RandomCountryPicker } from '../../strategies/item-pick-strategy';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-unlimited-country',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatAutocompleteModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    RouterModule
  ],
  templateUrl: './unlimited.component.html',
  styleUrl: './unlimited.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UnlimitedComponent implements OnInit {
  private _countriesService = inject(CountriesService);
  private _gameService = inject(GameService);
  private _randomCountryPicker = new RandomCountryPicker();
  private _destroyRef = inject(DestroyRef);

  public guessedCountries: GuessRow[] = [];
  public justSolved = false;
  public gaveUp = false;
  public currentCountry: Country | null = null;

  // Display colors for the history sidebar rows
  public readonly matchBg = 'var(--match-bg)';
  public readonly giveUpBg = 'rgba(201, 106, 106, 0.18)';

  // --- Session history ---
  public roundHistory: { roundNumber: number; countryName: string; solved: boolean; guessCount: number }[] = [];

  public get solvedCount(): number {
    return this.roundHistory.filter((entry) => entry.solved).length;
  }

  public countries$ = this._countriesService.getAllCountries().pipe(shareReplay(1));

  private _reroll$ = new BehaviorSubject<void>(undefined);
  public randomCountry$ = combineLatest([this.countries$, this._reroll$]).pipe(
    map(([countries]) => this._randomCountryPicker.pick(countries)),
    shareReplay(1)
  );

  public guessControl = new FormControl<Country | null>(null);
  public filteredCountries$!: Observable<Country[]>;

  ngOnInit(): void {
    this.filteredCountries$ = combineLatest([
      this.countries$,
      this.guessControl.valueChanges.pipe(startWith('')),
    ]).pipe(map(([countries, filterValue]) => this._filterCountries(countries, filterValue)));

    this.randomCountry$
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe((country) => {
        this.currentCountry = country;
      });
  }

  private _filterCountries(countries: Country[], value: string | Country | null): Country[] {
    const filterValue = (typeof value === 'string' ? value : value?.name ?? '').toLowerCase();
    return countries.filter((country) => country.name.toLowerCase().includes(filterValue));
  }

  public displayFn(country: Country): string {
    return country?.name ?? '';
  }

  public onGuess(): void {
    const guessedCountry = this.guessControl.value;
    if (!guessedCountry || this.justSolved || this.gaveUp) return;

    this.randomCountry$.pipe(take(1)).subscribe((answer) => {
      const scores = this._gameService.compareCountryGuess(answer, guessedCountry);
      const guess: GuessRow = { country: guessedCountry, ...scores };
      this.guessedCountries = [...this.guessedCountries, guess];
      if (guess.name === 100) {
        this.justSolved = true;
      }
      this.guessControl.reset();
    });
  }

  public onGiveUp(): void {
    if (this.justSolved || this.gaveUp) return;
    this.gaveUp = true;
  }

  public nextCountry(): void {
    if (this.currentCountry && (this.justSolved || this.gaveUp)) {
      this.roundHistory = [
        ...this.roundHistory,
        {
          roundNumber: this.roundHistory.length + 1,
          countryName: this.currentCountry.name,
          solved: this.justSolved,
          guessCount: this.guessedCountries.length,
        },
      ];
    }

    this.justSolved = false;
    this.gaveUp = false;
    this.guessedCountries = [];
    this._reroll$.next();
  }

  public toGreenSaturation(score: number): string {
    const lightness = 100 - (score / 100) * 60;
    return `hsl(120, 70%, ${lightness}%)`;
  }

  public formatPopulation(value: number): string {
    return Number(value).toLocaleString('en-US').replace(/,/g, '.');
  }

  public populationArrow(guessPopulation: number): string {
    if (this.currentCountry == null) return '';
    const answerPopulation = this.currentCountry.population;
    if (guessPopulation === answerPopulation) return '';
    return guessPopulation < answerPopulation ? '▲' : '▼';
  }
  
  public onEnterKey(): void {
    setTimeout(() => this.onGuess());
  }

}