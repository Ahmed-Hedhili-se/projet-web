import { Component, afterNextRender, inject, input } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { SmoothScroll } from '../../../core/services/smooth-scroll';
import { SplitText } from '../split-text/split-text';

export interface LegalSection {
  id: string; // identifiant de la section, utilisé dans l'URL (#terms) et le sommaire
  title: string;
  paragraphs: string[]; // paragraphes de texte
  items?: string[]; // liste à puces facultative, affichée après les paragraphes
}

@Component({
  selector: 'app-legal-document',
  imports: [RouterLink, SplitText],
  templateUrl: './legal-document.html',
})
export class LegalDocument {
  // mise en page commune des pages légales : en-tête, sommaire cliquable et une carte par section
  readonly eyebrow = input.required<string>(); // petit titre au-dessus du titre principal
  readonly title = input.required<string>();
  readonly intro = input.required<string>();
  readonly updated = input.required<string>(); // date de dernière mise à jour affichée sous l'introduction
  readonly sections = input.required<LegalSection[]>(); // contenu de la page

  private readonly router = inject(Router);
  private readonly smoothScroll = inject(SmoothScroll);

  constructor() {
    afterNextRender(() => {
      // page ouverte avec un lien vers une section (ex. /legal#terms depuis l'inscription)
      const id = window.location.hash.slice(1);
      const target = id ? document.getElementById(id) : null;
      if (target) {
        setTimeout(() => this.smoothScroll.showTopOf(target), 300); // laisse le temps à la page de s'afficher
      }
    });
  }

  protected sectionLink(id: string): string {
    // adresse d'une section, ex. /privacy#rights (copiable, ouvrable dans un nouvel onglet)
    return `${this.router.url.split('#')[0]}#${id}`;
  }

  protected goTo(event: Event, id: string): void {
    // clic dans le sommaire : défilement adouci jusqu'à la section, sans recharger la page
    const target = document.getElementById(id);
    if (!target) {
      return;
    }
    event.preventDefault();
    this.smoothScroll.showTopOf(target);
    target.focus({ preventScroll: true }); // le lecteur d'écran annonce la section atteinte
  }
}
