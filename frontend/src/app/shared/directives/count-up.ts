import { Directive, ElementRef, OnDestroy, OnInit, inject, input } from '@angular/core';

@Directive({
  selector: '[appCountUp]', // usage : <p [appCountUp]="99.9" [countDecimals]="1" countSuffix="%"></p> (élément vide)
})
export class CountUp implements OnInit, OnDestroy {
  // fait défiler un nombre jusqu'à sa valeur quand il entre à l'écran
  readonly appCountUp = input.required<number>(); // valeur finale
  readonly countFrom = input(0); // valeur de départ
  readonly countDecimals = input(0); // nombre de décimales affichées
  readonly countPrefix = input(''); // texte avant, ex. "$"
  readonly countSuffix = input(''); // texte après, ex. " GB"
  readonly countGrouping = input(true); // séparateur des milliers (false pour une année : 2024)

  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);
  private observer?: IntersectionObserver;
  private frame = 0; // identifiant de l'image d'animation en cours

  ngOnInit(): void {
    const element = this.element.nativeElement;
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

    if (reduceMotion || !('IntersectionObserver' in window)) {
      element.textContent = this.format(this.appCountUp()); // pas d'animation : valeur finale directement
      return;
    }

    element.textContent = this.format(this.countFrom()); // valeur de départ en attendant
    this.observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          this.animate();
          this.observer?.disconnect(); // une seule fois
        }
      },
      { threshold: 0.4 },
    );
    this.observer.observe(element);
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
    cancelAnimationFrame(this.frame); // arrête l'animation si on quitte la page
  }

  private animate(): void {
    const from = this.countFrom();
    const to = this.appCountUp();
    const duration = 1600; // durée en millisecondes
    const start = performance.now();

    const step = (now: number) => {
      const progress = Math.min((now - start) / duration, 1); // de 0 à 1
      const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress); // rapide au début, lent à la fin
      this.element.nativeElement.textContent = this.format(from + (to - from) * eased);
      if (progress < 1) {
        this.frame = requestAnimationFrame(step); // image suivante
      }
    };
    this.frame = requestAnimationFrame(step);
  }

  private format(value: number): string {
    // ex. 1200 → "1,200"
    const decimals = this.countDecimals();
    const text = value.toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
      useGrouping: this.countGrouping(),
    });
    return `${this.countPrefix()}${text}${this.countSuffix()}`;
  }
}
