import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { LanguagesService } from '../services/languages.service';
import * as L from 'leaflet';
import { BehaviorSubject, combineLatest, map, shareReplay } from 'rxjs';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  OnInit,
  ViewChild,
} from '@angular/core';

interface LanguageCountries {
  language: string;
  countries: string[]; // country names, matched against GeoJSON feature.properties.name
}

@Component({
  selector: 'app-guess-the-language',
  imports: [CommonModule, FormsModule],
  templateUrl: './guess-the-language.component.html',
  styleUrl: './guess-the-language.component.css',
})
export class GuessTheLanguageComponent implements OnInit, AfterViewInit {
  private _languagesService = inject(LanguagesService);
  private _destroyRef = inject(DestroyRef);
  private _cdr = inject(ChangeDetectorRef);

  private _reroll$ = new BehaviorSubject<void>(undefined);

  // Only languages spoken in a handful of countries or more make a fair
  // round — a language spoken in exactly 1 country is a giveaway from the
  // map shape alone. Tune the threshold to taste.
  public languages$ = this._languagesService
    .getLanguagesSpokenInMinKCountries(3)
    .pipe(shareReplay(1));

  public randomLanguage$ = combineLatest([this.languages$, this._reroll$]).pipe(
    map(([languages]) => languages[Math.floor(Math.random() * languages.length)]),
    shareReplay(1)
  );

  public currentLanguage: LanguageCountries | null = null;
  public guessText = '';
  public hasGuessed = false;
  public isCorrect = false;

  // --- Autocomplete dropdown ---
  public allLanguageNames: string[] = [];
  public filteredLanguageNames: string[] = [];
  public isDropdownOpen = false;

  // --- Session history ---
  public guessHistory: { gameNumber: number; language: string; correct: boolean }[] = [];

  public get accuracyPct(): number {
    if (this.guessHistory.length === 0) return 0;
    const correctCount = this.guessHistory.filter((entry) => entry.correct).length;
    return Math.round((correctCount / this.guessHistory.length) * 100);
  }

  @ViewChild('mapContainer', { static: true })
  private mapContainer!: ElementRef<HTMLDivElement>;

  private map!: L.Map;
  private countriesLayer: L.GeoJSON | null = null;
  private worldGeoData: any = null;

  ngOnInit(): void {
    this.languages$
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe((languages) => {
        this.allLanguageNames = languages
          .map((l) => l.language)
          .sort((a, b) => a.localeCompare(b));
        this.filteredLanguageNames = this.allLanguageNames;
      });

    this.randomLanguage$
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe((language) => {
        this.currentLanguage = language;
        this.hasGuessed = false;
        this.guessText = '';
        this.isCorrect = false;
        this.filteredLanguageNames = this.allLanguageNames;
        this._cdr.markForCheck();
        this.paintMap();
      });
  }

  ngAfterViewInit(): void {
    this.map = L.map(this.mapContainer.nativeElement, {
      center: [20, 0],
      zoom: 2,
      minZoom: 2,
      maxBounds: [
        [-90, -180],
        [90, 180],
      ],
      maxBoundsViscosity: 1.0,
      // No need for click-to-guess interaction here — text/select guess instead.
      dragging: true,
      scrollWheelZoom: true,
    });

    // NOTE: swap this path for wherever your per-country boundary GeoJSON
    // actually lives — this is NOT the same file as world-land.geojson,
    // which appears to be undivided landmass only.
    fetch('./world-countries.geojson')
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load GeoJSON: ${res.status}`);
        return res.json();
      })
      .then((geoData) => {
        this.worldGeoData = geoData;
        this.paintMap();
        this.map.invalidateSize();
      })
      .catch((err) => {
        console.error('Error loading world countries data:', err);
      });
  }

  /**
   * (Re)draws the countries layer, coloring features whose name matches
   * the current language's speaking countries.
   */
  private paintMap(): void {
    if (!this.map || !this.worldGeoData || !this.currentLanguage) return;

    if (this.countriesLayer) {
      this.map.removeLayer(this.countriesLayer);
      this.countriesLayer = null;
    }

    const speakingCountries = new Set(this.currentLanguage.countries);

    this.countriesLayer = L.geoJSON(this.worldGeoData, {
      style: (feature) => {
        const name = feature?.properties?.['name'];
        const speaksLanguage = name && speakingCountries.has(name);

        return {
          color: '#14213d',
          weight: 0.6,
          fillColor: speaksLanguage ? '#cc3b3b' : '#c9a24b', 
          fillOpacity: speaksLanguage ? 0.9 : 1,
        };
      },
    }).addTo(this.map);
  }

  public onGuessInputFocus(): void {
    this.filterLanguages();
    this.isDropdownOpen = true;
  }

  public onGuessInputChange(): void {
    this.filterLanguages();
    this.isDropdownOpen = true;
  }

  public onGuessInputBlur(): void {
    // Delay so a click on a dropdown option registers before the list closes.
    setTimeout(() => {
      this.isDropdownOpen = false;
      this._cdr.markForCheck();
    }, 150);
  }

  public selectLanguage(name: string): void {
    this.guessText = name;
    this.isDropdownOpen = false;
  }

  private filterLanguages(): void {
    const query = this.guessText.trim().toLowerCase();
    this.filteredLanguageNames = query
      ? this.allLanguageNames.filter((name) => name.toLowerCase().includes(query))
      : this.allLanguageNames;
  }

  public onLockInGuess(): void {
    if (!this.currentLanguage || !this.guessText.trim()) return;

    this.isCorrect =
      this.guessText.trim().toLowerCase() ===
      this.currentLanguage.language.trim().toLowerCase();
    this.hasGuessed = true;
    this._cdr.markForCheck();
  }

  public nextLanguage(): void {
    if (this.currentLanguage && this.hasGuessed) {
      this.guessHistory = [
        ...this.guessHistory,
        {
          gameNumber: this.guessHistory.length + 1,
          language: this.currentLanguage.language,
          correct: this.isCorrect,
        },
      ];
    }

    this._reroll$.next();
  }
}