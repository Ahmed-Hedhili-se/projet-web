import { Component, ElementRef, computed, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../core/services/auth-service';

interface NavLink {
  // un lien de la barre de navigation
  label: string; // texte affiché
  path: string; // route Angular
}

@Component({
  selector: 'app-navbar',
  imports: [RouterLink, RouterLinkActive], // directives utilisées dans le template
  templateUrl: './navbar.html',
  host: {
    '(document:click)': 'onDocumentClick($event)', // clic n'importe où dans la page
    '(document:keydown.escape)': 'closeUserMenu()', // touche Échap
  },
})
export class Navbar {
  protected readonly authService = inject(AuthService); // utilisé dans le template (connecté ou non)
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly links: NavLink[] = [
    // liens principaux, dans l'ordre d'affichage
    { label: 'Home', path: '/' },
    { label: 'GPUs', path: '/gpus' },
    { label: 'Recommendation', path: '/recommend' },
    { label: 'About', path: '/about' },
    { label: 'Contact', path: '/contact' },
  ];

  protected readonly accountLinks = computed<NavLink[]>(() => [
    // liens du menu utilisateur
    { label: 'My rentals', path: '/account/rentals' },
    { label: 'Profile', path: '/account/profile' },
    ...(this.authService.isAdmin() ? [{ label: 'Admin dashboard', path: '/admin' }] : []), // seulement pour un admin
  ]);

  protected readonly initials = computed(() => {
    // ex. Jane Doe → « JD »
    const user = this.authService.currentUser();
    return user ? `${user.firstName[0] ?? ''}${user.lastName[0] ?? ''}`.toUpperCase() : '';
  });

  protected readonly menuOpen = signal(false); // menu mobile ouvert ou fermé
  protected readonly userMenuOpen = signal(false); // menu utilisateur ouvert ou fermé

  protected toggleMenu(): void {
    this.menuOpen.update((open) => !open); // inverse l'état du menu
  }

  protected closeMenu(): void {
    this.menuOpen.set(false); // ferme le menu (après un clic sur un lien)
  }

  protected toggleUserMenu(): void {
    this.userMenuOpen.update((open) => !open);
  }

  protected closeUserMenu(): void {
    this.userMenuOpen.set(false);
  }

  protected signOut(): void {
    this.closeUserMenu();
    this.closeMenu();
    this.authService.logout(); // oublie le token et revient à l'accueil
  }

  protected onDocumentClick(event: MouseEvent): void {
    // ferme le menu utilisateur si on clique en dehors
    if (
      this.userMenuOpen() &&
      !this.element.nativeElement.querySelector('#user-menu-area')?.contains(event.target as Node)
    ) {
      this.closeUserMenu();
    }
  }
}
