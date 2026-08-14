import { ChangeDetectionStrategy, Component, EventEmitter, inject, Input, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormControl } from '@angular/forms';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { Observable, combineLatest, map, startWith, take } from 'rxjs';
import { Country } from '../models/countries.model';
import { GuessRow } from '../models/game.model';
import { GameService } from '../services/game.service';

@Component({
  selector: 'app-guess-round',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatAutocompleteModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
  ],
  templateUrl: './guess-the-country.component.html',
  styleUrl: './guess-the-country.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GuessTheCountryComponent implements OnInit {
  private _gameService = inject(GameService);

  @Input({ required: true }) countries$!: Observable<Country[]>;
  @Input({ required: true }) targetCountry$!: Observable<Country>;
  @Input() guessedCountries: GuessRow[] = [];
  @Input() solved = false;

  @Output() guessMade = new EventEmitter<GuessRow>();

  public guessControl = new FormControl<Country | null>(null);
  public filteredCountries$!: Observable<Country[]>;

  ngOnInit(): void {
    this.filteredCountries$ = combineLatest([
      this.countries$,
      this.guessControl.valueChanges.pipe(startWith('')),
    ]).pipe(
      map(([countries, filterValue]) => this._filterCountries(countries, filterValue))
    );
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
    if (!guessedCountry || this.solved) return;

    this.targetCountry$.pipe(take(1)).subscribe((answer) => {
      const scores = this._gameService.compareCountryGuess(answer, guessedCountry);
      this.guessMade.emit({ country: guessedCountry, ...scores });
      this.guessControl.reset();
    });
  }

  public toGreenSaturation(score: number): string {
    const lightness = 100 - (score / 100) * 60;
    return `hsl(120, 70%, ${lightness}%)`;
  }
}