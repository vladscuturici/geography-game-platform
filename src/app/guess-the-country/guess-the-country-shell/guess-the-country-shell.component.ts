import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'app-guess-the-country-shell',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './guess-the-country-shell.component.html',
  styleUrl: './guess-the-country-shell.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GuessTheCountryShellComponent {}