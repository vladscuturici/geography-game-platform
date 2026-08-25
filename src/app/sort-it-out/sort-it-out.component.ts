// sort-it-out.component.ts
import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, inject, OnInit } from '@angular/core';
import { shareReplay } from 'rxjs';
import { CountriesService } from '../services/countries.service';
import { Country } from '../models/countries.model';

type CategoryId = 'population' | 'area' | 'density' | 'borders' | 'languages';

interface CategoryDef {
  id: CategoryId;
  label: string;
  lowLabel: string;
  highLabel: string;
  unit: string;
  getValue: (c: Country) => number;
  format: (value: number) => string;
}

interface RoundTile {
  country: Country;
  value: number;
}

const CATEGORIES: CategoryDef[] = [
  {
    id: 'population',
    label: 'Population',
    lowLabel: 'Smallest population',
    highLabel: 'Largest population',
    unit: 'people',
    getValue: c => c.population!,
    format: v => new Intl.NumberFormat('en-US').format(Math.round(v)),
  },
  {
    id: 'area',
    label: 'Area',
    lowLabel: 'Smallest area',
    highLabel: 'Largest area',
    unit: 'km²',
    getValue: c => c.area!,
    format: v => `${new Intl.NumberFormat('en-US').format(Math.round(v))} km²`,
  },
  {
    id: 'density',
    label: 'Population density',
    lowLabel: 'Lowest density',
    highLabel: 'Highest density',
    unit: 'people/km²',
    getValue: c => c.population! / c.area!,
    format: v => `${v.toFixed(1)} people/km²`,
  },
  {
    id: 'borders',
    label: 'Bordering nations',
    lowLabel: 'Fewest neighbors',
    highLabel: 'Most neighbors',
    unit: 'countries',
    getValue: c => (c.borders?.length ?? 0),
    format: v => `${v} ${v === 1 ? 'neighbor' : 'neighbors'}`,
  },
  {
    id: 'languages',
    label: 'Official languages',
    lowLabel: 'Fewest languages',
    highLabel: 'Most languages',
    unit: 'languages',
    getValue: c => (c.languages?.length ?? 0),
    format: v => `${v} ${v === 1 ? 'language' : 'languages'}`,
  },
];

@Component({
  selector: 'app-sort-it-out',
  imports: [CommonModule],
  templateUrl: './sort-it-out.component.html',
  styleUrl: './sort-it-out.component.css',
})
export class SortItOutComponent implements OnInit {
  private _countriesService = inject(CountriesService);
  private _cdr = inject(ChangeDetectorRef);

  public countries$ = this._countriesService.getAllCountries().pipe(shareReplay(1));
  private _allCountries: Country[] = [];

  public isLoading = true;
  public category: CategoryDef | null = null;

  /** The 5 tiles in their current (user-arranged) order. */
  public tiles: RoundTile[] = [];

  public isRevealed = false;
  public isCorrect = false;
  /** Per-tile correctness, populated only after reveal, indexed like `tiles`. */
  public tileCorrectness: boolean[] = [];
  /** The actual correct order, shown alongside a wrong guess for learning. */
  public correctOrder: RoundTile[] = [];

  public round = 0;
  public correctRounds = 0;
  public streak = 0;
  public bestStreak = 0;
  public guessHistory: { round: number; category: string; correct: boolean; tilesCorrectPct: number }[] = [];

  private _draggedIndex: number | null = null;
  public dragOverIndex: number | null = null;

  ngOnInit(): void {
    this.countries$.subscribe(countries => {
      this._allCountries = countries.filter(
        c =>
          typeof c.population === 'number' &&
          c.population > 0 &&
          typeof c.area === 'number' &&
          c.area > 0 &&
          Array.isArray(c.borders)
      );
      this.isLoading = false;
      this._startRound();
      this._cdr.markForCheck();
    });
  }

  public get accuracyPct(): number {
    if (this.guessHistory.length === 0) return 0;
    const total = this.guessHistory.reduce((sum, entry) => sum + entry.tilesCorrectPct, 0);
    return Math.round(total / this.guessHistory.length);
  }

  public toGreenSaturation(pct: number): string {
    const clamped = Math.min(Math.max(pct, 0), 100);
    const lightness = 100 - (clamped / 100) * 60;
    return `hsl(120, 70%, ${lightness}%)`;
  }

