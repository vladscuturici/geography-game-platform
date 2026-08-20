// tic-tac-toe.component.ts
import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, inject } from '@angular/core';
import { ConditionPickerComponent } from '../condition-picker/condition-picker.component';
import { CONDITION_RECORDS, ConditionRecord } from '../conditions/condition-records';
import { CountriesService } from '../services/countries.service';
import { GameService } from '../services/game.service';
import { Country } from '../models/countries.model';
import { forkJoin, map, shareReplay, catchError, of } from 'rxjs';
import { FormsModule } from '@angular/forms';

type PickerTarget = { axis: 'row' | 'col'; index: number } | null;
type GuessTarget = { row: number; col: number } | null;

@Component({
  selector: 'app-tic-tac-toe',
  imports: [CommonModule, FormsModule, ConditionPickerComponent],
  templateUrl: './tic-tac-toe.component.html',
  styleUrl: './tic-tac-toe.component.css',
})
export class TicTacToeComponent {
  private _countriesService = inject(CountriesService);
  private _gameService = inject(GameService);
  private _cdr = inject(ChangeDetectorRef);


  public countries$ = this._countriesService.getAllCountries().pipe(shareReplay(1));
  public cellsBgImage = "url('/bg1.png')";
  public cornerLogo = './128.png';

  public rowConditions: (ConditionRecord | null)[] = [null, null, null];
  public columnConditions: (ConditionRecord | null)[] = [null, null, null];

  public cells: string[][] = [
    ['', '', ''],
    ['', '', ''],
    ['', '', ''],
  ];

  /** Flag emoji for each filled cell, parallel to `cells`. */
  public cellFlags: string[][] = [
    ['', '', ''],
    ['', '', ''],
    ['', '', ''],
  ];

  public pickerTarget: PickerTarget = null;
  /** Condition ids that would produce zero valid countries against the opposite axis's current picks. */
  public pickerInvalidIds: string[] = [];
  /** True while we're checking combinations before the picker opens. */
  public isLoadingPicker = false;

  public guessTarget: GuessTarget = null;
  public guessInput = '';
  public guessError = '';
  public isCheckingGuess = false;

  public cellFlagImages: string[][] = [['', '', ''], ['', '', ''], ['', '', '']];

  /** Autocomplete suggestions for the guess input. */
  public guessSuggestions: Country[] = [];
  public showSuggestions = false;

  private _allCountries: Country[] = [];

  constructor() {
    this.countries$.subscribe(countries => (this._allCountries = countries));
  }

  public get usedConditionIds(): string[] {
    return [...this.rowConditions, ...this.columnConditions]
      .filter((c): c is ConditionRecord => c !== null)
      .map(c => c.id);
  }

  /** Ids the picker should disable: already-used conditions + ones with no valid answer. */
  public get pickerDisabledIds(): string[] {
    return [...this.usedConditionIds, ...this.pickerInvalidIds];
  }

  /** True once every row and column condition has been chosen — conditions lock after this,
   *  and guessing is only allowed once this is true. */
  public get allConditionsSet(): boolean {
    return this.rowConditions.every(c => c !== null) && this.columnConditions.every(c => c !== null);
  }

  public onSelectRowCondition(row: number): void {
    if (this.allConditionsSet) return;
    this._openPicker({ axis: 'row', index: row });
  }

  public onSelectColumnCondition(col: number): void {
    if (this.allConditionsSet) return;
    this._openPicker({ axis: 'col', index: col });
  }

  private _openPicker(target: Exclude<PickerTarget, null>): void {
    if (this.isLoadingPicker) {
      console.log('🔴 ignored re-entrant call while already loading');
      return;
    }
    console.log('🟡 _openPicker called for', target);
    const oppositeConditions = (target.axis === 'row' ? this.columnConditions : this.rowConditions)
      .filter((c): c is ConditionRecord => c !== null);

    // Nothing set on the opposite axis yet — every condition is fair game.
    if (oppositeConditions.length === 0) {
      console.log('🟢 early return, opening picker immediately for', target);
      this.pickerInvalidIds = [];
      this.pickerTarget = target;
      return;
    }

    this.isLoadingPicker = true;
    console.log('🟡 starting', CONDITION_RECORDS.length, 'candidate checks against', oppositeConditions.map(c => c.label));

    const candidateChecks$ = CONDITION_RECORDS.map(candidate => {
      const validityChecks$ = oppositeConditions.map(oppCondition =>
        (target.axis === 'row'
          ? this._gameService.isValidColumnRowCombination(candidate.label, oppCondition.label)
          : this._gameService.isValidColumnRowCombination(oppCondition.label, candidate.label)
        ).pipe(
          catchError(err => {
            console.warn('Condition mismatch:', candidate.label, '<->', oppCondition.label, err?.message ?? err);
            return of(false);
          })
        )
      );

      return forkJoin(validityChecks$).pipe(
        map(results => ({ id: candidate.id, isValid: results.every(Boolean) }))
      );
    });

    forkJoin(candidateChecks$).subscribe({
      next: results => {
        console.log('🟢 forkJoin resolved,', results.filter(r => !r.isValid).length, 'invalid');
        this.pickerInvalidIds = results.filter(r => !r.isValid).map(r => r.id);
        this.isLoadingPicker = false;
        this.pickerTarget = target;
        this._cdr.markForCheck();
      },
      error: err => {
        console.error('Unexpected error checking picker validity:', err);
        this.isLoadingPicker = false;
      },
    });
  }

