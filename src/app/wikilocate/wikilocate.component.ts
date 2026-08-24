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
import { FormsModule } from '@angular/forms';
import * as L from 'leaflet';
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

// Eligibility rules for candidate cities: at most 2 cities per country
// (so no single country dominates the pool) and only cities with real
// population weight, so the game doesn't ask about obscure towns.
const MAX_CITIES_PER_COUNTRY = 2;
const MIN_POPULATION = 1_000_000;

// How far around the city's coordinates we search for Wikipedia articles.
// Wide enough to surface real nearby landmarks/places, narrow enough that
// the pins still cluster meaningfully around the city.
const WIKI_SEARCH_OFFSET_KM = 20;

// Marker z-index offsets used to bring a hovered/overlapping pin to the
// front, above its neighbours.
const ARTICLE_MARKER_Z_DEFAULT = 0;
const ARTICLE_MARKER_Z_HOVER = 1000;

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

  // Candidate pool: top N per country (capped at 2), then filtered down to
  // cities with at least 1M population. `total` is passed generously large
  // so the per-country cap — not the overall total — is what does the
  // real trimming; the population filter runs after.

  private countryNameByCode: Record<string, string> = {};

  public eligibleCities$ = this._countriesService.getAllCountries().pipe(
    switchMap((countries) => {
      this.countryNameByCode = Object.fromEntries(countries.map((c) => [c.alpha2Code, c.name]));
      const codes = countries.map((c) => c.alpha2Code);
      return this._citiesService.getTopCitiesCapped(codes, 1000, MAX_CITIES_PER_COUNTRY);
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

  // Lookup from city name -> full City so a typed guess can be resolved
  // back to coordinates for distance-based scoring.
  private cityByName: Record<string, City> = {};

  public guessInput = '';
  public wrongGuess: string | null = null;

  // --- Round result state (distance-based scoring, mirrors Locate The City) ---
  public hasGuessed = false;
  public currentScore = 0;
  public currentDistance = 0;
  public isGuessSubmitting = false;

  public get isRoundOver(): boolean {
    return this.hasGuessed;
  }

  // --- Session history ---
  public guessHistory: { gameNumber: number; cityName: string; points: number }[] = [];

  public get averageScore(): number {
    if (this.guessHistory.length === 0) return 0;
    const total = this.guessHistory.reduce((sum, entry) => sum + entry.points, 0);
    return Math.round((total / this.guessHistory.length) * 10) / 10;
  }

  @ViewChild('mapContainer', { static: true })
  private mapContainer!: ElementRef<HTMLDivElement>;

  private map!: L.Map;
  private articleMarkers: L.Marker[] = [];
  private cityRevealMarker: L.Marker | null = null;
  private cityRevealIcon!: L.Icon;
  private articleIcon!: L.DivIcon;

  public filteredCityNames: string[] = [];
  public isDropdownOpen = false;

  ngOnInit(): void {
    this.eligibleCities$.pipe(takeUntilDestroyed(this._destroyRef)).subscribe((cities) => {
      this.allCityNames = [...new Set(cities.map((c) => c.name))].sort((a, b) => a.localeCompare(b));

      // Keep the first city seen per name so a typed guess can be resolved
      // back to coordinates. Names should already be de-duplicated above,
      // but this guards against any accidental collisions.
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
    delete (L.Icon.Default.prototype as any)._getIconUrl;

    this.cityRevealIcon = L.icon({
      iconUrl: 'leaflet/marker-icon.png',
      iconRetinaUrl: 'leaflet/marker-icon-2x.png',
      shadowUrl: 'leaflet/marker-shadow.png',
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      shadowSize: [41, 41],
      className: 'actual-city-marker-icon',
    });

    this.articleIcon = L.divIcon({
      className: 'article-marker-icon',
      html: '<span class="article-marker-dot"></span>',
      iconSize: [14, 14],
      iconAnchor: [7, 7],
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

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
      maxZoom: 18,
      subdomains: 'abcd',
    }).addTo(this.map);

    // If a city was already picked before the map finished initializing,
    // load its articles now.
    if (this.currentCity) {
      this.loadArticlesForCurrentCity();
    }
  }

  /**
   * Resets all per-round state for a freshly picked city and (if the map
   * is ready) kicks off the article fetch + pin placement.
   */
  private startRound(city: City | null): void {
    this.wrongGuess = null;
    this.hasGuessed = false;
    this.currentScore = 0;
    this.currentDistance = 0;
    this.isGuessSubmitting = false;
    this.guessControl.reset('');
    this.articles = [];

    this.clearMapLayers();

    if (city && this.map) {
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
    this.map.setMinZoom(2); // reset floor so fitBounds can compute freely
    this.resetMapBounds();

    if (articles.length === 0) return;

    const bounds: L.LatLngExpression[] = [];
    for (const article of articles) {
      const marker = L.marker([article.lat, article.lon], { icon: this.articleIcon })
        .bindTooltip(article.title, { permanent: true, direction: 'top', className: 'article-marker-tooltip' })
        .addTo(this.map);

      // When pins/labels are close together or overlapping, whichever
      // label the mouse is over should render above its neighbours (both
      // the pin and its tooltip). The pin itself is tiny, so the hover
      // target that matters is the tooltip label — we bind directly to
      // its DOM element (via native events) rather than relying on the
      // marker's own hover, since the label can visually extend well
      // beyond the marker's own hit area. Reset back to default on
      // mouse-out so the next hovered label can take over.
      const bringToFront = () => {
        marker.setZIndexOffset(ARTICLE_MARKER_Z_HOVER);
        const tooltipEl = marker.getTooltip()?.getElement();
        if (tooltipEl) {
          tooltipEl.style.zIndex = '10000';
        }
      };
      const sendToBack = () => {
        marker.setZIndexOffset(ARTICLE_MARKER_Z_DEFAULT);
        const tooltipEl = marker.getTooltip()?.getElement();
        if (tooltipEl) {
          tooltipEl.style.zIndex = '';
        }
      };

      // Keep hover working on the pin itself too, in case it isn't
      // covered by its own label.
      marker.on('mouseover', bringToFront);
      marker.on('mouseout', sendToBack);

      const tooltipEl = marker.getTooltip()?.getElement();
      if (tooltipEl) {
        tooltipEl.addEventListener('mouseenter', bringToFront);
        tooltipEl.addEventListener('mouseleave', sendToBack);
      }

      this.articleMarkers.push(marker);
      bounds.push([article.lat, article.lon]);
    }

    const fitted = L.latLngBounds(bounds);
    this.map.fitBounds(fitted, { padding: [40, 40], maxZoom: 10 });
    this.map.setMinZoom(this.map.getZoom()); // lock: can zoom in from here, not out

    // Lock panning to the fitted area — give it some breathing room via .pad()
    // so the pins aren't glued to the edge of the pannable region.
    this.map.setMaxBounds(fitted.pad(0.5));
  }

  private resetMapBounds(): void {
    this.map.setMaxBounds([
      [-90, -180],
      [90, 180],
    ]);
  }

  private clearMapLayers(): void {
    this.clearArticleMarkers();
    this.map?.setMinZoom(2);
    this.resetMapBounds();

    if (this.cityRevealMarker) {
      this.map?.removeLayer(this.cityRevealMarker);
      this.cityRevealMarker = null;
    }
  }

  private clearArticleMarkers(): void {
    for (const marker of this.articleMarkers) {
      marker.off('mouseover');
      marker.off('mouseout');
      // Tooltip DOM elements (and their native listeners) are removed
      // along with the marker/layer itself, so no separate cleanup is
      // needed for the mouseenter/mouseleave bindings added on them.
      this.map.removeLayer(marker);
    }
    this.articleMarkers = [];
  }

  public onSubmitGuess(): void {
    if (!this.currentCity || this.isRoundOver || this.isGuessSubmitting) return;

    const guess = (this.guessControl.value ?? '').trim();
    if (!guess) return;

    const guessedCity = this.resolveCityByName(guess);

    if (!guessedCity) {
      // Guess doesn't match a known city — no coordinates to score against,
      // so it's treated the same as being maximally wrong.
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

    // Fall back to a normalized (diacritic/case-insensitive) match in case
    // the typed guess doesn't exactly match the autocomplete casing.
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

  // Builds a regex pattern that matches a term regardless of diacritics,
  // e.g. "sao paulo" also matches "São Paulo" in the original (non-normalized) title.
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

    this.cityRevealMarker = L.marker([this.currentCity.latitude, this.currentCity.longitude], {
      icon: this.cityRevealIcon,
    })
      .bindTooltip(this.currentCity.name, { permanent: true, direction: 'top' })
      .addTo(this.map);

    this.map.setView([this.currentCity.latitude, this.currentCity.longitude], 9);
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
}