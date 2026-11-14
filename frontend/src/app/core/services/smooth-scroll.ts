import { Injectable, inject } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import type Lenis from 'lenis';
import { filter } from 'rxjs';
import { SceneSync } from './scene-sync';

@Injectable({ providedIn: 'root' })
export class SmoothScroll {                                // défilement adouci de tout le site (bibliothèque Lenis)
  private readonly router = inject(Router);
  private readonly sync = inject(SceneSync);
  private lenis: Lenis | null = null;

  async start(): Promise<void> {                           // appelé une fois, au démarrage de l'application
    if (this.lenis || this.sync.reduceMotion || navigator.userAgent.includes('jsdom')) {
      return;                                              // animations réduites ou tests : on garde le défilement normal
    }
    const { default: LenisClass } = await import('lenis'); // chargé à la demande, après l'affichage du site
    this.lenis = new LenisClass({ duration: 1.15, smoothWheel: true, touchMultiplier: 1.5, autoRaf: true });

    this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe(() => this.lenis?.scrollTo(0, { immediate: true, force: true })); // nouvelle page : retour en haut, sans animation
  }

  showBottomOf(element: HTMLElement): void {               // descend la page jusqu'à ce que le bas de l'élément soit visible (chat du conseiller IA)
    const overflow = element.getBoundingClientRect().bottom - window.innerHeight + 24;
    if (overflow <= 0) {
      return;                                              // déjà visible
    }
    const top = window.scrollY + overflow;
    if (this.lenis) {
      this.lenis.scrollTo(top);                            // avec le défilement adouci
    } else {
      window.scrollTo({ top });
    }
  }
}
