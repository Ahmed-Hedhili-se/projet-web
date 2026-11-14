import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, DestroyRef, OnInit, computed, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AdminRental } from '../../../core/models/admin';
import { getErrorMessage } from '../../../core/models/api-error';
import { RentalStatus } from '../../../core/models/rental';
import { AdminService } from '../../../core/services/admin-service';
import { Alert } from '../../../shared/components/alert/alert';
import { ConfirmDialog } from '../../../shared/components/confirm-dialog/confirm-dialog';
import { SplitText } from '../../../shared/components/split-text/split-text';
import { StatusBadge } from '../../../shared/components/status-badge/status-badge';
import { Reveal } from '../../../shared/directives/reveal';
import { downloadCsv } from '../../../shared/utils/csv';
import { formatDuration } from '../../../shared/utils/date-time';

type StatusFilter = 'ALL' | RentalStatus;
type View = 'list' | 'planning';

interface PlanningBar {
  rental: AdminRental;
  left: number;
  width: number;
  lane: number;
  label: string;
}

interface PlanningRow {
  gpuId: number;
  name: string;
  lanes: number;
  bars: PlanningBar[];
}

const DAY_MS = 24 * 60 * 60 * 1000;
const PLANNING_DAYS = 14;
const LANE_HEIGHT = 30;

function startOfPlanning(): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today.getTime() - 7 * DAY_MS;
}

@Component({
  selector: 'app-admin-rentals-page',
  imports: [CurrencyPipe, DatePipe, Alert, ConfirmDialog, SplitText, StatusBadge, Reveal],
  templateUrl: './admin-rentals-page.html',
})
export class AdminRentalsPage implements OnInit {
  readonly userId = input<string>();
  readonly gpuId = input<string>();

