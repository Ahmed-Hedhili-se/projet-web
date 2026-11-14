import { Component, computed, input } from '@angular/core';

@Component({
  selector: 'app-scroll-text',
  templateUrl: './scroll-text.html',
})
export class ScrollText {
  readonly text = input.required<string>();

  protected readonly words = computed(() => {
    const words = this.text().split(' ');
    return words.map((word, index) => {
      const start = 18 + (index / words.length) * 34;
      return { word, start: `${start}%`, end: `${start + 12}%` };
    });
  });
}
