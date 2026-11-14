import { Directive, ElementRef, OnDestroy, OnInit, inject, input } from '@angular/core';

@Directive({
  selector: '[appReveal]',
  host: {
    class: 'reveal',
    '[style.transition-delay.ms]': 'revealDelay()',
  },
})
export class Reveal implements OnInit, OnDestroy {
  readonly revealDelay = input(0);

  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);
  private observer?: IntersectionObserver;

  ngOnInit(): void {
    const element = this.element.nativeElement;

    if (!('IntersectionObserver' in window)) {
      element.classList.add('is-visible');
      return;
    }

    this.observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          element.classList.add('is-visible');
          this.observer?.disconnect();
        }
      },
      { threshold: 0.15, rootMargin: '0px 0px -40px 0px' },
    );
    this.observer.observe(element);
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
  }
}
