import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  ElementRef,
  HostListener,
  ViewChild,
  inject,
} from '@angular/core';
import { Router } from '@angular/router';
import * as L from 'leaflet';

interface GameTile {
  title: string;
  description: string;
  /** Route to navigate to. Leave null for "coming soon" placeholder tiles. */
  route: string | null;
  /** Roughly where to pin the tile on the world map. */
  lat: number;
  lng: number;
  /** Key into GLYPH_PATHS — same line-art icon style used in the sidebar. */
  glyph: keyof typeof GLYPH_PATHS;
}

/**
 * Inner SVG markup for each glyph, mirroring sidebar.component.html.
 * Duplicated here (rather than reused directly) because Leaflet markers are
 * built from raw HTML strings, not Angular templates — there's nothing to
 * bind an @switch against.
 */
const GLYPH_PATHS = {
  globe: `<circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18" />`,
  target: `<circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="4.5" /><path d="M12 3v3M12 18v3M3 12h3M18 12h3" />`,
  pin: `<path d="M12 21s-6.5-6.1-6.5-11A6.5 6.5 0 0 1 18.5 10c0 4.9-6.5 11-6.5 11z" /><circle cx="12" cy="10" r="2.3" />`,
  map: `<path d="M9 3 3 5v16l6-2 6 2 6-2V3l-6 2-6-2Z" /><path d="M9 3v16M15 5v16" />`,
  language: `<path d="M4 4h13a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H10l-4 4v-4H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" /><path d="M7 9h9M7 12.5h6" />`,
  grid: `<rect x="3" y="3" width="18" height="18" rx="1.5" /><path d="M9 3v18M15 3v18M3 9h18M3 15h18" /><path d="M10.3 10.3l3.4 3.4M13.7 10.3l-3.4 3.4" />`,
  // Placeholder "?" glyph for locked / "Coming Soon" tiles.
  unknown: `<circle cx="12" cy="12" r="9" /><path d="M9.5 9a2.5 2.5 0 0 1 4.9.8c0 1.7-2.4 2-2.4 3.7" /><circle cx="12" cy="17" r="0.1" fill="currentColor" stroke-width="2.4" />`,
  // Stacked chevrons for the Higher/Lower comparison game.
  updown: `<path d="M7 10l5-5 5 5" /><path d="M7 15l5 5 5-5" />`,
  // Irregular blob suggesting a country border/silhouette, for the outline-guessing game.
  outline: `<path d="M5 8.5c.6-1.8 2-2.7 3.4-2.3 1-1.4 3-1.7 4-.4 1.7-.6 3.4.3 3.6 1.9 1.7.3 2.6 1.8 2 3.3.9 1.1.7 2.6-.5 3.3.2 1.6-1 2.9-2.5 2.7-.6 1.5-2.4 2.1-3.7 1.2-1.3 1-3.1.8-4-.5-1.7.2-3-1-2.9-2.6-1.5-.5-2.1-2.1-1.3-3.5-.8-1.1-.5-2.7.9-3.1Z" />`,
  // Ascending ranking bars for the Sort it Out ordering game.
  sort: `<path d="M4 18h4M4 13h8M4 8h12" /><path d="M17 5v13M17 5l-3 3M17 5l3 3" />`,
} as const;

/**
 * The home screen is a fixed-layout "poster" (map + geographically placed
 * pins) rather than flowing content — pin positions come from lat/lng math,
 * not CSS, so they can't reflow at different viewport sizes the way normal
 * layout does. Instead of fighting that per breakpoint, we design it once at
 * a fixed canvas size and uniformly scale the whole canvas to fit whatever
 * viewport it's shown in. Everything inside (fonts, padding, tile sizes)
 * stays in fixed proportion to everything else, at any screen size.
 */
const DESIGN_WIDTH = 1600;
const DESIGN_HEIGHT = 900;

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css',
})
export class HomeComponent implements AfterViewInit {
  private _router = inject(Router);
  private _cdr = inject(ChangeDetectorRef);

  @ViewChild('mapContainer', { static: true })
  private mapContainer!: ElementRef<HTMLDivElement>;

  // Optional: the template currently has the <svg #pathLayer> commented out,
  // so this may never resolve. Guard every use of it accordingly instead of
  // assuming it's always present (avoids a thrown error inside the Leaflet
  // fetch .then(), which used to silently break the "map ready" flow).
  @ViewChild('pathLayer')
  private pathLayer?: ElementRef<SVGSVGElement>;

  private map!: L.Map;

  // Tracks whether tiles have already been placed, so a retry path (e.g. the
  // fetch .catch fallback) can never add them twice.
  private tilesAdded = false;

  public readonly designWidth = DESIGN_WIDTH;
  public readonly designHeight = DESIGN_HEIGHT;

  /** Uniform scale factor applied to the fixed-size canvas to fit the viewport. */
  public scale = 1;

  private _resizeTimeout: ReturnType<typeof setTimeout> | null = null;

