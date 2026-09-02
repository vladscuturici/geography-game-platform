import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { inject } from '@angular/core';

interface GameTile {
  title: string;
  description: string;
  route: string | null;
  glyph: keyof typeof GLYPH_PATHS;
  tags: TagKey[];
}

type TagKey = 'singleplayer' | 'daily' | 'local-mp' | 'online-mp';

const TAG_LABELS: Record<TagKey, string> = {
  singleplayer: 'Singleplayer',
  daily: 'Daily',
  'local-mp': 'Local Multiplayer',
  'online-mp': 'Online Multiplayer',
};

const GLYPH_PATHS = {
  globe: `<circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18" />`,
  target: `<circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="4.5" /><path d="M12 3v3M12 18v3M3 12h3M18 12h3" />`,
  pin: `<path d="M12 21s-6.5-6.1-6.5-11A6.5 6.5 0 0 1 18.5 10c0 4.9-6.5 11-6.5 11z" /><circle cx="12" cy="10" r="2.3" />`,
  map: `<path d="M9 3 3 5v16l6-2 6 2 6-2V3l-6 2-6-2Z" /><path d="M9 3v16M15 5v16" />`,
  language: `<path d="M4 4h13a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H10l-4 4v-4H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" /><path d="M7 9h9M7 12.5h6" />`,
  grid: `<rect x="3" y="3" width="18" height="18" rx="1.5" /><path d="M9 3v18M15 3v18M3 9h18M3 15h18" /><path d="M10.3 10.3l3.4 3.4M13.7 10.3l-3.4 3.4" />`,
  unknown: `<circle cx="12" cy="12" r="9" /><path d="M9.5 9a2.5 2.5 0 0 1 4.9.8c0 1.7-2.4 2-2.4 3.7" /><circle cx="12" cy="17" r="0.1" fill="currentColor" stroke-width="2.4" />`,
  updown: `<path d="M7 10l5-5 5 5" /><path d="M7 15l5 5 5-5" />`,
  outline: `<path d="M5 8.5c.6-1.8 2-2.7 3.4-2.3 1-1.4 3-1.7 4-.4 1.7-.6 3.4.3 3.6 1.9 1.7.3 2.6 1.8 2 3.3.9 1.1.7 2.6-.5 3.3.2 1.6-1 2.9-2.5 2.7-.6 1.5-2.4 2.1-3.7 1.2-1.3 1-3.1.8-4-.5-1.7.2-3-1-2.9-2.6-1.5-.5-2.1-2.1-1.3-3.5-.8-1.1-.5-2.7.9-3.1Z" />`,
  sort: `<path d="M4 18h4M4 13h8M4 8h12" /><path d="M17 5v13M17 5l-3 3M17 5l3 3" />`,
  book: `<path d="M12 6.5c-1.7-1.3-3.9-2-6.2-2v12.5c2.3 0 4.5.7 6.2 2 1.7-1.3 3.9-2 6.2-2V4.5c-2.3 0-4.5.7-6.2 2Z" /><path d="M12 6.5v12.5" /><circle cx="12" cy="3" r="1.2" fill="currentColor" stroke="none" />`,
  wavelength: `<path d="M2 12c1-3.5 2.5-5.5 4-5.5s3 2 4 5.5 2.5 5.5 4 5.5 3-2 4-5.5 2.5-5.5 4-5.5" /><path d="M6 6.5v11M14 6.5v11" stroke-dasharray="1.5 1.5" stroke-width="1" />`,

} as const;

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css',
})
export class HomeComponent {
  private _router = inject(Router);
  private _sanitizer = inject(DomSanitizer);

  public games: GameTile[] = [
    { title: 'TicTacToe', description: 'The classic TicTacToe game with a geographic twist...', route: '/tic-tac-toe', glyph: 'grid', tags: ['singleplayer', 'local-mp', 'online-mp'] },
    { title: 'Wavelength', description: 'The classic Wavelength game with a geographic twist...', route: '/wavelength', glyph: 'wavelength', tags: ['local-mp', 'online-mp'] },
    { title: 'Locate the City', description: 'Drop a pin where you think a city is and see how close you got.', route: '/locate-the-city', glyph: 'pin', tags: ['singleplayer'] },
    { title: 'Guess the Country', description: 'Can you guess the daily/unlimited country based on clues?', route: '/guess-the-country/daily-country', glyph: 'globe', tags: ['singleplayer', 'daily'] },
    { title: 'WikiLocate', description: 'Identify the city based on the Wikipedia pages displayed.', route: '/wiki-locate', glyph: 'book', tags: ['singleplayer'] },
    { title: 'Sort it out', description: 'Order 5 countries based on the given criteria.', route: '/sort-it-out', glyph: 'sort', tags: ['singleplayer'] },
    { title: 'Narrow it Down', description: 'Bracket a hidden number with a shrinking range for points.', route: '/narrow-it-down', glyph: 'target', tags: ['singleplayer'] },
    { title: 'Higher Lower', description: 'Which country has the bigger population?', route: '/higher-lower', glyph: 'updown', tags: ['singleplayer'] },
  ];

  public tagLabel(tag: TagKey): string {
    return TAG_LABELS[tag];
  }

  public glyphSvg(glyph: keyof typeof GLYPH_PATHS): SafeHtml {
    return this._sanitizer.bypassSecurityTrustHtml(GLYPH_PATHS[glyph] ?? GLYPH_PATHS.unknown);
  }

  public onTileClick(game: GameTile): void {
    if (!game.route) return;
    this._router.navigateByUrl(game.route);
  }
}