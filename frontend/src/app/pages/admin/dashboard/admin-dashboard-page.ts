import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { AdminGpu, AdminStats } from '../../../core/models/admin';
import { getErrorMessage } from '../../../core/models/api-error';
import { AdminService } from '../../../core/services/admin-service';
import { AuthService } from '../../../core/services/auth-service';
import { Alert } from '../../../shared/components/alert/alert';
import { SplitText } from '../../../shared/components/split-text/split-text';
import { CountUp } from '../../../shared/directives/count-up';
import { Reveal } from '../../../shared/directives/reveal';
import { Tilt } from '../../../shared/directives/tilt';

type ChartMetric = 'count' | 'revenue'; // mesure affichée dans le graphique (un seul axe à la fois)

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function niceMax(value: number): number {
  // arrondit le haut de l'axe : 13 → 15, 4820 → 5000
  if (value <= 0) {
    return 1;
  }
  const power = 10 ** Math.floor(Math.log10(value));
  return ([1, 2, 2.5, 5, 10].find((step) => step * power >= value) ?? 10) * power;
}

@Component({
  selector: 'app-admin-dashboard-page',
  imports: [RouterLink, CurrencyPipe, DecimalPipe, Alert, SplitText, CountUp, Reveal, Tilt],
  templateUrl: './admin-dashboard-page.html',
})
export class AdminDashboardPage implements OnInit {
  private readonly adminService = inject(AdminService);
  private readonly authService = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly stats = signal<AdminStats | null>(null);
  protected readonly gpus = signal<AdminGpu[]>([]);
  protected readonly loading = signal(true);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly metric = signal<ChartMetric>('count');
  protected readonly metricOptions: { value: ChartMetric; label: string }[] = [
    // boutons de la bascule
    { value: 'count', label: 'Rentals' },
    { value: 'revenue', label: 'Revenue' },
  ];
  protected readonly showTable = signal(false); // tableau à la place du graphique (accessibilité)

  protected readonly greeting = computed(() => {
    // « Good morning, Amira. »
    const hour = new Date().getHours();
    const moment = hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening';
    return `Good ${moment}, ${this.authService.currentUser()?.firstName ?? 'admin'}.`;
  });

  protected readonly chart = computed(() => {
    // données du graphique « par mois »
    const months = this.stats()?.rentalsPerMonth ?? [];
    const metric = this.metric();
    const values = months.map((month) => (metric === 'count' ? month.count : month.revenue));
    const max = niceMax(Math.max(0, ...values));
    const highest = Math.max(...values);
    return {
      max,
      ticks: [max, (max * 3) / 4, max / 2, max / 4, 0], // lignes horizontales de l'axe
      bars: months.map((month, index) => ({
        label: MONTHS[Number(month.month.slice(5, 7)) - 1], // "2026-10" → "Oct"
        year: month.month.slice(0, 4),
        count: month.count,
        revenue: month.revenue,
        value: values[index],
        height: (values[index] / max) * 100, // hauteur en % de la zone du graphique
        isHighest: values[index] === highest && highest > 0, // seule la plus haute porte son étiquette
      })),
    };
  });

  protected readonly occupancy = computed(() => {
    // part des unités louées en ce moment (GPU actifs)
    const active = this.gpus().filter((gpu) => gpu.isActive);
    const total = active.reduce((sum, gpu) => sum + gpu.totalUnits, 0);
    const rented = active.reduce((sum, gpu) => sum + (gpu.totalUnits - gpu.availableUnits), 0);
    const percent = total === 0 ? 0 : Math.round((rented / total) * 100);
    return { total, rented, percent, offset: 327 - (327 * percent) / 100 }; // offset : longueur du cercle non remplie
  });

  protected readonly statusRows = computed(() => {
    // locations par statut, en barres horizontales
    const rentals = this.stats()?.rentals;
    if (!rentals) {
      return [];
    }
    const total = Math.max(1, rentals.total);
    return [
      { label: 'Active', value: rentals.active },
      { label: 'Upcoming', value: rentals.upcoming },
      { label: 'Completed', value: rentals.completed },
      { label: 'Cancelled', value: rentals.cancelled },
    ].map((row) => ({ ...row, percent: (row.value / total) * 100 }));
  });

  protected readonly topRevenueMax = computed(() =>
    Math.max(1, ...(this.stats()?.topGpus ?? []).map((gpu) => gpu.revenue)),
  );

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.errorMessage.set(null);
    forkJoin({ stats: this.adminService.getStats(), gpus: this.adminService.listGpus() }) // les deux requêtes en parallèle
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ stats, gpus }) => {
          this.stats.set(stats);
          this.gpus.set(gpus.gpus);
          this.loading.set(false);
        },
        error: (err: unknown) => {
          this.errorMessage.set(getErrorMessage(err));
          this.loading.set(false);
        },
      });
  }
}