  // Coordinates are spread across a rough 3-row x world-wide grid so every
  // continent — including the Americas on the left edge — gets at least one
  // tile. Reposition freely; nothing here is tied to real game geography.
  public games: GameTile[] = [
    {
      title: 'Guess the Country',
      description: 'Can you guess the daily/unlimited country based on clues?',
      route: '/guess-the-country/daily-country',
      lat: 69,
      lng: -160,
      glyph: 'globe',
    },
    {
      title: 'Wavelength',
      description: 'Coming soon...',
      route: null,
      lat: 45,
      lng: 80,
      glyph: 'unknown',
    },
    {
      title: 'TicTacToe',
      description: 'A geographic twist on the classic game.',
      route: '/tic-tac-toe',
      lat: 55,
      lng: -8,
      glyph: 'grid',
    },
    {
      title: 'Country Silhouette',
      description: 'Idenfiy countries by their outline on the map.',
      route: '/country-silhouette',
      lat: 40,
      lng: -118,
      glyph: 'outline',
    },
    {
      title: 'Locate the City',
      description: 'Drop a pin where you think a city is and see how close you got.',
      route: '/locate-the-city',
      lat: 72,
      lng: 68,
      glyph: 'pin',
    },
    {
      title: 'Sort it out',
      description: 'Order 5 countries based on the given criteria.',
      route: '/sort-it-out',
      lat: -18,
      lng: -101,
      glyph: 'sort',
    },
    {
      title: 'Guess the Language',
      description: 'Identify the country based on highlighted countries',
      route: '/guess-the-language',
      lat: -5,
      lng: 105,
      glyph: 'language',
    },
    {
      title: 'Narrow it Down',
      description: 'Bracket a hidden number with a shrinking range for points.',
      route: '/narrow-it-down',
      lat: 10,
      lng: -12,
      glyph: 'target',
    },
    {
      title: 'Higher Lower',
      description: 'Which country has the bigger population?',
      route: '/higher-lower',
      lat: 72,
      lng: -78,
      glyph: 'updown',
    },
  ];

  // Index pairs into `games` describing which tiles get a connecting path
  // drawn between them. Edit freely — doesn't have to be sequential.
  private pathConnections: [number, number][] = [
    [0, 1],
    [1, 2],
    [2, 3],
    [3, 4],
    [4, 5],
  ];

  public isMapReady = true; // should be false but there are some sync issues so for now it s true always

  constructor() {
    // Set an initial scale synchronously so the very first paint (before
    // ngAfterViewInit even runs) is already correctly sized instead of
    // flashing at 1:1 scale for a frame.
    this._updateScale();
  }

  @HostListener('window:resize')
  protected _onWindowResize(): void {
    // Debounce: resize fires rapidly while dragging a window edge, and each
    // call forces a style recalculation — no need to do that dozens of
    // times a second.
    if (this._resizeTimeout) clearTimeout(this._resizeTimeout);
    this._resizeTimeout = setTimeout(() => {
      this._updateScale();
      this._cdr.markForCheck();
    }, 60);
  }

  private _updateScale(): void {
    const scaleX = window.innerWidth / DESIGN_WIDTH;
    const scaleY = window.innerHeight / DESIGN_HEIGHT;
    // Fit-to-viewport ("contain"): never crop either dimension. Swap for
    // Math.min(scaleX, scaleY, 1) instead if you'd rather cap at 1:1 and
    // letterbox on very large monitors rather than upscale past design size.
    this.scale = Math.min(scaleX, scaleY);
  }

