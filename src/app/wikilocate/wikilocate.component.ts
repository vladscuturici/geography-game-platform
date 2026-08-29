import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  ElementRef,
  OnInit,
  ViewChild,
  inject,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import * as maplibregl from 'maplibre-gl';
import { BehaviorSubject, combineLatest, map, Observable, shareReplay, startWith, switchMap } from 'rxjs';
import { City } from '../models/cities.model';
import { CitiesService } from '../services/cities.service';
import { CountriesService } from '../services/countries.service';
import { GameService } from '../services/game.service';
import { WikiGeoArticle, WikiService } from '../services/wiki.service';
import { RandomCityPicker } from '../strategies/item-pick-strategy';

import { ReactiveFormsModule, FormControl } from '@angular/forms';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';

// IMPORTANT: this stylesheet must be registered in angular.json under
// architect.build.options.styles, e.g.:
//   "styles": ["node_modules/maplibre-gl/dist/maplibre-gl.css", "src/styles.css"]
// Without it the map container has no intrinsic sizing/positioning CSS
// and can render with 0 height, which looks identical to "nothing loads".

const MAX_CITIES_PER_COUNTRY = 5;
const MIN_POPULATION = 1_000_000;
const WIKI_SEARCH_OFFSET_KM = 20;

const ARTICLE_SOURCE_ID = 'wiki-articles';
const ARTICLE_LAYER_ID = 'wiki-articles-points';

// Navy + brass recolor palette applied over the base "liberty" style so
// the map matches the parchment/brass theme instead of its default
// colors. Keep these in sync with the --ink / --brass* CSS variables in
// wikilocate.component.css.
const MAP_NAVY_DEEP = '#0b1428'; // background / open water
const MAP_NAVY_WATER = '#12213f'; // waterways, slightly lighter than bg
const MAP_NAVY_LAND = '#182a4d'; // landcover / landuse / parks / buildings
const MAP_NAVY_LAND_ALT = '#1f345c'; // secondary land fill (e.g. buildings) for subtle contrast
const MAP_BRASS = '#c9a24b'; // minor roads, boundaries
const MAP_BRASS_BRIGHT = '#e8c876'; // major roads / highways

// Layer ids (from the "liberty" style) to hide entirely, on top of the
// symbol/fill-extrusion layers already hidden in ngAfterViewInit.
// Grouped by what they represent so it's easy to add/remove a category.
const HIDDEN_LAYER_IDS = new Set<string>([
  // Footpaths / pedestrian paths
  'road_path_pedestrian',
  'bridge_path_pedestrian_casing',
  'bridge_path_pedestrian',
  'tunnel_path_pedestrian',
  'road_area_pattern',

  // Buildings (flat 2D fill; the 3D extrusion layer is already hidden)
  'building',

  // Minor streets, service roads/tracks, rail lines (surface, bridge, tunnel)
  'road_minor_casing',
  'road_minor',
  'road_service_track_casing',
  'road_service_track',
  'road_link_casing',
  'road_link',
  'road_major_rail',
  'road_major_rail_hatching',
  'road_transit_rail',
  'road_transit_rail_hatching',
  'tunnel_service_track_casing',
  'tunnel_service_track',
  'tunnel_link_casing',
  'tunnel_link',
  'tunnel_street_casing',
  'tunnel_minor',
  'tunnel_major_rail',
  'tunnel_major_rail_hatching',
  'tunnel_transit_rail',
  'tunnel_transit_rail_hatching',
  'bridge_service_track_casing',
  'bridge_service_track',
  'bridge_link_casing',
  'bridge_link',
  'bridge_street_casing',
  'bridge_street',
  'bridge_major_rail',
  'bridge_major_rail_hatching',
  'bridge_transit_rail',
  'bridge_transit_rail_hatching',

  // Airports (runways/taxiways as fills/lines)
  'aeroway_fill',
  'aeroway_runway',
  'aeroway_taxiway',

  // Residential landuse tint, parks, cemeteries, hospitals, schools
  'landuse_residential',
  'park',
  'park_outline',
  'landuse_cemetery',
  'landuse_hospital',
  'landuse_school',
]);

