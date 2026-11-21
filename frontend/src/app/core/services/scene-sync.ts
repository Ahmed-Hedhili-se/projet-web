import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';

export type SceneMode = 'hero' | 'corner';

export interface ScreenPoint {
  x: number;
  y: number;
}

export interface PlanetOnScreen extends ScreenPoint {
  radius: number;
}

export interface RGB {
  r: number;
  g: number;
  b: number;
}

const AURORA = {
  blue: { r: 0x29 / 255, g: 0x97 / 255, b: 0xff / 255 },
  violet: { r: 0x8b / 255, g: 0x5c / 255, b: 0xf6 / 255 },
  cyan: { r: 0x22 / 255, g: 0xd3 / 255, b: 0xee / 255 },
};

export function mixColor(a: RGB, b: RGB, t: number): RGB {
  return { r: a.r + (b.r - a.r) * t, g: a.g + (b.g - a.g) * t, b: a.b + (b.b - a.b) * t };
}

export function auroraForProgress(progress: number): RGB {
  const p = Math.min(1, Math.max(0, progress));
  return p < 0.5
    ? mixColor(AURORA.blue, AURORA.violet, p * 2)
    : mixColor(AURORA.violet, AURORA.cyan, (p - 0.5) * 2);
}

export function auroraForPage(path: string, progress: number): RGB {
  if (path === '/' || path === '') return auroraForProgress(progress);
  if (path.startsWith('/about')) return auroraForProgress(progress / 2);
  if (path.startsWith('/recommend') || path === '/login' || path === '/register')
    return AURORA.violet;
  if (path.startsWith('/contact') || path.startsWith('/admin')) return AURORA.cyan;
  return AURORA.blue;
}

export interface SceneFrame {
  pointer: ScreenPoint | null;
  scrollProgress: number;
  planet: PlanetOnScreen | null;
  markers: ScreenPoint[];
  pulses: ScreenPoint[];
  accent: RGB;
}

@Injectable({ providedIn: 'root' })
export class SceneSync {
  private readonly router = inject(Router);

  readonly mode = signal<SceneMode>('corner');
  readonly reduceMotion =
    typeof window !== 'undefined' &&
    (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false);
  readonly frame: SceneFrame = {
    pointer: null,
    scrollProgress: 0,
    planet: null,
    markers: [],
    pulses: [],
    accent: { ...AURORA.blue },
  };

  readonly path = signal('/');
  private lastCssWrite = 0;

  private readonly onPointerMove = (event: PointerEvent) => {
    this.frame.pointer =
      event.pointerType === 'mouse' ? { x: event.clientX, y: event.clientY } : null;
  };
  private readonly onPointerLeave = () => (this.frame.pointer = null);
  private readonly onScroll = () => this.updateScroll();

  constructor() {
    this.mode.set(this.modeFor(this.router.url));
    this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe((event) => this.mode.set(this.modeFor(event.urlAfterRedirects)));

    if (typeof window === 'undefined') {
      return;
    }
    window.addEventListener('pointermove', this.onPointerMove, { passive: true });
    document.addEventListener('pointerleave', this.onPointerLeave);
    window.addEventListener('scroll', this.onScroll, { passive: true });
    window.addEventListener('resize', this.onScroll, { passive: true });
    this.updateScroll();

    inject(DestroyRef).onDestroy(() => {
      window.removeEventListener('pointermove', this.onPointerMove);
      document.removeEventListener('pointerleave', this.onPointerLeave);
      window.removeEventListener('scroll', this.onScroll);
      window.removeEventListener('resize', this.onScroll);
    });
  }

  tickAccent(dt: number): void {
    const target = auroraForPage(this.path(), this.frame.scrollProgress);
    const k = this.reduceMotion ? 1 : Math.min(1, dt * 2.5);
    this.frame.accent = mixColor(this.frame.accent, target, k);

    const now = performance.now();
    if ((this.reduceMotion || now - this.lastCssWrite > 100) && typeof document !== 'undefined') {
      this.lastCssWrite = now;
      const { r, g, b } = this.frame.accent;
      const rgb = `${Math.round(r * 255)} ${Math.round(g * 255)} ${Math.round(b * 255)}`;
      document.documentElement.style.setProperty('--aurora-rgb', rgb);
      document.documentElement.style.setProperty('--aurora', `rgb(${rgb})`);
      const text = mixColor(this.frame.accent, { r: 1, g: 1, b: 1 }, 0.35);
      document.documentElement.style.setProperty(
        '--aurora-text',
        `rgb(${Math.round(text.r * 255)} ${Math.round(text.g * 255)} ${Math.round(text.b * 255)})`,
      );
    }
  }

  private modeFor(url: string): SceneMode {
    const path = url.split(/[?#]/)[0] || '/';
    this.path.set(path);
    return path === '/' ? 'hero' : 'corner';
  }

  private updateScroll(): void {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    this.frame.scrollProgress = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
  }
}
