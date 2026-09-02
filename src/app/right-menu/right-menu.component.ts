import { Component, HostListener } from '@angular/core';

@Component({
  selector: 'app-right-menu',
  imports: [],
  templateUrl: './right-menu.component.html',
  styleUrl: './right-menu.component.css',
})
export class RightMenuComponent {
  public readonly contactEmail = 'contact@compasslegend.xyz';
  public showContactPopover = false;
  public copyLabel = 'Copy';

  public toggleContactPopover(): void {
    this.showContactPopover = !this.showContactPopover;
    if (!this.showContactPopover) {
      this.copyLabel = 'Copy';
    }
  }

  public closeContactPopover(): void {
    this.showContactPopover = false;
    this.copyLabel = 'Copy';
  }

  public async copyEmail(event: Event): Promise<void> {
    event.stopPropagation();
    try {
      await navigator.clipboard.writeText(this.contactEmail);
      this.copyLabel = 'Copied!';
      setTimeout(() => (this.copyLabel = 'Copy'), 1500);
    } catch {
      // Clipboard API unavailable — the address is still visible to select manually.
    }
  }

  public openDonate(): void {
    window.open('https://ko-fi.com/vlad03', '_blank', 'noopener');
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (this.showContactPopover && !(event.target as HTMLElement).closest('.right-menu__wrap')) {
      this.closeContactPopover();
    }
  }
}