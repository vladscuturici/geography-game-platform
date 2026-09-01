import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CitiesService } from '../services/cities.service';
import { GameService } from '../services/game.service';
import * as L from 'leaflet';
import { BehaviorSubject, combineLatest, map, shareReplay, switchMap, tap } from 'rxjs';
import { RandomCityPicker } from '../strategies/item-pick-strategy';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { City } from '../models/cities.model';
import { CountriesService } from '../services/countries.service';
import { ActivatedRoute, Router } from '@angular/router';
import { WikiService } from '../services/wiki.service';
import {
  REGION_LABELS,
  REGION_TO_COUNTRY_REGION,
  VALID_REGION_SLUGS,
  COUNTRY_MODE_CODES,
  COUNTRY_SCORE_DISTANCE_SCALE_KM,
  RegionSlug,
  REGION_SCORE_DISTANCE_SCALE_KM
} from './cities_data';

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


// Player keeps this fraction of the raw score when borders are shown.
const BORDER_PENALTY_MULTIPLIER = 0.75; // 25% penalty

// How many cities to request in per-country mode. The service already
// caps this to whatever the country actually has if it has fewer.
const COUNTRY_MODE_CITY_LIMIT = 100;

// Discriminated union driving the cities$ pipeline — either a region
// (including 'world') or a single selected country.
type ViewMode = { type: 'region'; region: RegionSlug } | { type: 'country'; code: string };

export interface CountryOption {
  code: string;
  name: string;
}

@Component({
  selector: 'app-locate-the-city',
  imports: [CommonModule, FormsModule],
  templateUrl: './locate-the-city.component.html',
  styleUrl: './locate-the-city.component.css',
})
export class LocateTheCityComponent implements OnInit, AfterViewInit {
  private _wikiService = inject(WikiService);
  private _citiesService = inject(CitiesService);
  private _countriesService = inject(CountriesService);
  private _gameService = inject(GameService);
  private _randomPicker = new RandomCityPicker();
  private _reroll$ = new BehaviorSubject<void>(undefined);
  private _destroyRef = inject(DestroyRef);
  private _cdr = inject(ChangeDetectorRef);
  private _route = inject(ActivatedRoute);
  private _router = inject(Router);

  private _landLayerMode: 'world' | 'country' | null = null;

  // ---- Region selection (must be initialized BEFORE cities$, since
  // cities$'s initializer reads this._viewMode$ synchronously at
  // class-field-init time — field initializers run top-to-bottom).
  private _viewMode$ = new BehaviorSubject<ViewMode>({ type: 'region', region: 'world' });
  public selectedRegion: RegionSlug = 'world';
  public readonly regionLabels = REGION_LABELS;

  // ---- Per-country mode state
  public isCountryMode = false;
  public selectedCountryCode: string | null = null;
  public selectedCountryName: string | null = null;

  public showCountryPicker = false;
  public pickerCountries: CountryOption[] = [];
  public pickerSelectedCode: string | null = null;
  private _pickerCountriesLoaded = false;

