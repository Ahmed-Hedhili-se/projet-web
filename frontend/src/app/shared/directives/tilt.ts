import { Directive, ElementRef, inject, input } from '@angular/core';

@Directive({
  selector: '[appTilt]',
  host: {
    '(pointermove)': 'onPointerMove($event)',
    '(pointerleave)': 'reset()',
  },
})
export class Tilt {
  readonly tiltMax = input(4);

  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

  protected onPointerMove(event: PointerEvent): void {
    if (event.pointerType !== 'mouse' || this.reduceMotion) {
      return;
    }
    const rect = this.element.nativeElement.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width - 0.5;
    const y = (event.clientY - rect.top) / rect.height - 0.5;
    const max = this.tiltMax() * 2;
    this.element.nativeElement.style.transform = `perspective(1000px) rotateX(${-y * max}deg) rotateY(${x * max}deg)`;
  }

  protected reset(): void {
    this.element.nativeElement.style.transform = '';
  }
}
