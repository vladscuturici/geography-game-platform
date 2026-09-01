import { Component, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { SidebarComponent } from './sidebar/sidebar.component';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map, startWith } from 'rxjs';
import { RightMenuComponent } from './right-menu/right-menu.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, SidebarComponent, RightMenuComponent],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  private _router = inject(Router);
  protected readonly title = signal('geography-game-platform');

  public isHomePage = toSignal(
    this._router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map((event) => this.isHomeUrl(event.urlAfterRedirects)),
      startWith(this.isHomeUrl(this._router.url))
    ),
    { initialValue: this.isHomeUrl(this._router.url) }
  );
 
  private isHomeUrl(url: string): boolean {
    const path = url.split('?')[0].split('#')[0];
    return path === '/' || path === '/home';
  }
}