  // Cities now depend on the selected view mode (region OR single
  // country), so the pipeline is driven by both the countries list AND
  // the current mode from the route.
  public cities$ = combineLatest([
    this._countriesService.getAllCountries(),
    this._viewMode$,
  ]).pipe(
    switchMap(([countries, mode]) => {
      if (mode.type === 'country') {
        return this._citiesService.getTopCitiesForCountry(mode.code, COUNTRY_MODE_CITY_LIMIT);
      }

      const regionCountryCodes =
        mode.region === 'world'
          ? countries.map((c) => c.alpha2Code)
          : countries
              .filter((c) => c.region === REGION_TO_COUNTRY_REGION[mode.region as Exclude<RegionSlug, 'world'>])
              .map((c) => c.alpha2Code);

      return this._citiesService.getTopCitiesCappedForRegion(regionCountryCodes, 300, 5);
    }),
    tap((cities) => {
      this._randomPicker.reset(); // reset exactly when the pool actually changes
      this._latestCities = cities;
      this.fitMapToCurrentMode(cities);
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
  public rawScore = 0;
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

  // Latest cities$ emission, kept around so map-fitting logic (which can
  // be triggered from two different places — cities$ itself, and the
  // one-time world-land geojson load callback) always has fresh data
  // without re-subscribing.
  private _latestCities: City[] = [];

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
    if (!this.isCountryMode && region === this.selectedRegion) return;
    this._router.navigate(['/locate-the-city', region]);
  }

  // ---- Per-country picker

  /**
   * Opens the country picker popup. Country names are fetched (and
   * filtered down to COUNTRY_MODE_CODES) once and cached — reopening the
   * picker later doesn't re-fetch.
   */
  public openCountryPicker(): void {
    this.pickerSelectedCode = this.selectedCountryCode ?? COUNTRY_MODE_CODES[0];
    this.showCountryPicker = true;

    if (this._pickerCountriesLoaded) {
      this._cdr.markForCheck();
      return;
    }

    this._countriesService
      .getAllCountries()
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe((countries) => {
        this.pickerCountries = countries
          .filter((c) => COUNTRY_MODE_CODES.includes(c.alpha2Code))
          .map((c) => ({ code: c.alpha2Code, name: c.name }))
          .sort((a, b) => a.name.localeCompare(b.name));

        if (!this.pickerSelectedCode && this.pickerCountries.length > 0) {
          this.pickerSelectedCode = this.pickerCountries[0].code;
        }

        this._pickerCountriesLoaded = true;
        this._cdr.markForCheck();
      });
  }

  public closeCountryPicker(): void {
    this.showCountryPicker = false;
  }

  /**
   * Confirms the picker's current selection and navigates to
   * /locate-the-city/country/:code. Actual state update happens
   * reactively in ngOnInit's paramMap subscription, same pattern as
   * setRegion().
   */
  public confirmCountryPicker(): void {
    if (!this.pickerSelectedCode) return;
    this.showCountryPicker = false;
    this._router.navigate(['/locate-the-city', 'country', this.pickerSelectedCode]);
  }

  @ViewChild('mapContainer', { static: true })
  private mapContainer!: ElementRef<HTMLDivElement>;

  private map!: L.Map;

  ngOnInit(): void {
    // Route param drives selectedRegion / selectedCountryCode. Since
    // navigating between /locate-the-city/... segments reuses this same
    // component instance (only the params change), we must react to
    // paramMap rather than reading params once.
    this._wikiService
      .getWikiArticlesByPoint(44.4268, 26.1025, 10) // 25km offset, Bucharest
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe((articles) => {
        console.log('Wiki articles near 47°26′N 24°24′E:', articles);
      });

    this._route.paramMap.pipe(takeUntilDestroyed(this._destroyRef)).subscribe((params) => {
      const countryCodeParam = params.get('countryCode');

      if (countryCodeParam) {
        const code = countryCodeParam.toUpperCase();

        if (!COUNTRY_MODE_CODES.includes(code)) {
          this._router.navigate(['/locate-the-city', 'world'], { replaceUrl: true });
          return;
        }

        const isActualChange = !this.isCountryMode || this.selectedCountryCode !== code;

        this.isCountryMode = true;
        this.selectedCountryCode = code;
        this._viewMode$.next({ type: 'country', code });
        this._updateSelectedCountryName(code);

        if (isActualChange) {
          this.guessHistory = [];
          this.resetRoundState();
          this._reroll$.next();
        }

        if (this.map) {
          this.showCountryOnlyMap(code); // ← swap in the country-only shape
        }

        this._cdr.markForCheck();
        return;
      }

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

      const isActualChange = this.isCountryMode || region !== this.selectedRegion;

      this.isCountryMode = false;
      this.selectedCountryCode = null;
      this.selectedCountryName = null;
      this.selectedRegion = region;
      this._viewMode$.next({ type: 'region', region });

      if (this.map) {
        this.map.setMinZoom(2); // undo the country-mode zoom-out lock
      }

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

  /** Resolves and caches the display name for the currently selected country code. */
  private _updateSelectedCountryName(code: string): void {
    if (this.pickerCountries.length > 0) {
      const match = this.pickerCountries.find((c) => c.code === code);
      if (match) {
        this.selectedCountryName = match.name;
        return;
      }
    }

    this._countriesService
      .getAllCountries()
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe((countries) => {
        const match = countries.find((c) => c.alpha2Code === code);
        this.selectedCountryName = match?.name ?? code;
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

        // Only show it if we're not already in country mode — avoids a
        // flash of the whole world before showCountryOnlyMap swaps it out.
        if (!this.isCountryMode) {
          this.landLayer = L.geoJSON(geoData, {
            style: { color: 'transparent', fillColor: '#c9a24b', fillOpacity: 1 },
          }).addTo(this.map);
          this._landLayerMode = 'world';
        }

        this.map.invalidateSize();
        this.fitMapToCurrentMode(this._latestCities);
      })
      .catch((err) => {
        console.error('Error loading world land data:', err);
      });

    if (this.isCountryMode && this.selectedCountryCode) {
      this.showCountryOnlyMap(this.selectedCountryCode);
    } else {
      this.fitMapToCurrentMode(this._latestCities);
    }

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
   * Fits the map view to the current mode: zoomed to the bounding box of
   * the loaded cities in per-country mode, or the default world view
   * otherwise. Uses city coordinates (rather than country border geojson)
   * to compute bounds, since city data is already loaded regardless of
   * border mode and avoids needing to match country-code property names
   * inside the borders geojson.
   *
   * NOTE: this fit does NOT touch minZoom. The zoom-out floor for country
   * mode is set exactly once per "whole country" view, in
   * showCountryOnlyMap() via fitBoundsAndLockZoom(). This fit (city
   * clusters, which are usually a tighter sub-area of the country) must
   * never raise that floor, or the player could get stuck unable to zoom
   * back out to see the whole country.
   */
  private fitMapToCurrentMode(cities: City[]): void {
    if (!this.map) return;

    if (this.isCountryMode) {
      if (cities.length === 0) return; // nothing to fit to yet
      const bounds = L.latLngBounds(cities.map((c) => [c.latitude, c.longitude] as [number, number]));
      this.map.fitBounds(bounds, { padding: [40, 40], maxZoom: 8 });
    } else {
      this.map.setView([20, 0], 2);
    }
  }

  private swapToBordersLayer(geoData: any): void {
    if (this.landLayer) {
      this.map.removeLayer(this.landLayer);
      this.landLayer = null;
    }

    // Already showing borders — no need to redraw.
    if (this.bordersLayer) return;

    const dataToRender =
      this.isCountryMode && this.selectedCountryCode
        ? this.extractCountryFeatures(geoData, this.selectedCountryCode)
        : geoData;

    this.bordersLayer = L.geoJSON(dataToRender, {
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

    // In country mode the "land layer" is the single-country shape. It gets
    // removed by swapToBordersLayer() when the guess-result borders are
    // shown, so it needs to be explicitly rebuilt here — it doesn't
    // "just still be there" like the comment used to assume.
    if (this.isCountryMode) {
      if (this.landLayer && this._landLayerMode === 'country') return; // already showing it
      if (this.selectedCountryCode) {
        this.showCountryOnlyMap(this.selectedCountryCode);
      }
      return;
    }

    if (this.landLayer && this._landLayerMode === 'world') return; // already showing plain world land

    if (this.landLayer) {
      this.map.removeLayer(this.landLayer);
      this.landLayer = null;
    }

    if (this.worldLandGeoData) {
      this.landLayer = L.geoJSON(this.worldLandGeoData, {
        style: {
          color: 'transparent',
          fillColor: '#c9a24b',
          fillOpacity: 1,
        },
      }).addTo(this.map);
      this._landLayerMode = 'world';
    }
  }

  private getScoreDistanceScaleKm(): number {
    const scale = this.isCountryMode && this.selectedCountryCode
      ? COUNTRY_SCORE_DISTANCE_SCALE_KM[this.selectedCountryCode] ?? 2000
      : REGION_SCORE_DISTANCE_SCALE_KM[this.selectedRegion] ?? 2000;

    return scale * 2;
  }

  private getK(): number {
    if (this.isCountryMode && this.selectedCountryCode) {
      return 1.5;
    }
    
    return this.selectedRegion ? 2 : 3;
  }

  public onLockInGuess(): void {
    // this._gameService.createTicTacToeConditionMatrix().subscribe({
    //     next: (matrix) => {
    //         console.log('Matrix created:', matrix);
    //     },
    //     error: (err) => {
    //         console.error('Failed to create matrix:', err);
    //     },
    //     complete: () => {
    //         console.log('Matrix generation complete');
    //     }
    // });

    if (!this.guessLatLng || !this.currentCity) return;
    
    this._gameService 
      .locateCityScore(
        this.currentCity.latitude,
        this.currentCity.longitude,
        this.guessLatLng.lat,
        this.guessLatLng.lng,
        this.getScoreDistanceScaleKm(),
        this.getK()
      )
      .subscribe((result) => {
        const rawScore = result.score;
        this.scoreWasHalved = this.borderMode === 'shown';
        this.rawScore = rawScore;
        this.currentScore = this.scoreWasHalved
          ? Math.round(rawScore * BORDER_PENALTY_MULTIPLIER)
          : rawScore;
        this.currentDistance = result.distance;
        this.hasGuessed = true;

        const actualLatLng: [number, number] = [
          this.currentCity!.latitude,
          this.currentCity!.longitude,
        ];

        // Reset the view so both the guess and the actual city are visible,
        // regardless of how far the player zoomed in while guessing. Does
        // NOT touch minZoom — see fitMapToCurrentMode's note above.
        this.map.fitBounds(L.latLngBounds([this.guessLatLng!, actualLatLng]), {
          padding: [60, 60],
          maxZoom: 8,
        });

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

  private extractCountryFeatures(geoData: any, code: string): any {
    const matches = (props: any): boolean => {
      if (!props) return false;
      const value = props['ISO3166-1-Alpha-2'];
      return typeof value === 'string' && value.toUpperCase() === code;
    };

    const features = (geoData.features || []).filter((f: any) => matches(f.properties));

    if (features.length === 0 && geoData.features?.length > 0) {
      console.warn(`No match for "${code}" using ISO3166-1-Alpha-2 property.`);
    }

    return { type: 'FeatureCollection', features };
  }

  /**
   * Fits the map to `bounds` and, in country mode, sets that fit's target
   * zoom level as the new zoom-out floor (minZoom).
   *
   * Deliberately computes the target zoom via getBoundsZoom() BEFORE
   * calling fitBounds(), rather than reading map.getZoom() afterward:
   * fitBounds() animates asynchronously, so getZoom() immediately after
   * it still returns the pre-animation zoom, not the destination. Reading
   * it that way was silently ratcheting minZoom up to whatever zoom the
   * player happened to be at before this fit ran, instead of the intended
   * "whole country" level — which is exactly what caused the "can't zoom
   * out anymore" bug.
   *
   * padding must be a real L.Point (not a raw [x, y] tuple) since
   * getBoundsZoom's signature wants Point | undefined, not PointExpression.
   */
  private fitBoundsAndLockZoom(bounds: L.LatLngBounds, options: L.FitBoundsOptions): void {
    if (this.isCountryMode) {
      this.map.setMinZoom(0);
    }

    const paddingPoint = options.padding ? L.point(options.padding as L.PointTuple) : undefined;
    const targetZoom = this.map.getBoundsZoom(bounds, false, paddingPoint);
    const cappedZoom = options.maxZoom != null ? Math.min(targetZoom, options.maxZoom) : targetZoom;

    // animate: false is load-bearing here, not cosmetic. fitBounds()
    // normally animates the pan/zoom over several frames and returns
    // immediately. setMinZoom() below runs synchronously right after —
    // if the animation hasn't finished, the map's *actual* zoom is
    // still near the old value. When the new minZoom is HIGHER than
    // that in-flight zoom (shrinking country size, e.g. Russia →
    // Romania), Leaflet's setMinZoom forces an immediate setZoom() to
    // enforce the floor, but keeps whatever center the map happened to
    // be at mid-animation — teleporting to the right zoom level at the
    // WRONG location, so the new country isn't visible. Forcing the fit
    // to happen synchronously means the center is already correct by
    // the time setMinZoom can possibly force anything.
    this.map.fitBounds(bounds, { ...options, animate: false });

    if (this.isCountryMode) {
      this.map.setMinZoom(cappedZoom);
    }
  }

  private showCountryOnlyMap(code: string): void {
    if (!this.map) return;

    const render = (geoData: any) => {
      const filtered = this.extractCountryFeatures(geoData, code);

      if (this.landLayer) {
        this.map.removeLayer(this.landLayer);
        this.landLayer = null;
      }
      if (this.bordersLayer) {
        this.map.removeLayer(this.bordersLayer);
        this.bordersLayer = null;
      }

      if (filtered.features.length === 0) {
        console.warn(`No geojson features matched country code ${code} — check property name in extractCountryFeatures`);
        this._landLayerMode = null;
        return;
      }

      this.landLayer = L.geoJSON(filtered, {
        style: {
          color: 'transparent',
          fillColor: '#c9a24b',
          fillOpacity: 1,
        },
      }).addTo(this.map);
      this._landLayerMode = 'country';

      // This is the ONLY place minZoom gets locked for country mode — it
      // represents "the whole country is visible," which is the intended
      // zoom-out floor. It's idempotent: every time we re-enter country
      // mode or reset a round, this re-fits to the same outline and
      // re-asserts the same floor, so it never drifts.
      this.fitBoundsAndLockZoom(this.landLayer.getBounds(), { padding: [40, 40], maxZoom: 8 });
    };

    if (this.worldCountriesGeoData) {
      render(this.worldCountriesGeoData);
      return;
    }

    fetch('./world-countries.geojson')
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load GeoJSON: ${res.status}`);
        return res.json();
      })
      .then((geoData) => {
        this.worldCountriesGeoData = geoData;
        render(geoData);
      })
      .catch((err) => console.error('Error loading world countries data:', err));
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
   * region/country-change handler in ngOnInit (which also needs a fresh
   * map but additionally wipes history and rerolls, done by the caller).
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