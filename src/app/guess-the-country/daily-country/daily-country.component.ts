import { ChangeDetectionStrategy, Component, DestroyRef, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormControl } from '@angular/forms';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { Observable, combineLatest, map, shareReplay, startWith, take } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Country } from '../../models/countries.model';
import { GuessRow } from '../../models/game.model';
import { CountriesService } from '../../services/countries.service';
import { GameService } from '../../services/game.service';
import { DailyCountryPicker } from '../../strategies/item-pick-strategy';
import { RouterModule } from '@angular/router';

interface DailyProgress {
  date: string;
  answerCountryName: string;
  guessedCountries: GuessRow[];
  solved: boolean;
}

interface DailyHistoryEntry {
  date: string;
  solved: boolean;
  countryName: string | null;
  guessCount: number;
}

const PROGRESS_KEY = 'daily-country-progress';
const HISTORY_KEY = 'daily-country-history';
const FIRST_LOGIN_KEY = 'daily-country-first-login';

@Component({
  selector: 'app-daily-country',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatAutocompleteModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    RouterModule,
  ],
  templateUrl: './daily-country.component.html',
  styleUrl: './daily-country.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DailyCountryComponent implements OnInit {
  private _countriesService = inject(CountriesService);
  private _gameService = inject(GameService);
  private _dailyCountryPicker = new DailyCountryPicker();
  private _destroyRef = inject(DestroyRef);

  public guessedCountries: GuessRow[] = [];
  public solved = false;
  public history: DailyHistoryEntry[] = [];

  private _today = this._formatDate(new Date());
  private _answerCountryName: string | null = null;
  public answerPopulation: number | null = null;

  public readonly matchBg = 'var(--match-bg)';
  public readonly giveUpBg = 'rgba(201, 106, 106, 0.18)';

  public countries$ = this._countriesService.getAllCountries().pipe(shareReplay(1));
  public dailyCountry$ = this.countries$.pipe(
    map((countries) => this._dailyCountryPicker.pick(countries)),
    shareReplay(1)
  );

  public guessControl = new FormControl<Country | null>(null);
  public filteredCountries$!: Observable<Country[]>;

  public get solvedCount(): number {
    return this.history.filter((entry) => entry.solved).length;
  }

  ngOnInit(): void {
    this.filteredCountries$ = combineLatest([
      this.countries$,
      this.guessControl.valueChanges.pipe(startWith('')),
    ]).pipe(map(([countries, filterValue]) => this._filterCountries(countries, filterValue)));

    this.dailyCountry$
    .pipe(takeUntilDestroyed(this._destroyRef))
    .subscribe((country) => {
      this._answerCountryName = country.name;
      this.answerPopulation = country.population;
      this._loadState();
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
    if (!guessedCountry || this.solved) return;

    this.dailyCountry$.pipe(take(1)).subscribe((answer) => {
      const scores = this._gameService.compareCountryGuess(answer, guessedCountry);
      const guess: GuessRow = { country: guessedCountry, ...scores };
      this.guessedCountries = [...this.guessedCountries, guess];
      if (guess.name === 100) {
        this.solved = true;
      }
      this.guessControl.reset();
      this._saveProgress();
    });
  }

  public toGreenSaturation(score: number): string {
    const lightness = 100 - (score / 100) * 60;
    return `hsl(120, 70%, ${lightness}%)`;
  }

  public formatPopulation(value: number): string {
    return Number(value).toLocaleString('en-US').replace(/,/g, '.');
  }

  public populationArrow(guessPopulation: number): string {
    if (this.answerPopulation == null) return '';
    if (guessPopulation === this.answerPopulation) return '';
    return guessPopulation < this.answerPopulation ? '▲' : '▼';
  }
  // --- Persistence ---

  private _formatDate(date: Date): string {
    return date.toISOString().slice(0, 10); // YYYY-MM-DD
  }

  public formatShortDate(dateStr: string): string {
    const d = new Date(dateStr + 'T00:00:00');
    const day = d.getDate();
    const month = d.toLocaleString('en-US', { month: 'short' }).toLowerCase();
    const year = String(d.getFullYear()).slice(-2);
    return `${day} ${month} ${year}`;
  }

  private _addDays(dateStr: string, days: number): string {
    const d = new Date(dateStr + 'T00:00:00');
    d.setDate(d.getDate() + days);
    return this._formatDate(d);
  }

  private _loadState(): void {
    // Ensure we have a first-login date recorded.
    let firstLogin = localStorage.getItem(FIRST_LOGIN_KEY);
    if (!firstLogin) {
      firstLogin = this._today;
      localStorage.setItem(FIRST_LOGIN_KEY, firstLogin);
    }

    let history: DailyHistoryEntry[] = this._readHistory();

    // If there's leftover progress from a previous day that never got archived
    // (e.g. the user closed the tab mid-round), fold it into history now.
    const progress = this._readProgress();
    if (progress && progress.date !== this._today) {
      history = this._upsertHistoryEntry(history, {
        date: progress.date,
        solved: progress.solved,
        countryName: progress.solved ? progress.answerCountryName : null,
        guessCount: progress.guessedCountries.length,
      });
      localStorage.removeItem(PROGRESS_KEY);
    }

    // Backfill any days between first login and yesterday that have no entry
    // at all (the user simply didn't open the app that day).
    let cursor = firstLogin;
    const yesterday = this._addDays(this._today, -1);
    while (cursor <= yesterday) {
      if (!history.some((entry) => entry.date === cursor)) {
        history = this._upsertHistoryEntry(history, {
          date: cursor,
          solved: false,
          countryName: null,
          guessCount: 0,
        });
      }
      cursor = this._addDays(cursor, 1);
    }

    history.sort((a, b) => (a.date < b.date ? 1 : -1)); // most recent first
    this.history = history;
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));

    // Restore today's in-progress/completed round, if any.
    const todayProgress = this._readProgress();
    if (todayProgress && todayProgress.date === this._today) {
      this.guessedCountries = todayProgress.guessedCountries;
      this.solved = todayProgress.solved;
    } else {
      this.guessedCountries = [];
      this.solved = false;
    }
  }

  private _readProgress(): DailyProgress | null {
    const raw = localStorage.getItem(PROGRESS_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as DailyProgress;
    } catch {
      return null;
    }
  }

  private _readHistory(): DailyHistoryEntry[] {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    try {
      return JSON.parse(raw) as DailyHistoryEntry[];
    } catch {
      return [];
    }
  }

  private _upsertHistoryEntry(
    history: DailyHistoryEntry[],
    entry: DailyHistoryEntry
  ): DailyHistoryEntry[] {
    const filtered = history.filter((e) => e.date !== entry.date);
    return [...filtered, entry];
  }

  private _saveProgress(): void {
    if (!this._answerCountryName) return;
    const progress: DailyProgress = {
      date: this._today,
      answerCountryName: this._answerCountryName,
      guessedCountries: this.guessedCountries,
      solved: this.solved,
    };
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));

    if (this.solved) {
      const updated = this._upsertHistoryEntry(this.history, {
        date: this._today,
        solved: true,
        countryName: this._answerCountryName,
        guessCount: this.guessedCountries.length,
      });
      updated.sort((a, b) => (a.date < b.date ? 1 : -1));
      this.history = updated;
      localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
    }
  }
}