@Component({
  selector: 'app-wikilocate',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatAutocompleteModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
  ],
  templateUrl: './wikilocate.component.html',
  styleUrl: './wikilocate.component.css',
})
export class WikilocateComponent implements OnInit, AfterViewInit {
  private _citiesService = inject(CitiesService);
  private _countriesService = inject(CountriesService);
  private _wikiService = inject(WikiService);
  private _gameService = inject(GameService);
  private _randomPicker = new RandomCityPicker();
  private _reroll$ = new BehaviorSubject<void>(undefined);
  private _destroyRef = inject(DestroyRef);
  private _cdr = inject(ChangeDetectorRef);

  public isExactMatch = false;

  private countryNameByCode: Record<string, string> = {};

  public eligibleCities$ = this._countriesService.getAllCountries().pipe(
    switchMap((countries) => {
      this.countryNameByCode = Object.fromEntries(countries.map((c) => [c.alpha2Code, c.name]));
      const codes = countries.map((c) => c.alpha2Code);
      return this._citiesService.getTopCitiesCapped(codes, 5000, MAX_CITIES_PER_COUNTRY);
    }),
    map((cities) => cities.filter((c) => c.population >= MIN_POPULATION)),
    shareReplay(1)
  );

  public randomCity$ = combineLatest([this.eligibleCities$, this._reroll$]).pipe(
    map(([cities]) => this._randomPicker.pick(cities)),
    shareReplay(1)
  );

  public currentCity: City | null = null;
  public articles: WikiGeoArticle[] = [];
  public isLoadingArticles = false;

  public guessControl = new FormControl<string>('');
  public filteredCityNames$!: Observable<string[]>;
  public allCityNames: string[] = [];

  private cityByName: Record<string, City> = {};

  public guessInput = '';
  public wrongGuess: string | null = null;

  public hasGuessed = false;
  public currentScore = 0;
  public currentDistance = 0;
  public isGuessSubmitting = false;

  public get isRoundOver(): boolean {
    return this.hasGuessed;
  }

  public guessHistory: { gameNumber: number; cityName: string; points: number }[] = [];

  public get averageScore(): number {
    if (this.guessHistory.length === 0) return 0;
    const total = this.guessHistory.reduce((sum, entry) => sum + entry.points, 0);
    return Math.round((total / this.guessHistory.length) * 10) / 10;
  }

  @ViewChild('mapContainer', { static: true })
  private mapContainer!: ElementRef<HTMLDivElement>;

  private map!: maplibregl.Map;
  private cityRevealMarker: maplibregl.Marker | null = null;
  private articleLabelMarkers: maplibregl.Marker[] = [];
  private mapReady = false;
  private pendingCity: City | null = null;

  private readonly WORLD_MIN_ZOOM = 2;
  private readonly WORLD_BOUNDS: maplibregl.LngLatBoundsLike = [
    [-180, -85],
    [180, 85],
  ];

  public filteredCityNames: string[] = [];
  public isDropdownOpen = false;

  ngOnInit(): void {
    this.eligibleCities$.pipe(takeUntilDestroyed(this._destroyRef)).subscribe((cities) => {
      this.allCityNames = [...new Set(cities.map((c) => c.name))].sort((a, b) => a.localeCompare(b));

      this.cityByName = {};
      for (const city of cities) {
        if (!(city.name in this.cityByName)) {
          this.cityByName[city.name] = city;
        }
      }
    });

    this.filteredCityNames$ = this.guessControl.valueChanges.pipe(
      startWith(''),
      map((value) => this._filterCityNames(value ?? ''))
    );

    this.randomCity$.pipe(takeUntilDestroyed(this._destroyRef)).subscribe((city) => {
      this.currentCity = city;
      this.startRound(city);
      this._cdr.markForCheck();
    });
  }

