import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CitiesService } from '../services/cities.service';
import { GameService } from '../services/game.service';
import * as L from 'leaflet';
import { BehaviorSubject, combineLatest, map, shareReplay, switchMap } from 'rxjs';
import { RandomCityPicker } from '../strategies/item-pick-strategy';
import { CommonModule } from '@angular/common';
import { City } from '../models/cities.model';
import { CountriesService } from '../services/countries.service';

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

@Component({
  selector: 'app-locate-the-city',
  imports: [CommonModule],
  templateUrl: './locate-the-city.component.html',
  styleUrl: './locate-the-city.component.css',
})
export class LocateTheCityComponent implements OnInit, AfterViewInit {
  private _citiesService = inject(CitiesService);
  private _countriesService = inject(CountriesService);
  private _gameService = inject(GameService);
  private _randomPicker = new RandomCityPicker();
  private _reroll$ = new BehaviorSubject<void>(undefined);
  private _destroyRef = inject(DestroyRef);
  private _cdr = inject(ChangeDetectorRef);

  public cities$ = this._countriesService.getAllCountries().pipe(
    switchMap((countries) =>
      this._citiesService.getTopCitiesCapped(
        countries.map((c) => c.alpha2Code),
        300,
        5
      )
    ),
    shareReplay(1)
  );

  public randomCity$ = combineLatest([this.cities$, this._reroll$]).pipe(
    map(([cities]) => this._randomPicker.pick(cities)),
    shareReplay(1)
  );

  public currentCity: City | null = null;
  public hasGuessed = false;
  public currentScore = 0;
  public currentDistance = 0;

  // --- Session history ---
  public guessHistory: { gameNumber: number; cityName: string; points: number }[] = [];

  public get averageScore(): number {
    if (this.guessHistory.length === 0) return 0;
    const total = this.guessHistory.reduce((sum, entry) => sum + entry.points, 0);
    return Math.round((total / this.guessHistory.length) * 10) / 10;
  }

  private guessLatLng: L.LatLng | null = null;
  private guessMarker: L.Marker | null = null;

  @ViewChild('mapContainer', { static: true })
  private mapContainer!: ElementRef<HTMLDivElement>;

  private map!: L.Map;

  ngOnInit(): void {
    this.randomCity$
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe((city) => {
        this.currentCity = city;
        this._cdr.markForCheck();
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
    });

    fetch('./world-land.geojson')
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load GeoJSON: ${res.status}`);
        return res.json();
      })
      .then((geoData) => {
        L.geoJSON(geoData, {
          style: {
            color: 'transparent',
            fillColor: '#f2efe6',
            fillOpacity: 1,
          },
        }).addTo(this.map);

        this.map.invalidateSize();
        this.map.setView([20, 0], 2);
      })
      .catch((err) => {
        console.error('Error loading world land data:', err);
      });

    this.map.on('click', (e: L.LeafletMouseEvent) => {
      if (this.hasGuessed) return;

      this.guessLatLng = e.latlng;

      if (this.guessMarker) {
        this.guessMarker.setLatLng(e.latlng);
      } else {
        this.guessMarker = L.marker(e.latlng).addTo(this.map);
      }

      this._cdr.markForCheck();
    });
  }

  public onLockInGuess(): void {
    if (!this.guessLatLng || !this.currentCity) return;

    this._gameService
      .locateCityScore(
        this.currentCity.latitude,
        this.currentCity.longitude,
        this.guessLatLng.lat,
        this.guessLatLng.lng
      )
      .subscribe((result) => {
        this.currentScore = result.score;
        this.currentDistance = result.distance;
        this.hasGuessed = true;
        this._cdr.markForCheck();
      });
  }

  public toGreenSaturation(score: number): string {
    const clamped = Math.min(Math.max(score, 0), 100);
    const lightness = 100 - (clamped / 100) * 60;
    return `hsl(120, 70%, ${lightness}%)`;
  }

  public nextCity(): void {
    if (this.currentCity && this.hasGuessed) {
      this.guessHistory = [
        ...this.guessHistory,
        {
          gameNumber: this.guessHistory.length + 1,
          cityName: this.currentCity.name,
          points: this.currentScore,
        },
      ];
    }

    this.hasGuessed = false;
    this.guessLatLng = null;

    if (this.guessMarker) {
      this.map.removeLayer(this.guessMarker);
      this.guessMarker = null;
    }

    this._reroll$.next();
    this._cdr.markForCheck();
  }
}