import { Component, ElementRef, HostListener, inject, signal, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter, map, startWith } from 'rxjs';

interface NavItem {
  label: string;
  path?: string;
}

const DESKTOP_MIN_WIDTH = 992;

@Component({
  selector: 'app-main-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './main-layout.html',
  styleUrl: './main-layout.css',
})
export class MainLayout {
  private readonly router = inject(Router);

  protected readonly navItems: NavItem[] = [
    { label: 'Ana Sayfa', path: '/' },
    { label: 'İçerikler', path: '/icerikler' },
    { label: 'Takvim', path: '/takvim' },
    { label: 'Arşiv', path: '/arsiv' },
    { label: 'Görevlerim', path: '/gorevler' },
    { label: 'Metin Taslakları', path: '/taslaklar' },
  ];

  protected readonly menuOpen = signal(false);

  private readonly menuButton = viewChild<ElementRef<HTMLButtonElement>>('menuButton');
  private readonly closeButton = viewChild<ElementRef<HTMLButtonElement>>('closeButton');

  protected readonly page = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      startWith(null),
      map(() => {
        let current = this.router.routerState.snapshot.root;
        while (current.firstChild) {
          current = current.firstChild;
        }
        const data = current.data;
        return {
          title: (data['pageTitle'] as string | undefined) ?? 'GÖGÖVERSE WEB',
          description: (data['pageDescription'] as string | undefined) ?? '',
        };
      }),
    ),
    { requireSync: true },
  );

  protected openMenu(): void {
    this.menuOpen.set(true);
    queueMicrotask(() => this.closeButton()?.nativeElement.focus());
  }

  protected closeMenu(restoreFocus = false): void {
    if (!this.menuOpen()) {
      return;
    }
    this.menuOpen.set(false);
    if (restoreFocus) {
      this.menuButton()?.nativeElement.focus();
    }
  }

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    this.closeMenu(true);
  }

  @HostListener('window:resize')
  protected onResize(): void {
    if (window.innerWidth >= DESKTOP_MIN_WIDTH) {
      this.closeMenu();
    }
  }
}
