import { Component, afterNextRender, inject, input } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { SmoothScroll } from '../../../core/services/smooth-scroll';
import { SplitText } from '../split-text/split-text';

export interface LegalSection {
  id: string;
  title: string;
  paragraphs: string[];
  items?: string[];
}

@Component({
  selector: 'app-legal-document',
  imports: [RouterLink, SplitText],
  templateUrl: './legal-document.html',
})
export class LegalDocument {
  readonly eyebrow = input.required<string>();
  readonly title = input.required<string>();
  readonly intro = input.required<string>();
  readonly updated = input.required<string>();
  readonly sections = input.required<LegalSection[]>();

  private readonly router = inject(Router);
  private readonly smoothScroll = inject(SmoothScroll);

  constructor() {
    afterNextRender(() => {
      const id = window.location.hash.slice(1);
      const target = id ? document.getElementById(id) : null;
      if (target) {
        setTimeout(() => this.smoothScroll.showTopOf(target), 300);
      }
    });
  }

  protected sectionLink(id: string): string {
    return `${this.router.url.split('#')[0]}#${id}`;
  }

  protected goTo(event: Event, id: string): void {
    const target = document.getElementById(id);
    if (!target) {
      return;
    }
    event.preventDefault();
    this.smoothScroll.showTopOf(target);
    target.focus({ preventScroll: true });
  }
}
