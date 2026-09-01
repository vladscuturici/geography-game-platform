import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

interface NavEntry {
  label: string;
  route: string;
  glyph: string; // svg path id used in the sprite below
  hint: string;
}

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.css',
})
export class SidebarComponent {
  readonly entries: NavEntry[] = [
    {
      label: 'Home',
      route: '/home',
      glyph: 'map',
      hint: 'I',
    },
    {
      label: 'Guess the Country',
      route: '/guess-the-country',
      glyph: 'globe',
      hint: 'II',
    },
    {
      label: 'TicTacToe',
      route: '/tic-tac-toe',
      glyph: 'grid',
      hint: 'III',
    },
    {
      label: 'Narrow It Down',
      route: '/narrow-it-down',
      glyph: 'target',
      hint: 'IV',
    },
    {
      label: 'Locate the City',
      route: '/locate-the-city',
      glyph: 'pin',
      hint: 'V',
    },
    {
      label: 'WikiLocate',
      route: '/wiki-locate',
      glyph: 'book',
      hint: 'VI',
    },
    {
      label: 'Higher Lower',
      route: 'higher-lower',
      glyph: 'updown',
      hint: 'VII',
    },
    {
      label: 'Sort it Out',
      route: 'sort-it-out',
      glyph: 'sort',
      hint: 'VIII',
    },
    {
      label: 'Wavelength',
      route: 'wavelength',
      glyph: 'wavelength',
      hint: 'IX',
    },
  ];
}