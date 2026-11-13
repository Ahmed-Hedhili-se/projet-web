import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';

export type SceneMode = 'hero' | 'corner';                 // hero = grande planète (Home) · corner = petite planète dans un coin (autres pages)

export interface ScreenPoint {                             // position à l'écran, en pixels CSS
  x: number;
  y: number;
}

export interface PlanetOnScreen extends ScreenPoint {      // silhouette de la planète à l'écran
  radius: number;                                          // rayon visible en pixels (0 = pas de planète)
}

export interface RGB {                                     // couleur, composantes de 0 à 1
  r: number;
  g: number;
  b: number;
}

const AURORA = {                                           // palette « Aurore » (docs/DESIGN-MOTION.md, section 10)
  blue: { r: 0x29 / 255, g: 0x97 / 255, b: 0xff / 255 },   // #2997ff
  violet: { r: 0x8b / 255, g: 0x5c / 255, b: 0xf6 / 255 }, // #8b5cf6
  cyan: { r: 0x22 / 255, g: 0xd3 / 255, b: 0xee / 255 },   // #22d3ee
};

export function mixColor(a: RGB, b: RGB, t: number): RGB { // mélange de deux couleurs (t = 0 → a, t = 1 → b)
  return { r: a.r + (b.r - a.r) * t, g: a.g + (b.g - a.g) * t, b: a.b + (b.b - a.b) * t };
}

export function auroraForProgress(progress: number): RGB { // défilement 0 → 0.5 → 1 : bleu → violet → cyan
  const p = Math.min(1, Math.max(0, progress));
  return p < 0.5 ? mixColor(AURORA.blue, AURORA.violet, p * 2) : mixColor(AURORA.violet, AURORA.cyan, (p - 0.5) * 2);
}

export function auroraForPage(path: string, progress: number): RGB { // teinte de chaque page (section 10)
  if (path === '/' || path === '') return auroraForProgress(progress);                       // Home : suit le défilement
  if (path.startsWith('/about')) return auroraForProgress(progress / 2);                     // bleu → violet
  if (path.startsWith('/recommend') || path === '/login' || path === '/register') return AURORA.violet;
  if (path.startsWith('/contact') || path.startsWith('/admin')) return AURORA.cyan;
  return AURORA.blue;                                                                         // catalogue, fiche GPU, espace compte…
}

export interface SceneFrame {                              // données partagées à chaque image (lues par les canvas, pas par les templates)
  pointer: ScreenPoint | null;                             // curseur (null = hors de la fenêtre ou écran tactile)
  scrollProgress: number;                                  // 0 = haut de la page · 1 = bas de la page
  planet: PlanetOnScreen | null;                           // écrit par la scène 3D · null = pas encore chargée ou WebGL indisponible
  markers: ScreenPoint[];                                  // data centers visibles à l'écran (écrits par la scène 3D)
  pulses: ScreenPoint[];                                   // paquets de données arrivés sur un data center à cette image (le réseau peut y réagir)
  accent: RGB;                                             // couleur « Aurore » actuelle (halo, liens actifs, lueurs) — mise à jour par tickAccent()
}

@Injectable({ providedIn: 'root' })
export class SceneSync {                                   // fait « se parler » la planète 3D et le réseau neuronal (voir docs/DESIGN-MOTION.md)
  private readonly router = inject(Router);

  readonly mode = signal<SceneMode>('corner');             // change rarement (navigation) : un signal suffit
  readonly reduceMotion = typeof window !== 'undefined' && (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false);
  readonly frame: SceneFrame = {                           // objet modifié à chaque image : volontairement pas un signal (pas de rafraîchissement Angular à 60 i/s)
    pointer: null,
    scrollProgress: 0,
    planet: null,
    markers: [],
    pulses: [],
    accent: { ...AURORA.blue },
  };

  private path = '/';                                      // adresse actuelle sans ?query ni #ancre
  private lastCssWrite = 0;                                // dernière écriture des variables CSS (ms)

  private readonly onPointerMove = (event: PointerEvent) => {
    this.frame.pointer = event.pointerType === 'mouse' ? { x: event.clientX, y: event.clientY } : null;
  };
  private readonly onPointerLeave = () => (this.frame.pointer = null);
  private readonly onScroll = () => this.updateScroll();

  constructor() {
    this.mode.set(this.modeFor(this.router.url));
    this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe((event) => this.mode.set(this.modeFor(event.urlAfterRedirects))); // Home → hero, ailleurs → corner

    if (typeof window === 'undefined') {
      return;                                              // pas de navigateur (tests côté serveur)
    }
    window.addEventListener('pointermove', this.onPointerMove, { passive: true });
    document.addEventListener('pointerleave', this.onPointerLeave);
    window.addEventListener('scroll', this.onScroll, { passive: true });
    window.addEventListener('resize', this.onScroll, { passive: true });
    this.updateScroll();

    inject(DestroyRef).onDestroy(() => {                   // nettoyage si l'application est détruite
      window.removeEventListener('pointermove', this.onPointerMove);
      document.removeEventListener('pointerleave', this.onPointerLeave);
      window.removeEventListener('scroll', this.onScroll);
      window.removeEventListener('resize', this.onScroll);
    });
  }

  tickAccent(dt: number): void {                           // à appeler à chaque image (boucle de la scène 3D) ; dt en secondes
    const target = auroraForPage(this.path, this.frame.scrollProgress);
    const k = this.reduceMotion ? 1 : Math.min(1, dt * 2.5); // ~1.2 s pour changer de teinte ; immédiat si animations réduites
    this.frame.accent = mixColor(this.frame.accent, target, k);

    const now = performance.now();
    if (now - this.lastCssWrite > 100 && typeof document !== 'undefined') { // au plus ~10 écritures par seconde
      this.lastCssWrite = now;
      const { r, g, b } = this.frame.accent;
      const rgb = `${Math.round(r * 255)} ${Math.round(g * 255)} ${Math.round(b * 255)}`;
      document.documentElement.style.setProperty('--aurora-rgb', rgb);           // usage : rgb(var(--aurora-rgb) / .12)
      document.documentElement.style.setProperty('--aurora', `rgb(${rgb})`);     // usage : color: var(--aurora)
    }
  }

  private modeFor(url: string): SceneMode {
    this.path = url.split(/[?#]/)[0] || '/';               // ignore ?query et #ancre
    return this.path === '/' ? 'hero' : 'corner';
  }

  private updateScroll(): void {                           // progression du défilement, de 0 à 1
    const max = document.documentElement.scrollHeight - window.innerHeight;
    this.frame.scrollProgress = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
  }
}
