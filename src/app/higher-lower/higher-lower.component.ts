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

  public roundResult: RoundResult = null;
  public isRevealed = false;
  public isGameOver = false;
  public isLoading = true;
  public isFlashing = false;

  private _gameNumber = 0;

  /** Guesses within the CURRENT game only — reset every time a new game starts. */
  public currentRoundHistory: { round: number; country: string; correct: boolean }[] = [];

  /** One entry per completed (lost) game, kept across the whole session. */
  public gameHistory: { gameNumber: number; score: number }[] = [];

  ngOnInit(): void {
    this.countries$.subscribe(countries => {
      // Only keep countries with a usable population figure.
      this._allCountries = countries.filter(c => typeof c.population === 'number' && c.population > 0);
      this.isLoading = false;
      this._startNewGame();
      this._cdr.markForCheck();
    });
  }

  private _startNewGame(): void {
    this.streak = 0;
    this.isGameOver = false;
    this.isFlashing = false;
    this.currentRoundHistory = [];
    this._gameNumber++;
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
    if (!this.champion || !this.challenger || this.isGameOver || this.isFlashing) return;

    const championPop = this.champion.population;
    const challengerPop = this.challenger.population;

    const actuallyHigher = challengerPop > championPop;
    const guessedHigher = direction === 'higher';
    const isCorrect = challengerPop === championPop ? true : guessedHigher === actuallyHigher;

    this.roundResult = isCorrect ? 'correct' : 'wrong';
    this.isFlashing = true;

    this.currentRoundHistory = [
      ...this.currentRoundHistory,
      { round: this.currentRoundHistory.length + 1, country: this.challenger.name, correct: isCorrect },
    ];

    if (isCorrect) {
      this.streak++;
      this.bestStreak = Math.max(this.bestStreak, this.streak);
      this.isRevealed = true; // briefly reveal the population during the flash

      this._cdr.markForCheck();

      // Hold the correct-guess glow just long enough to register, then
      // promote the challenger and roll a new one.
      setTimeout(() => {
        this.champion = this.challenger;
        this._nextChallenger();
        this.isFlashing = false;
        this._cdr.markForCheck();
      }, 550);
    } else {
      this.isRevealed = true;
      this.isGameOver = true;

      // Game over: file this game's final streak into the session history.
      this.gameHistory = [
        ...this.gameHistory,
        { gameNumber: this._gameNumber, score: this.streak },
      ];

      this._cdr.markForCheck();
    }
  }

  /**
   * Saturation scales relative to the best streak reached this session, so
   * "green-ness" reflects how a game stacks up against your own record
   * rather than an arbitrary fixed scale.
   */
  public toGreenSaturation(score: number): string {
    const max = Math.max(this.bestStreak, 1);
    const ratio = Math.min(Math.max(score / max, 0), 1);
    const lightness = 100 - ratio * 60;
    return `hsl(120, 70%, ${lightness}%)`;
  }

  public formatPopulation(value: number): string {
    return new Intl.NumberFormat('en-US').format(value);
  }
}