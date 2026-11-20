import { Injectable, inject } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import type Lenis from 'lenis';
import { filter } from 'rxjs';
import { SceneSync } from './scene-sync';

@Injectable({ providedIn: 'root' })
export class SmoothScroll {
  private readonly router = inject(Router);
  private readonly sync = inject(SceneSync);
  private lenis: Lenis | null = null;

  async start(): Promise<void> {
    if (this.lenis || this.sync.reduceMotion || navigator.userAgent.includes('jsdom')) {
      return;
    }
    const { default: LenisClass } = await import('lenis');
    this.lenis = new LenisClass({ duration: 1.15, smoothWheel: true, touchMultiplier: 1.5, autoRaf: true });

    this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe(() => this.lenis?.scrollTo(0, { immediate: true, force: true }));
  }

  showTopOf(element: HTMLElement, offset = 72): void {
    const top = window.scrollY + element.getBoundingClientRect().top - offset;
    if (this.lenis) {
      this.lenis.scrollTo(top);
    } else {
      window.scrollTo({ top, behavior: this.sync.reduceMotion ? 'auto' : 'smooth' });
    }
  }

  showBottomOf(element: HTMLElement): void {
    const overflow = element.getBoundingClientRect().bottom - window.innerHeight + 24;
    if (overflow <= 0) {
      return;
    }
    const top = window.scrollY + overflow;
    if (this.lenis) {
      this.lenis.scrollTo(top);
    } else {
      window.scrollTo({ top });
    }
  }
}