  private _filterCityNames(value: string): string[] {
    const filterValue = value.toLowerCase();
    return this.allCityNames.filter((name) => name.toLowerCase().includes(filterValue));
  }

  public onGuessInputFocus(): void {
    this.filterCityNames();
    this.isDropdownOpen = true;
  }

  public onGuessInputChange(): void {
    this.filterCityNames();
    this.isDropdownOpen = true;
  }

  public onGuessInputBlur(): void {
    setTimeout(() => {
      this.isDropdownOpen = false;
      this._cdr.markForCheck();
    }, 150);
  }

  public selectCity(name: string): void {
    this.guessInput = name;
    this.isDropdownOpen = false;
  }

  private filterCityNames(): void {
    const query = this.guessInput.trim().toLowerCase();
    this.filteredCityNames = query
      ? this.allCityNames.filter((name) => name.toLowerCase().includes(query))
      : this.allCityNames;
  }

  ngAfterViewInit(): void {
    // --- Diagnostic: confirm the container actually has real dimensions
    // before MapLibre ever touches it.
    const rect = this.mapContainer.nativeElement.getBoundingClientRect();
    // eslint-disable-next-line no-console
    console.log('[wikilocate] map container size at init:', rect.width, 'x', rect.height);

    this.map = new maplibregl.Map({
      container: this.mapContainer.nativeElement,
      style: 'https://tiles.openfreemap.org/styles/liberty',
      center: [0, 20],
      zoom: 2,
      minZoom: this.WORLD_MIN_ZOOM,
      attributionControl: false,
      pitch: 0,
      maxPitch: 0,
      dragRotate: false,
      touchPitch: false,
    });

    this.map.addControl(
      new maplibregl.AttributionControl({ customAttribution: '&copy; OpenStreetMap contributors, &copy; OpenFreeMap' })
    );

    this.map.on('error', (e: any) => {
      // eslint-disable-next-line no-console
      console.error('[wikilocate] MapLibre error:', e?.error ?? e);
    });

    this.map.on('load', () => {
      // eslint-disable-next-line no-console
      console.log('[wikilocate] MapLibre "load" event fired — style + initial tiles ready.');
      this.mapReady = true;

      // Hide every symbol layer (text/icons), 3D building extrusions, and
      // the explicit HIDDEN_LAYER_IDS set (footpaths, buildings, minor
      // roads/rail, airports, residential/park/cemetery/hospital/school
      // fills) rather than hand-building a minimal style ourselves.
      const layers = this.map.getStyle().layers ?? [];
      for (const layer of layers) {
        if (layer.type === 'symbol' || layer.type === 'fill-extrusion' || HIDDEN_LAYER_IDS.has(layer.id)) {
          this.map.setLayoutProperty(layer.id, 'visibility', 'none');
        }
      }

      this.recolorMapStyle();
      this.map.resize();
      this.map.setMaxBounds(this.WORLD_BOUNDS);

      if (this.pendingCity) {
        this.loadArticlesForCurrentCity();
      } else if (this.currentCity) {
        this.loadArticlesForCurrentCity();
      }
    });

    window.addEventListener('resize', this.onWindowResize);
  }

  private onWindowResize = (): void => {
    this.map?.resize();
  };

