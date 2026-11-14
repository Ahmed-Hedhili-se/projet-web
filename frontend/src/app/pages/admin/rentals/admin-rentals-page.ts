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

interface PlanningBar {                                    // une location dessinée sur le planning
  rental: AdminRental;
  left: number;                                            // position du début, en % de la largeur
  width: number;                                           // longueur, en %
  lane: number;                                            // ligne dans la rangée du GPU (les locations qui se chevauchent sont empilées)
  label: string;
}

interface PlanningRow {                                    // une rangée du planning = un GPU
  gpuId: number;
  name: string;
  lanes: number;
  bars: PlanningBar[];
}

const DAY_MS = 24 * 60 * 60 * 1000;
const PLANNING_DAYS = 14;                                  // le planning montre deux semaines
const LANE_HEIGHT = 30;                                    // hauteur d'une ligne de barres (px)

function startOfPlanning(): number {                       // par défaut : de 7 jours avant aujourd'hui à 7 jours après
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
  readonly userId = input<string>();                       // ?userId=3 (lien depuis la page Users) : filtre déjà choisi
  readonly gpuId = input<string>();                        // ?gpuId=1

  private readonly adminService = inject(AdminService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly rentals = signal<AdminRental[]>([]);
  protected readonly loading = signal(true);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly notice = signal<string | null>(null); // message de succès en haut de la liste
  protected readonly actionError = signal<string | null>(null); // erreur d'une annulation (la liste reste affichée)

  protected readonly view = signal<View>('list');
  protected readonly statusFilter = signal<StatusFilter>('ALL');
  protected readonly userFilter = signal<number | null>(null);
  protected readonly gpuFilter = signal<number | null>(null);
  protected readonly toCancel = signal<AdminRental | null>(null);
  protected readonly cancelling = signal(false);
  protected readonly selectedId = signal<number | null>(null); // barre du planning sélectionnée
  protected readonly windowStart = signal(startOfPlanning()); // premier jour affiché dans le planning (ms)

  protected readonly formatDuration = formatDuration;
  protected readonly laneHeight = LANE_HEIGHT;
  protected readonly planningDays = PLANNING_DAYS;

  protected readonly userOptions = computed(() => {        // clients présents dans les locations, triés par nom
    const users = new Map(this.rentals().map((rental) => [rental.user.id, `${rental.user.firstName} ${rental.user.lastName}`]));
    return [...users].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  });

  protected readonly gpuOptions = computed(() => {         // GPU présents dans les locations, triés par nom
    const gpus = new Map(this.rentals().map((rental) => [rental.gpu.id, rental.gpu.name]));
    return [...gpus].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  });

  protected readonly scoped = computed(() =>               // locations après les filtres client et GPU (avant le statut)
    this.rentals().filter(
      (rental) =>
        (this.userFilter() === null || rental.user.id === this.userFilter()) &&
        (this.gpuFilter() === null || rental.gpu.id === this.gpuFilter()),
    ),
  );

  protected readonly filtered = computed(() =>             // + filtre de statut : ce que montre la liste
    this.scoped().filter((rental) => this.statusFilter() === 'ALL' || rental.status === this.statusFilter()),
  );

  protected readonly tabs = computed(() => {               // onglets de statut, avec le nombre de locations
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

  protected readonly revenue = computed(() =>              // total des locations affichées, sans les annulées
    this.filtered().filter((rental) => rental.status !== 'CANCELLED').reduce((sum, rental) => sum + rental.totalPrice, 0),
  );

  protected readonly windowEnd = computed(() => this.windowStart() + (PLANNING_DAYS - 1) * DAY_MS); // dernier jour affiché

  protected readonly days = computed(() => {               // les 14 colonnes du planning
    const today = new Date().toDateString();
    return Array.from({ length: PLANNING_DAYS }, (_, index) => {
      const date = new Date(this.windowStart() + index * DAY_MS);
      return { weekday: date.toLocaleDateString('en-US', { weekday: 'short' }), day: date.getDate(), isToday: date.toDateString() === today };
    });
  });

  protected readonly todayPercent = computed(() => {       // position du trait « maintenant », ou null s'il est hors de la période
    const percent = ((Date.now() - this.windowStart()) / (PLANNING_DAYS * DAY_MS)) * 100;
    return percent >= 0 && percent <= 100 ? percent : null;
  });

  protected readonly planning = computed<PlanningRow[]>(() => { // une rangée par GPU, avec ses locations placées sur la période
    const start = this.windowStart();
    const span = PLANNING_DAYS * DAY_MS;
    const rows = new Map<number, PlanningRow & { laneEnds: number[] }>();
    const visible = this.scoped()
      .filter((rental) => rental.status !== 'CANCELLED')   // une location annulée ne bloque plus d'unité
      .filter((rental) => Date.parse(rental.endDate) > start && Date.parse(rental.startDate) < start + span)
      .sort((a, b) => Date.parse(a.startDate) - Date.parse(b.startDate));

    for (const rental of visible) {
      const from = Date.parse(rental.startDate);
      const to = Date.parse(rental.endDate);
      const row = rows.get(rental.gpu.id) ?? { gpuId: rental.gpu.id, name: rental.gpu.name, lanes: 0, bars: [], laneEnds: [] };
      let lane = row.laneEnds.findIndex((end) => end <= from); // première ligne libre à cette date
      if (lane === -1) {
        lane = row.laneEnds.length;                        // aucune : on ajoute une ligne
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

  protected pickFilter(filter: 'user' | 'gpu', value: string): void { // listes déroulantes : '' = tous
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

  protected shiftWindow(days: number): void {              // semaine précédente / suivante
    this.windowStart.update((start) => start + days * DAY_MS);
  }

  protected resetWindow(): void {                          // revient autour d'aujourd'hui
    this.windowStart.set(startOfPlanning());
  }

  protected canCancel(rental: AdminRental): boolean {      // règle de docs/API.md : à venir ou en cours
    return rental.status === 'UPCOMING' || rental.status === 'ACTIVE';
  }

  protected confirmCancel(): void {                        // PATCH /admin/rentals/:id/cancel
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
          this.rentals.update((list) => list.map((item) => (item.id === rental.id ? response.rental : item))); // remplace la location annulée
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

  protected exportCsv(): void {                            // les locations affichées, dans un fichier Excel
    downloadCsv('teramind-rentals.csv', [
      ['ID', 'Customer', 'Email', 'GPU', 'Units', 'Start', 'End', 'Duration (h)', 'Total (USD)', 'Status'],
      ...this.filtered().map((rental) => [
        rental.id, `${rental.user.firstName} ${rental.user.lastName}`, rental.user.email, rental.gpu.name, rental.quantity,
        rental.startDate, rental.endDate, rental.durationHours, rental.totalPrice, rental.status,
      ]),
    ]);
  }
}