  private readonly adminService = inject(AdminService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly rentals = signal<AdminRental[]>([]);
  protected readonly loading = signal(true);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly notice = signal<string | null>(null);
  protected readonly actionError = signal<string | null>(null);

  protected readonly view = signal<View>('list');
  protected readonly statusFilter = signal<StatusFilter>('ALL');
  protected readonly userFilter = signal<number | null>(null);
  protected readonly gpuFilter = signal<number | null>(null);
  protected readonly toCancel = signal<AdminRental | null>(null);
  protected readonly cancelling = signal(false);
  protected readonly selectedId = signal<number | null>(null);
  protected readonly windowStart = signal(startOfPlanning());

  protected readonly formatDuration = formatDuration;
  protected readonly laneHeight = LANE_HEIGHT;
  protected readonly planningDays = PLANNING_DAYS;

  protected readonly userOptions = computed(() => {
    const users = new Map(this.rentals().map((rental) => [rental.user.id, `${rental.user.firstName} ${rental.user.lastName}`]));
    return [...users].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  });

  protected readonly gpuOptions = computed(() => {
    const gpus = new Map(this.rentals().map((rental) => [rental.gpu.id, rental.gpu.name]));
    return [...gpus].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  });

  protected readonly scoped = computed(() =>
    this.rentals().filter(
      (rental) =>
        (this.userFilter() === null || rental.user.id === this.userFilter()) &&
        (this.gpuFilter() === null || rental.gpu.id === this.gpuFilter()),
    ),
  );

  protected readonly filtered = computed(() =>
    this.scoped().filter((rental) => this.statusFilter() === 'ALL' || rental.status === this.statusFilter()),
  );

  protected readonly tabs = computed(() => {
    const count = (status: RentalStatus) => this.scoped().filter((rental) => rental.status === status).length;
    const tabs: { value: StatusFilter; label: string; count: number }[] = [
      { value: 'ALL', label: 'All', count: this.scoped().length },
      { value: 'UPCOMING', label: 'Upcoming', count: count('UPCOMING') },
      { value: 'ACTIVE', label: 'Active', count: count('ACTIVE') },
      { value: 'COMPLETED', label: 'Completed', count: count('COMPLETED') },
      { value: 'CANCELLED', label: 'Cancelled', count: count('CANCELLED') },
    ];
    return tabs;
  });

  protected readonly revenue = computed(() =>
    this.filtered().filter((rental) => rental.status !== 'CANCELLED').reduce((sum, rental) => sum + rental.totalPrice, 0),
  );

  protected readonly windowEnd = computed(() => this.windowStart() + (PLANNING_DAYS - 1) * DAY_MS);

  protected readonly days = computed(() => {
    const today = new Date().toDateString();
    return Array.from({ length: PLANNING_DAYS }, (_, index) => {
      const date = new Date(this.windowStart() + index * DAY_MS);
      return { weekday: date.toLocaleDateString('en-US', { weekday: 'short' }), day: date.getDate(), isToday: date.toDateString() === today };
    });
  });

  protected readonly todayPercent = computed(() => {
    const percent = ((Date.now() - this.windowStart()) / (PLANNING_DAYS * DAY_MS)) * 100;
    return percent >= 0 && percent <= 100 ? percent : null;
  });

  protected readonly planning = computed<PlanningRow[]>(() => {
    const start = this.windowStart();
    const span = PLANNING_DAYS * DAY_MS;
    const rows = new Map<number, PlanningRow & { laneEnds: number[] }>();
    const visible = this.scoped()
      .filter((rental) => rental.status !== 'CANCELLED')
      .filter((rental) => Date.parse(rental.endDate) > start && Date.parse(rental.startDate) < start + span)
      .sort((a, b) => Date.parse(a.startDate) - Date.parse(b.startDate));

    for (const rental of visible) {
      const from = Date.parse(rental.startDate);
      const to = Date.parse(rental.endDate);
      const row = rows.get(rental.gpu.id) ?? { gpuId: rental.gpu.id, name: rental.gpu.name, lanes: 0, bars: [], laneEnds: [] };
      let lane = row.laneEnds.findIndex((end) => end <= from);
      if (lane === -1) {
        lane = row.laneEnds.length;
      }
      row.laneEnds[lane] = to;
      row.lanes = row.laneEnds.length;
      const left = Math.max(0, ((from - start) / span) * 100);
      const right = Math.min(100, ((to - start) / span) * 100);
      row.bars.push({ rental, left, width: right - left, lane, label: `${rental.user.firstName} ${rental.user.lastName.charAt(0)}. ×${rental.quantity}` });
      rows.set(rental.gpu.id, row);
    }
    return [...rows.values()].sort((a, b) => a.name.localeCompare(b.name));
  });

  protected readonly selected = computed(() => this.rentals().find((rental) => rental.id === this.selectedId()) ?? null);

  ngOnInit(): void {
    if (this.userId()) {
      this.userFilter.set(Number(this.userId()));
    }
    if (this.gpuId()) {
      this.gpuFilter.set(Number(this.gpuId()));
    }
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.errorMessage.set(null);
    this.adminService
      .listRentals()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.rentals.set(response.rentals);
          this.loading.set(false);
        },
        error: (err: unknown) => {
          this.errorMessage.set(getErrorMessage(err));
          this.loading.set(false);
        },
      });
  }

  protected pickFilter(filter: 'user' | 'gpu', value: string): void {
    const id = value === '' ? null : Number(value);
    if (filter === 'user') {
      this.userFilter.set(id);
    } else {
      this.gpuFilter.set(id);
    }
  }

  protected clearFilters(): void {
    this.userFilter.set(null);
    this.gpuFilter.set(null);
    this.statusFilter.set('ALL');
  }

  protected shiftWindow(days: number): void {
    this.windowStart.update((start) => start + days * DAY_MS);
  }

  protected resetWindow(): void {
    this.windowStart.set(startOfPlanning());
  }

  protected canCancel(rental: AdminRental): boolean {
    return rental.status === 'UPCOMING' || rental.status === 'ACTIVE';
  }

  protected confirmCancel(): void {
    const rental = this.toCancel();
    if (!rental) {
      return;
    }
    this.cancelling.set(true);
    this.adminService
      .cancelRental(rental.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.rentals.update((list) => list.map((item) => (item.id === rental.id ? response.rental : item)));
          this.notice.set(`Rental #${rental.id} of ${rental.user.firstName} ${rental.user.lastName} was cancelled.`);
          this.actionError.set(null);
          this.cancelling.set(false);
          this.toCancel.set(null);
        },
        error: (err: unknown) => {
          this.notice.set(null);
          this.actionError.set(getErrorMessage(err));
          this.cancelling.set(false);
          this.toCancel.set(null);
        },
      });
  }

  protected exportCsv(): void {
    downloadCsv('teramind-rentals.csv', [
      ['ID', 'Customer', 'Email', 'GPU', 'Units', 'Start', 'End', 'Duration (h)', 'Total (USD)', 'Status'],
      ...this.filtered().map((rental) => [
        rental.id, `${rental.user.firstName} ${rental.user.lastName}`, rental.user.email, rental.gpu.name, rental.quantity,
        rental.startDate, rental.endDate, rental.durationHours, rental.totalPrice, rental.status,
      ]),
    ]);
  }
}
