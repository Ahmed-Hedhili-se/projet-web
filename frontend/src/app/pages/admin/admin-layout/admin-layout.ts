import { Component, OnInit, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AdminService } from '../../../core/services/admin-service';

interface AdminLink {
  label: string;
  path: string;
  icon: 'dashboard' | 'gpu' | 'users' | 'rentals' | 'messages';
}

@Component({
  selector: 'app-admin-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './admin-layout.html',
})
export class AdminLayout implements OnInit {
  protected readonly adminService = inject(AdminService);

  protected readonly links: AdminLink[] = [
    { label: 'Dashboard', path: '/admin', icon: 'dashboard' },
    { label: 'GPUs', path: '/admin/gpus', icon: 'gpu' },
    { label: 'Users', path: '/admin/users', icon: 'users' },
    { label: 'Rentals', path: '/admin/rentals', icon: 'rentals' },
    { label: 'Messages', path: '/admin/messages', icon: 'messages' },
  ];

  ngOnInit(): void {
    this.adminService.getStats().subscribe({ error: () => undefined });
  }
}