  private _pickCategory(): CategoryDef {
    return CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)];
  }

  /** Picks 5 countries whose values for `category` are all distinct. */
  private _pickFiveDistinct(category: CategoryDef): RoundTile[] {
    const shuffled = [...this._allCountries].sort(() => Math.random() - 0.5);
    const chosen: RoundTile[] = [];
    const seenValues = new Set<number>();

    for (const country of shuffled) {
      const value = category.getValue(country);
      if (!Number.isFinite(value)) continue;
      // Round density slightly to avoid picking two near-identical values
      // that would make the round nearly untestable, while still keeping
      // them meaningfully distinct.
      const bucket = category.id === 'density' ? Math.round(value * 10) : value;
      if (seenValues.has(bucket)) continue;

      seenValues.add(bucket);
      chosen.push({ country, value });
      if (chosen.length === 5) break;
    }

    return chosen;
  }

  private _startRound(): void {
    if (this._allCountries.length < 5) return;

    // Retry category selection in the rare case a category can't find 5
    // distinct-valued countries (shouldn't normally happen with real data).
    let category = this._pickCategory();
    let picked = this._pickFiveDistinct(category);
    let attempts = 0;
    while (picked.length < 5 && attempts < CATEGORIES.length) {
      category = this._pickCategory();
      picked = this._pickFiveDistinct(category);
      attempts++;
    }

    this.category = category;
    this.tiles = picked.sort((a, b) => a.country.name.localeCompare(b.country.name));
    this.isRevealed = false;
    this.isCorrect = false;
    this.tileCorrectness = [];
    this.correctOrder = [];
    this._draggedIndex = null;
    this.dragOverIndex = null;
  }

  public nextRound(): void {
    this._startRound();
  }

  public restart(): void {
    this.round = 0;
    this.correctRounds = 0;
    this.streak = 0;
    this.guessHistory = [];
    this._startRound();
  }

  // --- Drag and drop reordering (horizontal, within the tile row) ---

  public onDragStart(index: number): void {
    if (this.isRevealed) return;
    this._draggedIndex = index;
  }

  public onDragOver(event: DragEvent, index: number): void {
    if (this.isRevealed) return;
    event.preventDefault();
    this.dragOverIndex = index;
  }

  public onDragLeave(index: number): void {
    if (this.dragOverIndex === index) {
      this.dragOverIndex = null;
    }
  }

  public onDrop(index: number): void {
    if (this.isRevealed || this._draggedIndex === null || this._draggedIndex === index) {
      this.dragOverIndex = null;
      return;
    }

    const updated = [...this.tiles];
    const [moved] = updated.splice(this._draggedIndex, 1);
    updated.splice(index, 0, moved);
    this.tiles = updated;

    this._draggedIndex = null;
    this.dragOverIndex = null;
  }

  public onDragEnd(): void {
    this._draggedIndex = null;
    this.dragOverIndex = null;
  }

  // --- Button-based reordering (works without drag, e.g. on touch devices) ---

  public onMoveLeft(index: number): void {
    if (this.isRevealed || index === 0) return;
    const updated = [...this.tiles];
    [updated[index - 1], updated[index]] = [updated[index], updated[index - 1]];
    this.tiles = updated;
  }

  public onMoveRight(index: number): void {
    if (this.isRevealed || index === this.tiles.length - 1) return;
    const updated = [...this.tiles];
    [updated[index], updated[index + 1]] = [updated[index + 1], updated[index]];
    this.tiles = updated;
  }

  // --- Submitting ---

  public onSubmit(): void {
    if (this.isRevealed || !this.category) return;

    const correctOrder = [...this.tiles].sort((a, b) => a.value - b.value);
    this.correctOrder = correctOrder;
    this.tileCorrectness = this.tiles.map((tile, i) => tile === correctOrder[i]);
    this.isCorrect = this.tileCorrectness.every(Boolean);
    this.isRevealed = true;
    this.round++;

    const tilesCorrectPct = Math.round(
      (this.tileCorrectness.filter(Boolean).length / this.tileCorrectness.length) * 100
    );

    if (this.isCorrect) {
      this.correctRounds++;
      this.streak++;
      this.bestStreak = Math.max(this.bestStreak, this.streak);
    } else {
      this.streak = 0;
    }

    this.guessHistory = [
      ...this.guessHistory,
      { round: this.round, category: this.category.label, correct: this.isCorrect, tilesCorrectPct },
    ];
  }

  public formatValue(value: number): string {
    return this.category ? this.category.format(value) : `${value}`;
  }
}