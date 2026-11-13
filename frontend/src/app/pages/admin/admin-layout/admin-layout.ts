import { Component, OnInit, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AdminService } from '../../../core/services/admin-service';

interface AdminLink {                                      // un lien du menu admin
  label: string;
  path: string;
  icon: 'dashboard' | 'gpu' | 'users' | 'rentals' | 'messages';
}

@Component({
  selector: 'app-admin-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './admin-layout.html',
})
export class AdminLayout implements OnInit {               // cadre commun à toutes les pages admin : menu + page
  protected readonly adminService = inject(AdminService);  // badge des messages non lus

  protected readonly links: AdminLink[] = [
    { label: 'Dashboard', path: '/admin', icon: 'dashboard' },
    { label: 'GPUs', path: '/admin/gpus', icon: 'gpu' },
    { label: 'Users', path: '/admin/users', icon: 'users' },
    { label: 'Rentals', path: '/admin/rentals', icon: 'rentals' },
    { label: 'Messages', path: '/admin/messages', icon: 'messages' },
  ];

  ngOnInit(): void {
    this.adminService.getStats().subscribe({ error: () => undefined }); // remplit le badge ; une erreur ici n'est pas bloquante
  }
}
