import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { map, shareReplay } from 'rxjs';
import { CountriesService } from '../../services/countries.service';
import { DailyCountryPicker } from '../../strategies/item-pick-strategy';
import { GuessRow } from '../../models/game.model';
import { GuessTheCountryComponent } from '../guess-the-country.component';

@Component({
  selector: 'app-daily-country',
  standalone: true,
  imports: [CommonModule, GuessTheCountryComponent],
  templateUrl: './daily-country.component.html',
  styleUrl: './daily-country.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DailyCountryComponent {
  private _countriesService = inject(CountriesService);
  private _dailyCountryPicker = new DailyCountryPicker();

  public guessedCountries: GuessRow[] = [];
  public solved = false;

  public countries$ = this._countriesService.getAllCountries().pipe(shareReplay(1));

  public dailyCountry$ = this.countries$.pipe(
    map((countries) => this._dailyCountryPicker.pick(countries))
  );

  public onGuessMade(guess: GuessRow): void {
    this.guessedCountries = [...this.guessedCountries, guess];
    if (guess.name === 100) {
      this.solved = true;
    }
  }
}