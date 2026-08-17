import { AfterViewInit, ChangeDetectorRef, Component, ElementRef, ViewChild, inject } from '@angular/core';
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
  /** Emoji or short glyph shown on the tile. Swap for an <img> if you get real icons later. */
  icon: string;
}

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

  // Coordinates are spread across a rough 3-row x world-wide grid so every
  // continent — including the Americas on the left edge — gets at least one
  // tile. Reposition freely; nothing here is tied to real game geography.
  public games: GameTile[] = [
    {
      title: 'Guess the Country',
      description: 'Can you guess the daily/unlimited country based on clues?',
      route: '/guess-the-country/daily-country',
      lat: 72,
      lng: -160,
      icon: '🗓️',
    },
    {
      title: 'Coming Soon',
      description: 'A new game might be here...',
      route: null,
      lat: 50,
      lng: 110,
      icon: '❔',
    },
    {
      title: 'Coming Soon',
      description: 'A new game might be here...',
      route: null,
      lat: 55,
      lng: -8,
      icon: '❔',
    },
    {
      title: 'Coming Soon',
      description: 'A new game might be here...',
      route: null,
      lat: 40,
      lng: -118,
      icon: '❔',
    },
    {
      title: 'Locate the City',
      description: 'Drop a pin where you think a city is and see how close you got.',
      route: '/locate-the-city',
      lat: 74,
      lng: 60,
      icon: '📍',
    },
    {
      title: 'Coming Soon',
      description: 'A new game might be here...',
      route: null,
      lat: -25,
      lng: -101,
      icon: '❔',
    },
    {
      title: 'Coming Soon',
      description: 'A new game might be here...',
      route: null,
      lat: -5,
      lng: 105,
      icon: '❔',
    },
    {
      title: 'Narrow It Down',
      description: 'Bracket a hidden number with a shrinking range for points.',
      route: '/narrow-it-down',
      lat: 20,
      lng: -30,
      icon: '🎯',
    },
    {
      title: 'Coming Soon',
      description: 'A new game might be here...',
      route: null,
      lat: 74.5,
      lng: -78,
      icon: '❔',
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

    const icon = L.divIcon({
      className: 'game-tile-marker',
      html: `
        <div class="game-tile ${locked ? 'game-tile--locked' : ''}">
          <div class="game-tile__icon">${game.icon}</div>
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