  // Recolors the base "liberty" vector style into the navy + brass
  // theme. Layer ids/source-layers follow the OpenMapTiles naming
  // convention the liberty style is built on, so we match on substrings
  // rather than hardcoding an exact layer list (more resilient to minor
  // style updates upstream).
  private recolorMapStyle(): void {
    const layers = this.map.getStyle().layers ?? [];

    for (const layer of layers) {
      const id = layer.id.toLowerCase();
      const sourceLayer = ('source-layer' in layer ? (layer as any)['source-layer'] : '') ?? '';
      const key = `${id} ${sourceLayer}`.toLowerCase();

      try {
        switch (layer.type) {
          case 'background':
            this.map.setPaintProperty(layer.id, 'background-color', MAP_NAVY_DEEP);
            break;

          case 'fill':
            if (/water/.test(key)) {
              this.map.setPaintProperty(layer.id, 'fill-color', MAP_NAVY_WATER);
            } else if (/building/.test(key)) {
              this.map.setPaintProperty(layer.id, 'fill-color', MAP_NAVY_LAND_ALT);
            } else {
              // landcover, landuse, parks, pitches, etc.
              this.map.setPaintProperty(layer.id, 'fill-color', MAP_NAVY_LAND);
            }
            break;

          case 'line':
            if (/water/.test(key)) {
              this.map.setPaintProperty(layer.id, 'line-color', MAP_NAVY_WATER);
            } else if (/boundary|admin/.test(key)) {
              this.map.setPaintProperty(layer.id, 'line-color', MAP_BRASS);
            } else if (/building/.test(key)) {
              this.map.setPaintProperty(layer.id, 'line-color', MAP_NAVY_LAND_ALT);
            } else if (/motorway|trunk|highway|primary/.test(key)) {
              this.map.setPaintProperty(layer.id, 'line-color', MAP_BRASS_BRIGHT);
            } else if (/road|street|transportation|bridge|tunnel|path|rail/.test(key)) {
              this.map.setPaintProperty(layer.id, 'line-color', MAP_BRASS);
            }
            break;

          default:
            // Leave circle/symbol/heatmap/etc. layers untouched — the
            // article marker circle layer sets its own brass colors,
            // and symbol layers are hidden entirely above.
            break;
        }
      } catch {
        // Some layers don't support the paint property we tried to set
        // (style-specific quirks); skip rather than fail the whole pass.
      }
    }
  }

  private startRound(city: City | null): void {
    this.wrongGuess = null;
    this.hasGuessed = false;
    this.currentScore = 0;
    this.currentDistance = 0;
    this.isGuessSubmitting = false;
    this.guessControl.reset('');
    this.articles = [];
    this.isExactMatch = false;

    this.pendingCity = city;

    if (!this.map) {
      return;
    }

    this.clearMapLayers();

    if (city && this.mapReady) {
      this.loadArticlesForCurrentCity();
    }
  }

  private loadArticlesForCurrentCity(): void {
    if (!this.currentCity) return;

    this.isLoadingArticles = true;

    this._wikiService
      .getWikiArticlesByPoint(this.currentCity.latitude, this.currentCity.longitude, WIKI_SEARCH_OFFSET_KM)
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe({
        next: (articles) => {
          this.articles = this.sanitizeArticles(articles);
          this.plotArticleMarkers(this.articles);
          this.isLoadingArticles = false;
          this._cdr.markForCheck();
        },
        error: (err) => {
          console.error('Error loading wiki articles:', err);
          this.isLoadingArticles = false;
          this._cdr.markForCheck();
        },
      });
  }

