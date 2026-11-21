import { Component, computed, input } from '@angular/core';

@Component({
  selector: 'app-scroll-text', // usage : <p><app-scroll-text text="..." /></p>
  templateUrl: './scroll-text.html',
})
export class ScrollText {
  // les mots apparaissent un à un pendant le défilement : flous → nets en couleur Aurore → blancs (CSS .scroll-word)
  readonly text = input.required<string>();

  protected readonly words = computed(() => {
    const words = this.text().split(' ');
    return words.map((word, index) => {
      const start = 18 + (index / words.length) * 34; // le 1er mot arrive à 18 % du défilement, le dernier vers 52 %
      return { word, start: `${start}%`, end: `${start + 12}%` };
    });
  });
}
