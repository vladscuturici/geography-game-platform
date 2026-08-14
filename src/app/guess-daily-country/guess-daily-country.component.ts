import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormControl } from '@angular/forms';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { map, shareReplay, startWith, combineLatest, take  } from 'rxjs';
import { CountriesService } from '../services/countries.service';
import { DailyCountryPicker } from '../strategies/item-pick-strategy';
import { Country } from '../models/countries.model';
import { MatButtonModule } from '@angular/material/button';
import { GameService } from '../services/game.service';
import { GuessRow } from '../models/game.model';

@Component({
  selector: 'app-guess-daily-country',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatAutocompleteModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
  ],
  templateUrl: './guess-daily-country.component.html',
  styleUrl: './guess-daily-country.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GuessDailyCountryComponent {
  private _countriesService = inject(CountriesService);
  private _dailyCountryPicker = new DailyCountryPicker();
  private _gameService = inject(GameService);

  public guessedCountries: GuessRow[] = [];
  public guessControl = new FormControl<Country | null>(null);
  public solved = false;

  public countries$ = this._countriesService.getAllCountries().pipe(
    shareReplay(1)
  );

  public dailyCountry$ = this.countries$.pipe(
    map(countries => this._dailyCountryPicker.pick(countries))
  );

  public filteredCountries$ = combineLatest([
    this.countries$,
    this.guessControl.valueChanges.pipe(startWith('')),
  ]).pipe(
    map(([countries, filterValue]) => this._filterCountries(countries, filterValue))
  );

  private _filterCountries(countries: Country[], value: string | Country | null): Country[] {
    const filterValue = (typeof value === 'string' ? value : value?.name ?? '').toLowerCase();
    return countries.filter(country =>
      country.name.toLowerCase().includes(filterValue)
    );
  }

  public displayFn(country: Country): string {
    return country?.name ?? '';
  }

  public onGuess(): void {
    const guessedCountry = this.guessControl.value;
    if (!guessedCountry || this.solved) return;

    this.dailyCountry$.pipe(take(1)).subscribe(answer => {
      const scores = this._gameService.compareCountryGuess(answer, guessedCountry);
      this.guessedCountries = [...this.guessedCountries, { country: guessedCountry, ...scores }];

      if (scores.name === 100) {
        this.solved = true;
        this.guessControl.disable();
      }

      this.guessControl.reset();
    });
  }

  public toGreenSaturation(score: number): string {
    const lightness = 100 - (score / 100) * 60; 
    return `hsl(120, 70%, ${lightness}%)`;
  }
}