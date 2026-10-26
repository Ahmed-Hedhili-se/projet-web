import { Component, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

interface NavLink {                                        // un lien de la barre de navigation
  label: string;                                           // texte affiché
  path: string;                                            // route Angular
}

@Component({
  selector: 'app-navbar',
  imports: [RouterLink, RouterLinkActive],                 // directives utilisées dans le template
  templateUrl: './navbar.html',
})
export class Navbar {
  protected readonly links: NavLink[] = [                  // liens principaux, dans l'ordre d'affichage
    { label: 'Home', path: '/' },
    { label: 'GPUs', path: '/gpus' },
    { label: 'Recommendation', path: '/recommend' },
    { label: 'About', path: '/about' },
    { label: 'Contact', path: '/contact' },
  ];

  protected readonly menuOpen = signal(false);             // menu mobile ouvert ou fermé

  protected toggleMenu(): void {
    this.menuOpen.update((open) => !open);                 // inverse l'état du menu
  }

  protected closeMenu(): void {
    this.menuOpen.set(false);                              // ferme le menu (après un clic sur un lien)
  }
}
