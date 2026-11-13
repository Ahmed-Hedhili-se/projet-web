import { Component, computed, input } from '@angular/core';

@Component({
  selector: 'app-split-text',                              // usage : <h1><app-split-text text="Find your GPU." highlight="GPU." /></h1>
  templateUrl: './split-text.html',
})
export class SplitText {                                   // affiche un texte mot par mot, chaque mot sortant du flou
  readonly text = input.required<string>();
  readonly highlight = input('');                          // mot(s) à mettre à la couleur Aurore, séparés par des espaces
  readonly delay = input(0);                               // délai avant le premier mot (ms)
  readonly stagger = input(70);                            // délai entre deux mots (ms)

  protected readonly words = computed(() => {              // « Find your GPU. » → [{ word: 'Find' }, …, { word: 'GPU.', highlighted: true }]
    const highlighted = this.highlight().split(' ').filter((word) => word !== '');
    return this.text().split(' ').map((word) => ({ word, highlighted: highlighted.includes(word) }));
  });
}
