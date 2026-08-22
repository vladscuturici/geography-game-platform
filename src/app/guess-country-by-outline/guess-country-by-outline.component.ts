import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import * as L from 'leaflet';
import { BehaviorSubject } from 'rxjs';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  ViewChild,
} from '@angular/core';

interface CountryFeature {
  name: string;
  geojson: any; // single GeoJSON Feature for this country
}

@Component({
  selector: 'app-guess-country-by-outline',
  imports: [CommonModule, FormsModule],
  templateUrl: './guess-country-by-outline.component.html',
  styleUrl: './guess-country-by-outline.component.css',
})
export class GuessCountryByOutlineComponent implements AfterViewInit {
  private _destroyRef = inject(DestroyRef);
  private _cdr = inject(ChangeDetectorRef);

  private _reroll$ = new BehaviorSubject<void>(undefined);

  public currentCountry: CountryFeature | null = null;
  public guessText = '';
  public hasGuessed = false;
  public isCorrect = false;

  // --- Autocomplete dropdown ---
  public allCountryNames: string[] = [];
  public filteredCountryNames: string[] = [];
  public isDropdownOpen = false;

  // --- Session history ---
  public guessHistory: { gameNumber: number; country: string; correct: boolean }[] = [];

  public get accuracyPct(): number {
    if (this.guessHistory.length === 0) return 0;
    const correctCount = this.guessHistory.filter((entry) => entry.correct).length;
    return Math.round((correctCount / this.guessHistory.length) * 100);
  }

  @ViewChild('mapContainer', { static: true })
  private mapContainer!: ElementRef<HTMLDivElement>;

  private map!: L.Map;
  private outlineLayer: L.GeoJSON | null = null;

  // All country features from the source GeoJSON, kept around so a reroll
  // is just "pick a different one" with no re-fetch.
  private allFeatures: any[] = [];

  ngAfterViewInit(): void {
    this.map = L.map(this.mapContainer.nativeElement, {
      center: [20, 0],
      zoom: 2,
      // The outline is the whole game — no dragging/zooming away from it,
      // and no basemap tiles that could give away location context.
      dragging: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      boxZoom: false,
      touchZoom: false,
      keyboard: false,
      zoomControl: false,
      attributionControl: false,
    });

    fetch('./world-countries.geojson')
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load GeoJSON: ${res.status}`);
        return res.json();
      })
      .then((geoData) => {
        this.allFeatures = (geoData?.features ?? []).filter(
          (f: any) => !!f?.properties?.['name']
        );

        this.allCountryNames = this.allFeatures
          .map((f) => f.properties['name'] as string)
          .sort((a, b) => a.localeCompare(b));
        this.filteredCountryNames = this.allCountryNames;

        this._reroll$.pipe(takeUntilDestroyed(this._destroyRef)).subscribe(() => {
          this.pickRandomCountry();
        });
      })
      .catch((err) => {
        console.error('Error loading world countries data:', err);
      });
  }

  private pickRandomCountry(): void {
    if (this.allFeatures.length === 0) return;

    const feature = this.allFeatures[Math.floor(Math.random() * this.allFeatures.length)];

    this.currentCountry = {
      name: feature.properties['name'],
      geojson: feature,
    };
    this.hasGuessed = false;
    this.guessText = '';
    this.isCorrect = false;
    this.filteredCountryNames = this.allCountryNames;
    this._cdr.markForCheck();
    this.paintOutline();
  }

  /**
   * Draws only the current country's shape, filled solid, with no other
   * countries or basemap visible, then fits the map view to it so shape
   * (not position) is the only clue.
   */
  private paintOutline(): void {
    if (!this.map || !this.currentCountry) return;

    if (this.outlineLayer) {
      this.map.removeLayer(this.outlineLayer);
      this.outlineLayer = null;
    }

    this.outlineLayer = L.geoJSON(this.currentCountry.geojson, {
      style: {
        color: '#14213d',
        weight: 1.5,
        fillColor: '#14213d',
        fillOpacity: 0.92,
      },
    }).addTo(this.map);

    const bounds = this.outlineLayer.getBounds();
    if (bounds.isValid()) {
      // Padding keeps small/thin countries from touching the map edges.
      this.map.fitBounds(bounds, { padding: [40, 40] });
    }
  }

  public onGuessInputFocus(): void {
    this.filterCountries();
    this.isDropdownOpen = true;
  }

  public onGuessInputChange(): void {
    this.filterCountries();
    this.isDropdownOpen = true;
  }

  public onGuessInputBlur(): void {
    // Delay so a click on a dropdown option registers before the list closes.
    setTimeout(() => {
      this.isDropdownOpen = false;
      this._cdr.markForCheck();
    }, 150);
  }

  public selectCountry(name: string): void {
    this.guessText = name;
    this.isDropdownOpen = false;
  }

  private filterCountries(): void {
    const query = this.guessText.trim().toLowerCase();
    this.filteredCountryNames = query
      ? this.allCountryNames.filter((name) => name.toLowerCase().includes(query))
      : this.allCountryNames;
  }

  public onLockInGuess(): void {
    if (!this.currentCountry || !this.guessText.trim()) return;

    this.isCorrect =
      this.guessText.trim().toLowerCase() ===
      this.currentCountry.name.trim().toLowerCase();
    this.hasGuessed = true;
    this._cdr.markForCheck();
  }

  public nextCountry(): void {
    if (this.currentCountry && this.hasGuessed) {
      this.guessHistory = [
        ...this.guessHistory,
        {
          gameNumber: this.guessHistory.length + 1,
          country: this.currentCountry.name,
          correct: this.isCorrect,
        },
      ];
    }

    this._reroll$.next();
  }
}