  ngAfterViewInit(): void {
    console.log('[home] ngAfterViewInit fired');
    console.log('[home] mapContainer element:', this.mapContainer?.nativeElement);
    console.log(
      '[home] mapContainer size:',
      this.mapContainer?.nativeElement?.offsetWidth,
      this.mapContainer?.nativeElement?.offsetHeight
    );

    // Absolute last resort: no matter what fails above (Leaflet init throwing,
    // fetch hanging, geojson parsing blowing up in a way that isn't caught
    // below), never leave the user staring at "Charting the atlas..." forever.
    const forceReadyTimeout = setTimeout(() => {
      console.log('[home] forceReadyTimeout fired, isMapReady was:', this.isMapReady);
      if (!this.isMapReady) {
        console.warn('Map did not become ready in time — revealing it anyway.');
        this.placeTilesOnce();
        this.isMapReady = true;
        this._cdr.detectChanges();
      }
    }, 5000);

    try {
      console.log('[home] calling L.map(...)');
      this.map = L.map(this.mapContainer.nativeElement, {
        center: [20, 10],
        zoom: 2.5,
        minZoom: 2.5,
        maxZoom: 2.5,
        maxBounds: [
          [-90, -180],
          [90, 180],
        ],
        maxBoundsViscosity: 1.0,
        dragging: false,
        scrollWheelZoom: false,
        doubleClickZoom: false,
        boxZoom: false,
        touchZoom: false,
        keyboard: false,
        zoomControl: false,
        attributionControl: false,
      });
      console.log('[home] L.map(...) succeeded:', this.map);
    } catch (err) {
      // If Leaflet itself fails to init (e.g. container has 0 size at this
      // point, or is somehow reused), we can't recover the map — but we can
      // still stop the user from being stuck on the loading screen forever.
      console.error('[home] L.map(...) threw:', err);
      clearTimeout(forceReadyTimeout);
      this.isMapReady = true;
      this._cdr.detectChanges();
      return;
    }

    console.log('[home] starting fetch of world-land.geojson');
    fetch('./world-land.geojson')
      .then((res) => {
        console.log('[home] fetch resolved, status:', res.status, 'ok:', res.ok);
        if (!res.ok) throw new Error(`Failed to load GeoJSON: ${res.status}`);
        return res.json();
      })
      .then((geoData) => {
        console.log('[home] geojson parsed, feature count:', geoData?.features?.length);
        L.geoJSON(geoData, {
          style: {
            color: 'transparent',
            fillColor: '#f2efe6',
            fillOpacity: 1,
          },
        }).addTo(this.map);

        this.map.invalidateSize();
        this.map.setView([20, 10], 2.5);
        console.log('[home] geojson layer added, view set');
      })
      .catch((err) => {
        console.error('[home] Error loading world land data:', err);
        // Fall through below with no land shapes drawn — the map (and tiles)
        // should still become visible instead of hanging in loading state.
      })
      .finally(() => {
        // Runs whether or not the GeoJSON succeeded, and only ever runs once
        // per page load, so tiles are placed exactly once either way.
        console.log('[home] .finally() reached, setting isMapReady = true');
        clearTimeout(forceReadyTimeout);
        this.placeTilesOnce();
        this.isMapReady = true;
        console.log('[home] isMapReady is now:', this.isMapReady);
      });
  }

  private placeTilesOnce(): void {
    if (this.tilesAdded) {
      console.log('[home] placeTilesOnce called again, skipping (already added)');
      return;
    }
    this.tilesAdded = true;

    console.log('[home] placing', this.games.length, 'tiles');
    this.games.forEach((game) => this.addGameTile(game));
    console.log('[home] all tiles placed');

    // drawPaths relies on the <svg #pathLayer> element, which is currently
    // commented out in the template — skip it gracefully if absent instead
    // of throwing and derailing the promise chain above.
    if (this.pathLayer) {
      this.drawPaths();
    } else {
      console.log('[home] pathLayer not present, skipping drawPaths');
    }
  }

  private addGameTile(game: GameTile): void {
    const locked = !game.route;
    const glyphMarkup = GLYPH_PATHS[game.glyph] ?? GLYPH_PATHS.unknown;

    const icon = L.divIcon({
      className: 'game-tile-marker',
      html: `
        <div class="game-tile ${locked ? 'game-tile--locked' : ''}">
          <div class="game-tile__icon">
            <svg viewBox="0 0 24 24" class="game-tile__glyph" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${glyphMarkup}</svg>
          </div>
          <div class="game-tile__name">${game.title}</div>
          <div class="game-tile__desc">${game.description}</div>
          ${locked ? '<div class="game-tile__badge">Coming soon</div>' : ''}
        </div>
      `,
      iconSize: undefined,
    });

    const marker = L.marker([game.lat, game.lng], {
      icon,
      interactive: true,
      keyboard: false,
    }).addTo(this.map);

    if (!locked) {
      marker.on('click', () => this._router.navigateByUrl(game.route!));
    }
  }

  /**
   * Draws curved, dashed brass-colored paths between connected tiles as a
   * plain SVG overlay sitting on top of the map. Since the map is fully
   * static (no pan/zoom), this only needs to run once.
   */
  private drawPaths(): void {
    if (!this.pathLayer) return;

    const svg = this.pathLayer.nativeElement;
    svg.innerHTML = '';

    const size = this.map.getSize();
    svg.setAttribute('viewBox', `0 0 ${size.x} ${size.y}`);
    svg.setAttribute('width', `${size.x}`);
    svg.setAttribute('height', `${size.y}`);

    this.pathConnections.forEach(([fromIdx, toIdx]) => {
      const from = this.games[fromIdx];
      const to = this.games[toIdx];
      if (!from || !to) return;

      const start = this.map.latLngToContainerPoint([from.lat, from.lng]);
      const end = this.map.latLngToContainerPoint([to.lat, to.lng]);

      // Offset the control point perpendicular to the line for a gentle arc.
      const dx = end.x - start.x;
      const dy = end.y - start.y;
      const mx = (start.x + end.x) / 2;
      const my = (start.y + end.y) / 2;
      const curveStrength = 0.25;
      const ctrlX = mx - dy * curveStrength;
      const ctrlY = my + dx * curveStrength;

      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', `M ${start.x} ${start.y} Q ${ctrlX} ${ctrlY} ${end.x} ${end.y}`);
      path.setAttribute('class', 'game-path');

      svg.appendChild(path);
    });
  }
}