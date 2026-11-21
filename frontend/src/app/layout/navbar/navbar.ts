import { Component, ElementRef, computed, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../core/services/auth-service';

interface NavLink {
  label: string;
  path: string;
}

@Component({
  selector: 'app-navbar',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './navbar.html',
  host: {
    '(document:click)': 'onDocumentClick($event)',
    '(document:keydown.escape)': 'closeUserMenu()',
  },
})
export class Navbar {
  protected readonly authService = inject(AuthService);
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly links: NavLink[] = [
    { label: 'Home', path: '/' },
    { label: 'GPUs', path: '/gpus' },
    { label: 'Recommendation', path: '/recommend' },
    { label: 'About', path: '/about' },
    { label: 'Contact', path: '/contact' },
  ];

  protected readonly accountLinks = computed<NavLink[]>(() => [
    { label: 'My rentals', path: '/account/rentals' },
    { label: 'Profile', path: '/account/profile' },
    ...(this.authService.isAdmin() ? [{ label: 'Admin dashboard', path: '/admin' }] : []),
  ]);

  protected readonly initials = computed(() => {
    const user = this.authService.currentUser();
    return user ? `${user.firstName[0] ?? ''}${user.lastName[0] ?? ''}`.toUpperCase() : '';
  });

  protected readonly menuOpen = signal(false);
  protected readonly userMenuOpen = signal(false);

  protected toggleMenu(): void {
    this.menuOpen.update((open) => !open);
  }

  protected closeMenu(): void {
    this.menuOpen.set(false);
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
    this.authService.logout();
  }

  protected onDocumentClick(event: MouseEvent): void {
    if (
      this.userMenuOpen() &&
      !this.element.nativeElement.querySelector('#user-menu-area')?.contains(event.target as Node)
    ) {
      this.closeUserMenu();
    }
  }
}