  private plotArticleMarkers(articles: WikiGeoArticle[]): void {
    this.clearArticleMarkers();
    this.map.setMinZoom(this.WORLD_MIN_ZOOM);
    this.resetMapBounds();

    const geojson: GeoJSON.FeatureCollection<GeoJSON.Point, { title: string }> = {
      type: 'FeatureCollection',
      features: articles.map((article) => ({
        type: 'Feature',
        properties: { title: article.title },
        geometry: { type: 'Point', coordinates: [article.lon, article.lat] },
      })),
    };

    const existingSource = this.map.getSource(ARTICLE_SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
    if (existingSource) {
      existingSource.setData(geojson);
    } else {
      this.map.addSource(ARTICLE_SOURCE_ID, { type: 'geojson', data: geojson });
      this.map.addLayer({
        id: ARTICLE_LAYER_ID,
        type: 'circle',
        source: ARTICLE_SOURCE_ID,
        paint: {
          'circle-radius': 6,
          'circle-color': '#e8c876',
          'circle-stroke-width': 2,
          'circle-stroke-color': '#14213d',
        },
      });
    }

    // Labels are DOM elements reusing the original .article-marker-tooltip
    // CSS (pill shape, border, JetBrains Mono font, etc.) — a plain WebGL
    // symbol layer can't reproduce that box styling. The dot itself (used
    // for judging position) is the GeoJSON circle layer above and stays
    // pixel-accurate during zoom; only this cosmetic text label is
    // DOM-positioned via a marker.
    for (const article of articles) {
      const tooltip = document.createElement('span');
      tooltip.className = 'article-marker-tooltip';
      tooltip.textContent = article.title;

      const label = new maplibregl.Marker({ element: tooltip, anchor: 'bottom', offset: [0, -10] })
        .setLngLat([article.lon, article.lat])
        .addTo(this.map);

      this.articleLabelMarkers.push(label);
    }

    if (articles.length === 0) return;

    const bounds = new maplibregl.LngLatBounds();
    for (const article of articles) {
      bounds.extend([article.lon, article.lat]);
    }

    // The allowed play area is the *padded* bounds, not the tight fit
    // around the articles themselves. Fit the initial camera to that
    // padded area directly so the round starts as zoomed out as the
    // allowed panning area permits, instead of starting tight on the
    // articles and only being able to zoom out to a level that's still
    // more zoomed-in than what maxBounds would actually allow.
    const paddedBounds = this.padBounds(bounds, 0.5);
    this.map.setMaxBounds(paddedBounds);
    this.map.fitBounds(paddedBounds, { padding: 40, maxZoom: 9, animate: false });

    // eslint-disable-next-line no-console
    console.log('[wikilocate] article bounds:', bounds.toArray(), 'resulting zoom:', this.map.getZoom());

    // Lock zoom-out at this fully-zoomed-out starting position — you can
    // still zoom in further, just not past what the padded bounds show.
    const currentZoom = this.map.getZoom();
    const safeMinZoom = Math.min(currentZoom, 9);
    this.map.setMinZoom(safeMinZoom);
  }

  private padBounds(bounds: maplibregl.LngLatBounds, fraction: number): maplibregl.LngLatBoundsLike {
    const sw = bounds.getSouthWest();
    const ne = bounds.getNorthEast();
    const lngPad = (ne.lng - sw.lng) * fraction || 1;
    const latPad = (ne.lat - sw.lat) * fraction || 1;
    return [
      [sw.lng - lngPad, sw.lat - latPad],
      [ne.lng + lngPad, ne.lat + latPad],
    ];
  }

  private resetMapBounds(): void {
    this.map.setMaxBounds(this.WORLD_BOUNDS);
  }

  private clearMapLayers(): void {
    this.clearArticleMarkers();
    this.map?.setMinZoom(this.WORLD_MIN_ZOOM);
    this.resetMapBounds();

    if (this.cityRevealMarker) {
      this.cityRevealMarker.remove();
      this.cityRevealMarker = null;
    }
  }

  private clearArticleMarkers(): void {
    const source = this.map?.getSource(ARTICLE_SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
    source?.setData({ type: 'FeatureCollection', features: [] });

    for (const marker of this.articleLabelMarkers) {
      marker.remove();
    }
    this.articleLabelMarkers = [];
  }

  public onSubmitGuess(): void {
    if (!this.currentCity || this.isRoundOver || this.isGuessSubmitting) return;

    const guess = (this.guessControl.value ?? '').trim();
    if (!guess) return;

    const guessedCity = this.resolveCityByName(guess);

    if (!guessedCity) {
      this.wrongGuess = guess;
      this.hasGuessed = true;
      this.currentScore = 0;
      this.currentDistance = 0;
      this.revealCity();
      this.recordHistory();
      this.guessControl.reset('');
      this._cdr.markForCheck();
      return;
    }

    this.wrongGuess = guess;
    this.isGuessSubmitting = true;

    this._gameService
      .locateCityScore(
        this.currentCity.latitude,
        this.currentCity.longitude,
        guessedCity.latitude,
        guessedCity.longitude
      )
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe({
        next: (result) => {
          this.currentScore = result.score;
          this.currentDistance = result.distance;
          this.hasGuessed = true;
          this.isGuessSubmitting = false;
          this.isExactMatch = guessedCity.name === this.currentCity!.name;

          this.revealCity();
          this.recordHistory();
          this.guessControl.reset('');
          this._cdr.markForCheck();
        },
        error: (err) => {
          console.error('Error scoring guess:', err);
          this.isGuessSubmitting = false;
          this._cdr.markForCheck();
        },
      });
  }

  private resolveCityByName(name: string): City | null {
    if (this.cityByName[name]) return this.cityByName[name];

    const normalizedGuess = this.normalize(name);
    const match = Object.values(this.cityByName).find((c) => this.normalize(c.name) === normalizedGuess);
    return match ?? null;
  }

  private normalize(value: string): string {
    return value
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  private sanitizeArticles(articles: WikiGeoArticle[]): WikiGeoArticle[] {
    if (!this.currentCity) return articles;

    const countryName = this.countryNameByCode[this.currentCity.countryCode] ?? '';
    const forbidden = [this.currentCity.name, countryName].filter(Boolean);

    return articles.map((article) => ({
      ...article,
      title: this.censorTerms(article.title, forbidden),
    }));
  }

  private censorTerms(text: string, terms: string[]): string {
    let result = text;

    for (const term of terms) {
      const pattern = this.buildDiacriticInsensitivePattern(term);
      const regex = new RegExp(pattern, 'gi');
      result = result.replace(regex, (match) => '█'.repeat(match.length));
    }

    return result;
  }

  private buildDiacriticInsensitivePattern(term: string): string {
    const diacriticGroups: Record<string, string> = {
      a: 'a\u00e0\u00e1\u00e2\u00e3\u00e4\u00e5',
      e: 'e\u00e8\u00e9\u00ea\u00eb',
      i: 'i\u00ec\u00ed\u00ee\u00ef',
      o: 'o\u00f2\u00f3\u00f4\u00f5\u00f6',
      u: 'u\u00f9\u00fa\u00fb\u00fc',
      c: 'c\u00e7',
      n: 'n\u00f1',
    };

    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    return escaped.replace(/[aeioucn]/gi, (char) => {
      const lower = char.toLowerCase();
      const group = diacriticGroups[lower];
      return group ? `[${group}${group.toUpperCase()}]` : char;
    });
  }

  private revealCity(): void {
    if (!this.currentCity) return;

    const root = document.createElement('div');
    root.className = 'actual-city-marker-icon';
    root.style.position = 'relative';

    const tooltip = document.createElement('span');
    tooltip.className = 'city-reveal-tooltip';
    tooltip.textContent = this.currentCity.name;
    tooltip.style.position = 'absolute';
    tooltip.style.bottom = '100%';
    tooltip.style.left = '50%';
    tooltip.style.transform = 'translateX(-50%)';
    tooltip.style.marginBottom = '10px';
    root.appendChild(tooltip);

    this.cityRevealMarker = new maplibregl.Marker({ element: root, anchor: 'bottom' })
      .setLngLat([this.currentCity.longitude, this.currentCity.latitude])
      .addTo(this.map);

    this.map.flyTo({ center: [this.currentCity.longitude, this.currentCity.latitude], zoom: 9, animate: false });
  }

  private recordHistory(): void {
    if (!this.currentCity) return;

    this.guessHistory = [
      ...this.guessHistory,
      {
        gameNumber: this.guessHistory.length + 1,
        cityName: this.currentCity.name,
        points: this.currentScore,
      },
    ];
  }

  public toGreenSaturation(score: number): string {
    const clamped = Math.min(Math.max(score, 0), 100);
    const lightness = 100 - (clamped / 100) * 60;
    return `hsl(120, 70%, ${lightness}%)`;
  }

  public nextCity(): void {
    this._reroll$.next();
  }

  public onEnterKey(): void {
    setTimeout(() => this.onSubmitGuess());
  }

  ngOnDestroy(): void {
    window.removeEventListener('resize', this.onWindowResize);
    this.map?.remove();
  }
}