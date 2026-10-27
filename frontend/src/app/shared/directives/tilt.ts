import { Directive, ElementRef, inject, input } from '@angular/core';

@Directive({
  selector: '[appTilt]',                                   // usage : <article appTilt> ; l'élément doit avoir une transition CSS
  host: {
    '(pointermove)': 'onPointerMove($event)',              // la souris bouge sur l'élément
    '(pointerleave)': 'reset()',                           // la souris quitte l'élément
  },
})
export class Tilt {                                        // incline légèrement l'élément vers la souris (effet 3D)
  readonly tiltMax = input(4);                             // inclinaison maximale en degrés

  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

  protected onPointerMove(event: PointerEvent): void {
    if (event.pointerType !== 'mouse' || this.reduceMotion) {
      return;                                              // pas d'effet au doigt ni si les animations sont réduites
    }
    const rect = this.element.nativeElement.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width - 0.5; // de -0.5 (gauche) à 0.5 (droite)
    const y = (event.clientY - rect.top) / rect.height - 0.5; // de -0.5 (haut) à 0.5 (bas)
    const max = this.tiltMax() * 2;
    this.element.nativeElement.style.transform = `perspective(1000px) rotateX(${-y * max}deg) rotateY(${x * max}deg)`;
  }

  protected reset(): void {
    this.element.nativeElement.style.transform = '';       // revient à plat
  }
}
