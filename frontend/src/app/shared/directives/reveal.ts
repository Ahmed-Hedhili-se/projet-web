import { Directive, ElementRef, OnDestroy, OnInit, inject, input } from '@angular/core';

@Directive({
  selector: '[appReveal]', // usage : <div appReveal [revealDelay]="200"> ; effet de survol sur un enfant
  host: {
    class: 'reveal', // état caché (voir styles.css)
    '[style.transition-delay.ms]': 'revealDelay()', // délai avant l'apparition
  },
})
export class Reveal implements OnInit, OnDestroy {
  // fait apparaître l'élément en fondu quand il entre à l'écran
  readonly revealDelay = input(0); // en millisecondes, utile pour un effet en cascade

  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef); // élément HTML qui porte la directive
  private observer?: IntersectionObserver; // surveille l'entrée de l'élément à l'écran

  ngOnInit(): void {
    const element = this.element.nativeElement;

    if (!('IntersectionObserver' in window)) {
      // navigateur trop ancien ou tests : on affiche directement
      element.classList.add('is-visible');
      return;
    }

    this.observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          element.classList.add('is-visible'); // déclenche l'animation CSS
          this.observer?.disconnect(); // une seule fois, on arrête de surveiller
        }
      },
      { threshold: 0.15, rootMargin: '0px 0px -40px 0px' }, // visible à 15 %, un peu avant le bas de l'écran
    );
    this.observer.observe(element);
  }

  ngOnDestroy(): void {
    this.observer?.disconnect(); // nettoyage quand on quitte la page
  }
}
