import { DatePipe } from '@angular/common';
import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { AdminUser, UserChanges } from '../../../core/models/admin';
import { getErrorCode, getErrorMessage } from '../../../core/models/api-error';
import { Role } from '../../../core/models/user';
import { AdminService } from '../../../core/services/admin-service';
import { AuthService } from '../../../core/services/auth-service';
import { Alert } from '../../../shared/components/alert/alert';
import { ConfirmDialog } from '../../../shared/components/confirm-dialog/confirm-dialog';
import { SplitText } from '../../../shared/components/split-text/split-text';
import { Reveal } from '../../../shared/directives/reveal';
import { downloadCsv } from '../../../shared/utils/csv';

type RoleFilter = 'ALL' | Role;
type AccessFilter = 'ALL' | 'ACTIVE' | 'BLOCKED';

interface PendingChange {
  user: AdminUser;
  changes: UserChanges;
  title: string;
  message: string;
  confirmLabel: string;
  notice: string;
}

@Component({
  selector: 'app-admin-users-page',
  imports: [RouterLink, DatePipe, Alert, ConfirmDialog, SplitText, Reveal],
  templateUrl: './admin-users-page.html',
})
export class AdminUsersPage implements OnInit {
  private readonly adminService = inject(AdminService);
  private readonly authService = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly users = signal<AdminUser[]>([]);
  protected readonly loading = signal(true);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly notice = signal<string | null>(null);
  protected readonly actionError = signal<string | null>(null);
  protected readonly search = signal('');
  protected readonly roleFilter = signal<RoleFilter>('ALL');
  protected readonly accessFilter = signal<AccessFilter>('ALL');
  protected readonly pending = signal<PendingChange | null>(null);
  protected readonly saving = signal(false);

  protected readonly roleOptions: { value: RoleFilter; label: string }[] = [
    { value: 'ALL', label: 'All roles' },
    { value: 'USER', label: 'Users' },
    { value: 'ADMIN', label: 'Admins' },
  ];
  protected readonly accessOptions: { value: AccessFilter; label: string }[] = [
    { value: 'ALL', label: 'All' },
    { value: 'ACTIVE', label: 'Active' },
    { value: 'BLOCKED', label: 'Blocked' },
  ];

  protected readonly currentUserId = computed(() => this.authService.currentUser()?.id ?? null);

  protected readonly filtered = computed(() => {
    const term = this.search().trim().toLowerCase();
    return this.users().filter(
      (user) =>
        (this.roleFilter() === 'ALL' || user.role === this.roleFilter()) &&
        (this.accessFilter() === 'ALL' || user.isBlocked === (this.accessFilter() === 'BLOCKED')) &&
        (!term || `${user.firstName} ${user.lastName} ${user.email}`.toLowerCase().includes(term)),
    );
  });

  protected readonly summary = computed(() => [
    { label: 'Accounts', value: this.users().length },
    { label: 'Admins', value: this.users().filter((user) => user.role === 'ADMIN').length },
    { label: 'Blocked', value: this.users().filter((user) => user.isBlocked).length },
  ]);

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.errorMessage.set(null);
    this.adminService
      .listUsers()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.users.set(response.users);
          this.loading.set(false);
        },
        error: (err: unknown) => {
          this.errorMessage.set(getErrorMessage(err));
          this.loading.set(false);
        },
      });
  }

  protected initials(user: AdminUser): string {
    return (user.firstName.charAt(0) + user.lastName.charAt(0)).toUpperCase();
  }

  protected askRole(user: AdminUser): void {
    const name = `${user.firstName} ${user.lastName}`;
    const toAdmin = user.role === 'USER';
    this.pending.set({
      user,
      changes: { role: toAdmin ? 'ADMIN' : 'USER' },
      title: toAdmin ? 'Make this user an admin?' : 'Remove admin rights?',
      message: toAdmin
        ? `${name} will be able to manage GPUs, users, rentals and messages.`
        : `${name} will keep their account and rentals but lose access to the admin area.`,
      confirmLabel: toAdmin ? 'Make admin' : 'Remove admin',
      notice: toAdmin ? `${name} is now an admin.` : `${name} is no longer an admin.`,
    });
  }

  protected askBlock(user: AdminUser): void {
    const name = `${user.firstName} ${user.lastName}`;
    const block = !user.isBlocked;
    this.pending.set({
      user,
      changes: { isBlocked: block },
      title: block ? 'Block this account?' : 'Unblock this account?',
      message: block
        ? `${name} will no longer be able to sign in or rent GPUs. Existing rentals are kept.`
        : `${name} will be able to sign in and rent GPUs again.`,
      confirmLabel: block ? 'Block account' : 'Unblock account',
      notice: block ? `${name} was blocked.` : `${name} was unblocked.`,
    });
  }

  protected confirm(): void {
    const change = this.pending();
    if (!change) {
      return;
    }
    this.saving.set(true);
    this.adminService
      .updateUser(change.user.id, change.changes)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          const saved: AdminUser = { ...response.user, rentalCount: change.user.rentalCount };
          this.users.update((list) => list.map((user) => (user.id === saved.id ? saved : user)));
          this.notice.set(change.notice);
          this.actionError.set(null);
          this.saving.set(false);
          this.pending.set(null);
        },
        error: (err: unknown) => {
          this.notice.set(null);
          this.actionError.set(
            getErrorCode(err) === 'CANNOT_MODIFY_SELF'
              ? 'You cannot change your own role or block yourself.'
              : getErrorMessage(err),
          );
          this.saving.set(false);
          this.pending.set(null);
        },
      });
  }

  protected exportCsv(): void {
    downloadCsv('teramind-users.csv', [
      ['ID', 'First name', 'Last name', 'Email', 'Role', 'Status', 'Rentals', 'Joined'],
      ...this.filtered().map((user) => [
        user.id,
        user.firstName,
        user.lastName,
        user.email,
        user.role,
        user.isBlocked ? 'Blocked' : 'Active',
        user.rentalCount,
        user.createdAt.slice(0, 10),
      ]),
    ]);
  }
}
