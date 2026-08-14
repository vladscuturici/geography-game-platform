import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { map, shareReplay, BehaviorSubject, combineLatest } from 'rxjs';
import { CountriesService } from '../../services/countries.service';
import { RandomCountryPicker } from '../../strategies/item-pick-strategy';
import { GuessRow } from '../../models/game.model';
import { GuessTheCountryComponent } from '../guess-the-country.component';

@Component({
  selector: 'app-unlimited-country',
  standalone: true,
  imports: [CommonModule, GuessTheCountryComponent],
  templateUrl: './unlimited.component.html',
  styleUrl: './unlimited.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UnlimitedComponent {
  private _countriesService = inject(CountriesService);
  private _randomCountryPicker = new RandomCountryPicker();

  public guessedCountries: GuessRow[] = [];
  public justSolved = false;

  public countries$ = this._countriesService.getAllCountries().pipe(shareReplay(1));

  private _reroll$ = new BehaviorSubject<void>(undefined);

  public randomCountry$ = combineLatest([this.countries$, this._reroll$]).pipe(
    map(([countries]) => this._randomCountryPicker.pick(countries)),
    shareReplay(1)
  );

  public onGuessMade(guess: GuessRow): void {
    this.guessedCountries = [...this.guessedCountries, guess];
    if (guess.name === 100) {
      this.justSolved = true;
    }
  }

  public nextCountry(): void {
    this.justSolved = false;
    this.guessedCountries = [];
    this._reroll$.next();
  }
}