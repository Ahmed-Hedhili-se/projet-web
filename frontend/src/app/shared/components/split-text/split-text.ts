import { Component, computed, input } from '@angular/core';

@Component({
  selector: 'app-split-text',                              // usage : <h1><app-split-text text="Find your GPU." /></h1>
  templateUrl: './split-text.html',
})
export class SplitText {                                   // affiche un texte mot par mot, chaque mot sortant du flou
  readonly text = input.required<string>();
  readonly delay = input(0);                               // délai avant le premier mot (ms)
  readonly stagger = input(70);                            // délai entre deux mots (ms)

  protected readonly words = computed(() => this.text().split(' ')); // « Find your GPU. » → ["Find", "your", "GPU."]
}
