import { Component, ElementRef, QueryList, ViewChildren, AfterViewInit, OnDestroy } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, NavigationEnd } from '@angular/router';
import { Subscription, filter } from 'rxjs';

interface NavEntry {
  label: string;
  route: string;
  glyph: string;
  hint: string;
}

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.css',
})
export class SidebarComponent implements AfterViewInit, OnDestroy {
  @ViewChildren('navLink') navLinks!: QueryList<ElementRef<HTMLAnchorElement>>;

  private routerSub?: Subscription;

  constructor(private router: Router) {}

  readonly entries: NavEntry[] = [
    // { label: 'Home', route: '/home', glyph: 'compass', hint: 'I' },
    { label: 'Country21', route: '/country21', glyph: 'cards21', hint: 'I' },
    { label: 'PopulationMatch', route: '/populationmatch', glyph: 'scale', hint: 'II' },
    { label: 'Country Bingo', route: '/country-bingo', glyph: 'bingo', hint: 'III' },
    { label: 'CountryClues', route: '/countryclues', glyph: 'clues', hint: 'IV'},
    { label: 'TicTacToe', route: '/tic-tac-toe', glyph: 'grid', hint: 'V' },
    { label: 'Wavelength', route: 'wavelength', glyph: 'wavelength', hint: 'VI' },
    { label: 'Locate the City', route: '/locate-the-city', glyph: 'pin', hint: 'VII' },
    { label: 'Guess the Country', route: '/guess-the-country', glyph: 'globe', hint: 'VIII' },
    { label: 'WikiLocate', route: '/wiki-locate', glyph: 'book', hint: 'IX' },
    { label: 'Sort it Out', route: 'sort-it-out', glyph: 'sort', hint: 'X' },
    { label: 'Narrow It Down', route: '/narrow-it-down', glyph: 'target', hint: 'XI' },
    { label: 'Higher Lower', route: '/higher-lower', glyph: 'updown', hint: 'XII' },
  ];

  ngAfterViewInit(): void {
    // Scroll to the active link once on init (e.g. on refresh / deep link).
    this.scrollActiveIntoView();

    this.routerSub = this.router.events
      .pipe(filter((e) => e instanceof NavigationEnd))
      .subscribe(() => this.scrollActiveIntoView());
  }

  ngOnDestroy(): void {
    this.routerSub?.unsubscribe();
  }

  private scrollActiveIntoView(): void {
    if (window.innerWidth > 900) return;

    setTimeout(() => {
      const activeEl = this.navLinks?.find((el) =>
        el.nativeElement.classList.contains('legend-key__link--active')
      );
      activeEl?.nativeElement.scrollIntoView({
        behavior: 'smooth',
        inline: 'center',
        block: 'nearest',
      });
    });
  }
}