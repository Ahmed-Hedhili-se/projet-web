import { Component, computed, input } from '@angular/core';

@Component({
  selector: 'app-scroll-text',                             // usage : <p><app-scroll-text text="..." /></p>
  templateUrl: './scroll-text.html',
})
export class ScrollText {                                  // les mots s'éclairent un à un pendant le défilement (CSS .scroll-word)
  readonly text = input.required<string>();

  protected readonly words = computed(() => {
    const words = this.text().split(' ');
    return words.map((word, index) => {
      const start = 20 + (index / words.length) * 40;      // le 1er mot s'éclaire à 20 % du défilement, le dernier vers 60 %
      return { word, start: `${start}%`, end: `${start + 6}%` };
    });
  });
}
