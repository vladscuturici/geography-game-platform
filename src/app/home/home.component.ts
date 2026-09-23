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
  isNew?: boolean;
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
  cards21: `<defs>
    <mask id="card21-mask">
      <rect x="0" y="0" width="24" height="24" fill="white" />
      <rect x="9" y="5" width="12" height="15" rx="1.5" fill="black" />
    </mask>
  </defs>
  <g>
    <rect x="5" y="7" width="12" height="15" rx="1.5" mask="url(#card21-mask)" />
    <rect x="9" y="5" width="12" height="15" rx="1.5" />
    <text x="15" y="15" font-size="7" font-weight="700" fill="currentColor" stroke="none" text-anchor="middle" dominant-baseline="central">21</text>
  </g>`,
  scale: `<path d="M12 4v16" />
    <path d="M8 20h8" />
    <path d="M5 7h14" />
    <path d="M12 4l-3 3M12 4l3 3" />
    <path d="M5 7l-3 5.5a3.2 3.2 0 0 0 6.4 0Z" />
    <path d="M19 7l-3 5.5a3.2 3.2 0 0 0 6.4 0Z" />`,
  bingo: `  <g>
    <rect x="3" y="3" width="18" height="18" rx="1.5" />
    <path d="M9 3v18M15 3v18M3 9h18M3 15h18" />
    <circle cx="6" cy="6" r="1.3" fill="currentColor" stroke="none" />
    <circle cx="18" cy="12" r="1.3" fill="currentColor" stroke="none" />
    <circle cx="12" cy="18" r="1.3" fill="currentColor" stroke="none" />
  </g>`,
  clues: `<circle cx="10.5" cy="10.5" r="6.5" /><path d="M15.3 15.3L21 21" /><path d="M8.7 9a1.9 1.9 0 0 1 3.7.6c0 1.3-1.9 1.5-1.9 2.7" /><circle cx="10.5" cy="14" r="0.1" fill="currentColor" stroke-width="2.2" />`

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
    { title: 'Country21', description: 'The classic 21 game with a geographic twist...', route: '/country21', glyph: 'cards21', tags: ['singleplayer', 'online-mp'], isNew: true },
    { title: 'PopulationMatch', description: 'Combine countries from your hand to get as close as possible to the target.', route: '/populationmatch', glyph: 'scale', tags: ['singleplayer'], isNew: true },    
    { title: 'Country Bingo', description: 'Bingo, but with countries. Place the countries, one by one, in the correct condition.', route: '/country-bingo', glyph: 'bingo', tags: ['singleplayer', 'online-mp'], isNew: true },  
    { title: 'CountryClues', description: 'Each guess reveals a new clue, how early can you guess the country?', route: '/countryclues', glyph: 'clues', tags: ['singleplayer'], isNew: true },    
    { title: 'TicTacToe', description: 'TicTacToe with a geographic twist, can you name a countries that match both conditions?', route: '/tic-tac-toe', glyph: 'grid', tags: ['singleplayer', 'local-mp', 'online-mp'] },
    { title: 'Wavelength', description: 'Wavelength game with a geographic twist, are you and your friend are on the same wavelength?', route: '/wavelength', glyph: 'wavelength', tags: ['local-mp', 'online-mp'] },
    { title: 'Locate the City', description: 'Drop a pin where you think a city is and see how close you got.', route: '/locate-the-city', glyph: 'pin', tags: ['singleplayer'] },
    { title: 'Guess the Country', description: 'Can you guess the country using information from your previous guesses?', route: '/guess-the-country/daily-country', glyph: 'globe', tags: ['singleplayer', 'daily'] },
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