import { Directive, ElementRef, OnDestroy, OnInit, inject, input } from '@angular/core';

@Directive({
  selector: '[appCountUp]',
})
export class CountUp implements OnInit, OnDestroy {
  readonly appCountUp = input.required<number>();
  readonly countFrom = input(0);
  readonly countDecimals = input(0);
  readonly countPrefix = input('');
  readonly countSuffix = input('');
  readonly countGrouping = input(true);

  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);
  private observer?: IntersectionObserver;
  private frame = 0;

  ngOnInit(): void {
    const element = this.element.nativeElement;
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

    if (reduceMotion || !('IntersectionObserver' in window)) {
      element.textContent = this.format(this.appCountUp());
      return;
    }

    element.textContent = this.format(this.countFrom());
    this.observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        this.animate();
        this.observer?.disconnect();
      }
    }, { threshold: 0.4 });
    this.observer.observe(element);
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
    cancelAnimationFrame(this.frame);
  }

  private animate(): void {
    const from = this.countFrom();
    const to = this.appCountUp();
    const duration = 1600;
    const start = performance.now();

    const step = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      this.element.nativeElement.textContent = this.format(from + (to - from) * eased);
      if (progress < 1) {
        this.frame = requestAnimationFrame(step);
      }
    };
    this.frame = requestAnimationFrame(step);
  }

  private format(value: number): string {
    const decimals = this.countDecimals();
    const text = value.toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
      useGrouping: this.countGrouping(),
    });
    return `${this.countPrefix()}${text}${this.countSuffix()}`;
  }
}
