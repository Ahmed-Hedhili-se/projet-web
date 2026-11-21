import { Component, computed, input } from '@angular/core';

@Component({
  selector: 'app-split-text',
  templateUrl: './split-text.html',
})
export class SplitText {
  readonly text = input.required<string>();
  readonly highlight = input('');
  readonly delay = input(0);
  readonly stagger = input(70);

  protected readonly words = computed(() => {
    const highlighted = this.highlight()
      .split(' ')
      .filter((word) => word !== '');
    return this.text()
      .split(' ')
      .map((word) => ({ word, highlighted: highlighted.includes(word) }));
  });
}
