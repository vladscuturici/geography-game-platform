// higher-lower.component.ts
import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, inject, OnInit } from '@angular/core';
import { shareReplay } from 'rxjs';
import { CountriesService } from '../services/countries.service';
import { Country } from '../models/countries.model';

type RoundResult = 'correct' | 'wrong' | null;

@Component({
  selector: 'app-higher-lower',
  imports: [CommonModule],
  templateUrl: './higher-lower.component.html',
  styleUrl: './higher-lower.component.css',
})
export class HigherLowerComponent implements OnInit {
  private _countriesService = inject(CountriesService);
  private _cdr = inject(ChangeDetectorRef);

  public countries$ = this._countriesService.getAllCountries().pipe(shareReplay(1));

  private _allCountries: Country[] = [];

  /** The country currently "on the throne" — its population is always shown. */
  public champion: Country | null = null;
  /** The country being compared against the champion — population hidden until guessed. */
  public challenger: Country | null = null;

  public streak = 0;
  public bestStreak = 0;
  public roundsPlayed = 0;

  public roundResult: RoundResult = null;
  public isRevealed = false;
  public isGameOver = false;
  public isLoading = true;

  public guessHistory: { round: number; country: string; correct: boolean }[] = [];

  ngOnInit(): void {
    this.countries$.subscribe(countries => {
      // Only keep countries with a usable population figure.
      this._allCountries = countries.filter(c => typeof c.population === 'number' && c.population > 0);
      this.isLoading = false;
      this._startNewGame();
      this._cdr.markForCheck();
    });
  }

  public get accuracyPct(): number {
    if (this.guessHistory.length === 0) return 0;
    const correctCount = this.guessHistory.filter(g => g.correct).length;
    return Math.round((correctCount / this.guessHistory.length) * 100);
  }

  private _startNewGame(): void {
    this.streak = 0;
    this.roundsPlayed = 0;
    this.isGameOver = false;
    this.guessHistory = [];
    this.champion = this._pickRandomCountry();
    this._nextChallenger();
  }

  public restart(): void {
    this._startNewGame();
  }

  private _pickRandomCountry(exclude?: Country | null): Country {
    let candidate: Country;
    do {
      candidate = this._allCountries[Math.floor(Math.random() * this._allCountries.length)];
    } while (exclude && candidate.name === exclude.name && this._allCountries.length > 1);
    return candidate;
  }

  private _nextChallenger(): void {
    this.challenger = this._pickRandomCountry(this.champion);
    this.roundResult = null;
    this.isRevealed = false;
  }

  public onGuess(direction: 'higher' | 'lower'): void {
    if (!this.champion || !this.challenger || this.isRevealed || this.isGameOver) return;

    const championPop = this.champion.population;
    const challengerPop = this.challenger.population;

    const actuallyHigher = challengerPop > championPop;
    const guessedHigher = direction === 'higher';
    // A tie is vanishingly rare for real population data, but guard against it
    // by treating an exact match as a win either way rather than a loss.
    const isCorrect = challengerPop === championPop ? true : guessedHigher === actuallyHigher;

    this.isRevealed = true;
    this.roundResult = isCorrect ? 'correct' : 'wrong';
    this.roundsPlayed++;

    this.guessHistory = [
      ...this.guessHistory,
      { round: this.roundsPlayed, country: this.challenger.name, correct: isCorrect },
    ];

    if (isCorrect) {
      this.streak++;
      this.bestStreak = Math.max(this.bestStreak, this.streak);
    } else {
      this.isGameOver = true;
    }

    this._cdr.markForCheck();
  }

  public onContinue(): void {
    if (!this.challenger || this.isGameOver) return;
    // Challenger becomes the new champion; roll a fresh challenger.
    this.champion = this.challenger;
    this._nextChallenger();
  }

  public formatPopulation(value: number): string {
    return new Intl.NumberFormat('en-US').format(value);
  }
}