  public onConditionPicked(record: ConditionRecord): void {
    if (!this.pickerTarget) return;
    const { axis, index } = this.pickerTarget;
    if (axis === 'row') {
      this.rowConditions[index] = record;
    } else {
      this.columnConditions[index] = record;
    }
    this.pickerTarget = null;
    this.pickerInvalidIds = [];
  }

  public onPickerDismissed(): void {
    this.pickerTarget = null;
    this.pickerInvalidIds = [];
  }

  public onGuessCell(row: number, col: number): void {
    if (!this.allConditionsSet) return;
    if (!this.rowConditions[row] || !this.columnConditions[col]) return;
    if (this.cells[row][col]) return;

    this.guessTarget = { row, col };
    this.guessInput = '';
    this.guessError = '';
    this.guessSuggestions = [];
    this.showSuggestions = false;
  }

  public onGuessCancel(): void {
    this.guessTarget = null;
    this.guessInput = '';
    this.guessError = '';
    this.guessSuggestions = [];
    this.showSuggestions = false;
  }

  /** Called on (input)/(focus) from the guess text field. */
  public onGuessInputChange(): void {
    this.guessError = '';
    const query = this.guessInput.trim().toLowerCase();

    if (!query) {
      this.guessSuggestions = [];
      this.showSuggestions = false;
      return;
    }

    this.guessSuggestions = this._allCountries
      .filter(c => c.name.toLowerCase().includes(query))
      .sort((a, b) => {
        const aStarts = a.name.toLowerCase().startsWith(query);
        const bStarts = b.name.toLowerCase().startsWith(query);
        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;
        return a.name.localeCompare(b.name);
      })
      .slice(0, 6);

    this.showSuggestions = this.guessSuggestions.length > 0;
  }

  /** Called when a suggestion is clicked (via mousedown, see template). */
  public onSuggestionSelect(country: Country): void {
    this.guessInput = country.name;
    this.guessSuggestions = [];
    this.showSuggestions = false;
  }

  /** Hide suggestions on blur, delayed so a suggestion click/mousedown can register first. */
  public onGuessInputBlur(): void {
    setTimeout(() => (this.showSuggestions = false), 120);
  }

  public onGuessSubmit(): void {
    if (!this.guessTarget) return;
    const { row, col } = this.guessTarget;
    const rowCondition = this.rowConditions[row];
    const colCondition = this.columnConditions[col];
    if (!rowCondition || !colCondition) return;

    const query = this.guessInput.trim().toLowerCase();
    if (!query) {
      this.guessError = 'Type a country name.';
      return;
    }

    const match = this._allCountries.find(c => c.name.toLowerCase() === query);
    if (!match) {
      this.guessError = `"${this.guessInput}" isn't a recognized country name.`;
      return;
    }
    
    this.cellFlagImages[row][col] = match.flags.svg;

    this.isCheckingGuess = true;
    this._gameService
      .isCorrectCountryTicTacToe(match.alpha2Code, rowCondition.label, colCondition.label)
      .subscribe({
        next: isCorrect => {
          this.isCheckingGuess = false;
          if (isCorrect) {
            this.cells[row][col] = match.name;
            this.cellFlags[row][col] = match.flag;
            this.guessTarget = null;
            this.guessInput = '';
            this.guessError = '';
            this.guessSuggestions = [];
            this.showSuggestions = false;
          } else {
            this.guessError = `${match.name} doesn't satisfy both conditions. Try again.`;
          }
        },
        error: () => {
          this.isCheckingGuess = false;
          this.guessError = 'Something went wrong checking that guess.';
        },
      });
  }
}