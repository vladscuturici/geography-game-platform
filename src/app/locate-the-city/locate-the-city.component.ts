import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CitiesService } from '../services/cities.service';
import { GameService } from '../services/game.service';
import * as L from 'leaflet';
import { BehaviorSubject, combineLatest, map, shareReplay, switchMap } from 'rxjs';
import { RandomCityPicker } from '../strategies/item-pick-strategy';
import { CommonModule } from '@angular/common';
import { City } from '../models/cities.model';
import { CountriesService } from '../services/countries.service';
import { ActivatedRoute, Router } from '@angular/router';

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

// URL-facing slugs. Lowercase/kebab-friendly so the route segment reads
// naturally (e.g. /locate-the-city/europe) — display labels are derived
// from this via REGION_LABELS below.
export type RegionSlug = 'world' | 'europe' | 'americas' | 'asia' | 'africa' | 'oceania';

const VALID_REGION_SLUGS: RegionSlug[] = ['world', 'europe', 'americas', 'asia', 'africa', 'oceania'];

const REGION_LABELS: Record<RegionSlug, string> = {
  world: 'World',
  europe: 'Europe',
  americas: 'Americas',
  asia: 'Asia',
  africa: 'Africa',
  oceania: 'Oceania',
};

// Maps a region slug to the value expected in Country.region. Adjust the
// right-hand values if CountriesService uses different region naming.
const REGION_TO_COUNTRY_REGION: Record<Exclude<RegionSlug, 'world'>, string> = {
  europe: 'Europe',
  americas: 'Americas',
  asia: 'Asia',
  africa: 'Africa',
  oceania: 'Oceania',
};

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
  private _route = inject(ActivatedRoute);
  private _router = inject(Router);

  // ---- Region selection (must be initialized BEFORE cities$, since
  // cities$'s initializer reads this.selectedRegion$ synchronously at
  // class-field-init time — field initializers run top-to-bottom).
  private _selectedRegion$ = new BehaviorSubject<RegionSlug>('world');
  public get selectedRegion$() {
    return this._selectedRegion$.asObservable();
  }
  public selectedRegion: RegionSlug = 'world';
  public readonly regionLabels = REGION_LABELS;

  // Cities now depend on the selected region, so the pipeline is driven by
  // both the countries list AND the current region slug from the route.
  public cities$ = combineLatest([
    this._countriesService.getAllCountries(),
    this.selectedRegion$,
  ]).pipe(
    switchMap(([countries, region]) => {
      const regionCountryCodes =
        region === 'world'
          ? countries.map((c) => c.alpha2Code)
          : countries
              .filter((c) => c.region === REGION_TO_COUNTRY_REGION[region as Exclude<RegionSlug, 'world'>])
              .map((c) => c.alpha2Code);

      return this._citiesService.getTopCitiesCappedForRegion(regionCountryCodes, 300, 5);
    }),
    shareReplay(1)
  );

  public randomCity$ = combineLatest([this.cities$, this._reroll$]).pipe(
    map(([cities]) => this._randomPicker.pick(cities)),
    shareReplay(1)
  );

  public currentCity: City | null = null;
  public hasGuessed = false;
  public currentScore = 0;
  public scoreWasHalved = false;
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

  private actualCityMarker: L.Marker | null = null;
  private actualCityIcon!: L.Icon;
  private distanceLine: L.Polyline | null = null;
  private distanceLabel: L.Marker | null = null;

  // ---- Selectors

  public borderMode: 'none' | 'shown' = 'none';

  // Once "Show borders" is pressed for the current round, you can't flip
  // back to "No borders" until the next city loads.
  public borderModeLocked = false;

  // Both base maps: only ONE of these is ever attached to the Leaflet map
  // at a time, so there's never a seam between two overlapping layers.
  private worldLandGeoData: any = null;
  private worldCountriesGeoData: any = null;
  private landLayer: L.GeoJSON | null = null;
  private bordersLayer: L.GeoJSON | null = null;

  public setBorderMode(mode: 'none' | 'shown'): void {
    if (this.hasGuessed) return; // no changing border mode after locking in a guess
    if (this.borderModeLocked && mode === 'none') return; // can't go back to "no borders"

    this.borderMode = mode;

    if (mode === 'shown') {
      this.borderModeLocked = true;
      this.showBordersOnMap();
    }
  }

  /**
   * Navigates to /locate-the-city/:region. The actual state update
   * (selectedRegion, cities refetch, history reset) happens reactively in
   * ngOnInit's paramMap subscription, so this method's only job is to
   * change the URL.
   */
  public setRegion(region: RegionSlug): void {
    if (region === this.selectedRegion) return;
    this._router.navigate(['/locate-the-city', region]);
  }

  @ViewChild('mapContainer', { static: true })
  private mapContainer!: ElementRef<HTMLDivElement>;

  private map!: L.Map;

  ngOnInit(): void {
    // Route param drives selectedRegion. Since navigating between
    // /locate-the-city/:region segments reuses this same component
    // instance (only the param changes), we must react to paramMap
    // rather than reading the param once.
    this._route.paramMap.pipe(takeUntilDestroyed(this._destroyRef)).subscribe((params) => {
      const rawRegion = params.get('region');
      const region: RegionSlug = VALID_REGION_SLUGS.includes(rawRegion as RegionSlug)
        ? (rawRegion as RegionSlug)
        : 'world';

      // Guard against a bad/unknown URL segment by redirecting to /world,
      // replacing history so the invalid URL isn't left in back-button history.
      if (rawRegion !== region) {
        this._router.navigate(['/locate-the-city', region], { replaceUrl: true });
        return;
      }

      const isActualChange = region !== this.selectedRegion;

      this.selectedRegion = region;
      this._selectedRegion$.next(region);

      // "the page should refresh (basically the sidebar)" — new region
      // means a fresh session: wipe history/averages, clear any in-flight
      // round state (marker/answer/border layer), and reroll immediately
      // rather than waiting for the player to finish the current round.
      if (isActualChange) {
        this.guessHistory = [];
        this.resetRoundState();
        this._reroll$.next();
      }

      this._cdr.markForCheck();
    });

    this.randomCity$.pipe(takeUntilDestroyed(this._destroyRef)).subscribe((city) => {
      this.currentCity = city;
      this._cdr.markForCheck();
    });
  }

  ngAfterViewInit(): void {
    delete (L.Icon.Default.prototype as any)._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'leaflet/marker-icon-2x.png',
      iconUrl: 'leaflet/marker-icon.png',
      shadowUrl: 'leaflet/marker-shadow.png',
    });

    this.actualCityIcon = L.icon({
      iconUrl: 'leaflet/marker-icon.png',
      iconRetinaUrl: 'leaflet/marker-icon-2x.png',
      shadowUrl: 'leaflet/marker-shadow.png',
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      shadowSize: [41, 41],
      className: 'actual-city-marker-icon',
    });

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
        this.worldLandGeoData = geoData;

        this.landLayer = L.geoJSON(geoData, {
          style: {
            color: 'transparent',
            fillColor: '#c9a24b',
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

  /**
   * Swaps the plain land layer out for the per-country borders layer.
   * Fetches world-countries.geojson once (cached after first use). Since
   * only one base layer is ever attached to the map at a time, there is
   * no overlapping/seam issue between the two datasets.
   */
  // private showBordersOnMap(): void {
  //   if (this.bordersLayer) return; // already drawn for this round

  //   if (this.worldCountriesGeoData) {
  //     this.swapToBordersLayer(this.worldCountriesGeoData);
  //     return;
  //   }

  //   fetch('./world-countries.geojson')
  //     .then((res) => {
  //       if (!res.ok) throw new Error(`Failed to load GeoJSON: ${res.status}`);
  //       return res.json();
  //     })
  //     .then((geoData) => {
  //       this.worldCountriesGeoData = geoData;
  //       // Guard in case the mode/round got reset before this resolved.
  //       if (this.borderMode === 'shown' || this.hasGuessed) {
  //         this.swapToBordersLayer(geoData);
  //       }
  //     })
  //     .catch((err) => {
  //       console.error('Error loading world countries data:', err);
  //     });
  // }

  private swapToBordersLayer(geoData: any): void {
    if (this.landLayer) {
      this.map.removeLayer(this.landLayer);
      this.landLayer = null;
    }

    // Already showing borders (e.g. player pressed "Show borders" and then
    // locked in) — no need to redraw.
    if (this.bordersLayer) return;

    this.bordersLayer = L.geoJSON(geoData, {
      style: {
        color: '#14213d',
        weight: 0.6,
        fillColor: '#c9a24b',
        fillOpacity: 1,
      },
    }).addTo(this.map);
  }

  /**
   * Swaps back to the plain merged land layer (no visible borders).
   * Reuses cached world-land.geojson data if already fetched.
   */
  private restoreLandLayer(): void {
    if (this.bordersLayer) {
      this.map.removeLayer(this.bordersLayer);
      this.bordersLayer = null;
    }

    if (this.landLayer) return; // already showing plain land

    if (this.worldLandGeoData) {
      this.landLayer = L.geoJSON(this.worldLandGeoData, {
        style: {
          color: 'transparent',
          fillColor: '#c9a24b',
          fillOpacity: 1,
        },
      }).addTo(this.map);
    }
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
        const rawScore = result.score;
        this.scoreWasHalved = this.borderMode === 'shown';
        this.currentScore = this.scoreWasHalved ? Math.round(rawScore / 2) : rawScore;
        this.currentDistance = result.distance;
        this.hasGuessed = true;

        const actualLatLng: [number, number] = [
          this.currentCity!.latitude,
          this.currentCity!.longitude,
        ];

        this.actualCityMarker = L.marker(actualLatLng, {
          icon: this.actualCityIcon,
        }).addTo(this.map);

        this.distanceLine = L.polyline([this.guessLatLng!, actualLatLng], {
          color: '#cc002c',
          weight: 3,
          dashArray: '6, 8',
        }).addTo(this.map);

        const midLat = (this.guessLatLng!.lat + actualLatLng[0]) / 2;
        const midLng = (this.guessLatLng!.lng + actualLatLng[1]) / 2;

        this.distanceLabel = L.marker([midLat, midLng], {
          icon: L.divIcon({
            className: 'distance-label',
            html: `${result.distance.toFixed(1)} km`,
            iconSize: undefined,
          }),
          interactive: false,
        }).addTo(this.map);

        // Reveal the answer with country borders visible. bringGuessResultToFront
        // is passed in as a callback so it fires AFTER the borders layer is
        // actually on the map — whether that happens synchronously (cached
        // geoData) or asynchronously (first-time fetch). Calling it unconditionally
        // right after showBordersOnMap() only worked for the sync case.
        this.showBordersOnMap(() => this.bringGuessResultToFront());

        this._cdr.markForCheck();
      });
  }

  /**
   * Swaps the plain land layer out for the per-country borders layer.
   * Fetches world-countries.geojson once (cached after first use). Since
   * only one base layer is ever attached to the map at a time, there is
   * no overlapping/seam issue between the two datasets.
   *
   * @param onLayerReady optional callback fired right after the borders
   * layer is actually attached to the map — needed by callers (like
   * onLockInGuess) that must re-stack other layers on top of it, since
   * this method can resolve either synchronously (cached data) or
   * asynchronously (first-time fetch), and the caller can't otherwise tell
   * which happened.
   */
  private showBordersOnMap(onLayerReady?: () => void): void {
    if (this.bordersLayer) {
      onLayerReady?.();
      return;
    }

    if (this.worldCountriesGeoData) {
      this.swapToBordersLayer(this.worldCountriesGeoData);
      onLayerReady?.();
      return;
    }

    fetch('./world-countries.geojson')
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load GeoJSON: ${res.status}`);
        return res.json();
      })
      .then((geoData) => {
        this.worldCountriesGeoData = geoData;
        // Guard in case the mode/round got reset before this resolved.
        if (this.borderMode === 'shown' || this.hasGuessed) {
          this.swapToBordersLayer(geoData);
          onLayerReady?.();
        }
      })
      .catch((err) => {
        console.error('Error loading world countries data:', err);
      });
  }

  /**
   * Re-stacks all guess-result layers (guess marker, actual-city marker,
   * distance line, distance label) above the border overlay. Needed because
   * guessMarker is placed on click — before Lock In, and therefore before
   * the borders layer exists — so plain Leaflet add-order can't put it on
   * top; each layer's own bringToFront() must be called explicitly.
   */
  private bringGuessResultToFront(): void {
    this.guessMarker?.setZIndexOffset(1000);
    this.actualCityMarker?.setZIndexOffset(1000);
    this.distanceLabel?.setZIndexOffset(1000);
    this.distanceLine?.bringToFront();
  }

  public toGreenSaturation(score: number): string {
    const clamped = Math.min(Math.max(score, 0), 100);
    const lightness = 100 - (clamped / 100) * 60;
    return `hsl(120, 70%, ${lightness}%)`;
  }

  /**
   * Clears everything tied to the current round's map state: guess marker,
   * actual-city marker/line/label, and border overlay — without touching
   * guessHistory or triggering a reroll. Shared by nextCity() and by the
   * region-change handler in ngOnInit (which also needs a fresh map but
   * additionally wipes history and rerolls, done by the caller).
   */
  private resetRoundState(): void {
    this.hasGuessed = false;
    this.guessLatLng = null;
    this.scoreWasHalved = false;

    this.borderMode = 'none';
    this.borderModeLocked = false;
    this.restoreLandLayer();

    if (this.guessMarker) {
      this.map.removeLayer(this.guessMarker);
      this.guessMarker = null;
    }

    if (this.actualCityMarker) {
      this.map.removeLayer(this.actualCityMarker);
      this.actualCityMarker = null;
    }

    if (this.distanceLine) {
      this.map.removeLayer(this.distanceLine);
      this.distanceLine = null;
    }

    if (this.distanceLabel) {
      this.map.removeLayer(this.distanceLabel);
      this.distanceLabel = null;
    }
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

    this.resetRoundState();

    this._reroll$.next();
    this._cdr.markForCheck();
  }
}