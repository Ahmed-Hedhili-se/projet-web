import { DatePipe } from '@angular/common';
import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { getErrorMessage } from '../../../core/models/api-error';
import { ContactMessage } from '../../../core/models/contact';
import { AdminService } from '../../../core/services/admin-service';
import { Alert } from '../../../shared/components/alert/alert';
import { ConfirmDialog } from '../../../shared/components/confirm-dialog/confirm-dialog';
import { SplitText } from '../../../shared/components/split-text/split-text';
import { timeAgo } from '../../../shared/utils/date-time';

type ReadFilter = 'ALL' | 'UNREAD' | 'READ';

@Component({
  selector: 'app-admin-messages-page',
  imports: [DatePipe, Alert, ConfirmDialog, SplitText],
  templateUrl: './admin-messages-page.html',
})
export class AdminMessagesPage implements OnInit {
  private readonly adminService = inject(AdminService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly messages = signal<ContactMessage[]>([]);
  protected readonly loading = signal(true);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly notice = signal<string | null>(null);
  protected readonly actionError = signal<string | null>(null);
  protected readonly search = signal('');
  protected readonly filter = signal<ReadFilter>('ALL');
  protected readonly openId = signal<number | null>(null);
  protected readonly toDelete = signal<ContactMessage | null>(null);
  protected readonly deleting = signal(false);

  protected readonly timeAgo = (date: string) => timeAgo(new Date(date));

  protected readonly unread = computed(
    () => this.messages().filter((message) => !message.isRead).length,
  );

  protected readonly tabs = computed(() => {
    const tabs: { value: ReadFilter; label: string; count: number }[] = [
      { value: 'ALL', label: 'All', count: this.messages().length },
      { value: 'UNREAD', label: 'Unread', count: this.unread() },
      { value: 'READ', label: 'Read', count: this.messages().length - this.unread() },
    ];
    return tabs;
  });

  protected readonly filtered = computed(() => {
    const term = this.search().trim().toLowerCase();
    return this.messages().filter(
      (message) =>
        (this.filter() === 'ALL' ||
          message.isRead === (this.filter() === 'READ') ||
          message.id === this.openId()) &&
        (!term ||
          `${message.name} ${message.email} ${message.subject} ${message.message}`
            .toLowerCase()
            .includes(term)),
    );
  });

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.errorMessage.set(null);
    this.adminService
      .listMessages()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.messages.set(response.messages);
          this.loading.set(false);
        },
        error: (err: unknown) => {
          this.errorMessage.set(getErrorMessage(err));
          this.loading.set(false);
        },
      });
  }

  protected toggle(message: ContactMessage): void {
    if (this.openId() === message.id) {
      this.openId.set(null);
      return;
    }
    this.openId.set(message.id);
    if (!message.isRead) {
      this.setRead(message, true);
    }
  }

  protected setRead(message: ContactMessage, isRead: boolean): void {
    this.adminService
      .setMessageRead(message.id, isRead)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.messages.update((list) =>
            list.map((item) => (item.id === message.id ? response.message : item)),
          );
          this.adminService.unreadMessages.set(this.unread());
          this.actionError.set(null);
        },
        error: (err: unknown) => this.actionError.set(getErrorMessage(err)),
      });
  }

  protected markUnread(message: ContactMessage): void {
    this.openId.set(null);
    this.setRead(message, false);
  }

  protected replyLink(message: ContactMessage): string {
    return `mailto:${message.email}?subject=${encodeURIComponent('Re: ' + message.subject)}`;
  }

  protected confirmDelete(): void {
    const message = this.toDelete();
    if (!message) {
      return;
    }
    this.deleting.set(true);
    this.adminService
      .deleteMessage(message.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.messages.update((list) => list.filter((item) => item.id !== message.id));
          this.adminService.unreadMessages.set(this.unread());
          this.notice.set(`The message from ${message.name} was deleted.`);
          this.actionError.set(null);
          this.deleting.set(false);
          this.toDelete.set(null);
        },
        error: (err: unknown) => {
          this.notice.set(null);
          this.actionError.set(getErrorMessage(err));
          this.deleting.set(false);
          this.toDelete.set(null);
        },
      });
  }
}
