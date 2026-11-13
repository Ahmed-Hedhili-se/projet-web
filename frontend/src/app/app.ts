import { Component, afterNextRender, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SmoothScroll } from './core/services/smooth-scroll';
import { Footer } from './layout/footer/footer';
import { Navbar } from './layout/navbar/navbar';
import { SiteBackground } from './layout/site-background/site-background';

@Component({
  imports: [RouterOutlet, Navbar, Footer, SiteBackground], // composants utilisés dans le layout
  selector: 'app-root',
  styleUrl: './app.css',
  templateUrl: './app.html',
})
export class App {                                         // composant racine : layout commun à toutes les pages
  private readonly smoothScroll = inject(SmoothScroll);

  constructor() {
    afterNextRender(() => void this.smoothScroll.start()); // défilement adouci, une fois la page affichée
  }
}
