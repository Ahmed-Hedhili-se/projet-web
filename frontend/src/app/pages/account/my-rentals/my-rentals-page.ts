import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { getErrorMessage } from '../../../core/models/api-error';
import { Rental, RentalStatus } from '../../../core/models/rental';
import { RentalService } from '../../../core/services/rental-service';
import { Alert } from '../../../shared/components/alert/alert';
import { ConfirmDialog } from '../../../shared/components/confirm-dialog/confirm-dialog';
import { SplitText } from '../../../shared/components/split-text/split-text';
import { StatusBadge } from '../../../shared/components/status-badge/status-badge';
import { CountUp } from '../../../shared/directives/count-up';
import { Reveal } from '../../../shared/directives/reveal';
import { formatDuration, relativeTime } from '../../../shared/utils/date-time';

type Filter = 'ALL' | RentalStatus; // onglet sélectionné

@Component({
  selector: 'app-my-rentals-page',
  imports: [
    RouterLink,
    CurrencyPipe,
    DatePipe,
    Alert,
    ConfirmDialog,
    SplitText,
    StatusBadge,
    CountUp,
    Reveal,
  ],
  templateUrl: './my-rentals-page.html',
})
export class MyRentalsPage implements OnInit {
  private readonly rentalService = inject(RentalService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly formatDuration = formatDuration; // utilisés dans le template
  protected readonly relativeTime = (date: string) => relativeTime(new Date(date));

  protected readonly rentals = signal<Rental[]>([]);
  protected readonly loading = signal(true);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly filter = signal<Filter>('ALL');

  protected readonly toCancel = signal<Rental | null>(null); // location à annuler (fenêtre de confirmation ouverte)
  protected readonly cancelling = signal(false);
  protected readonly cancelError = signal<string | null>(null);

  protected readonly tabs = computed(() => {
    // onglets avec le nombre de locations dans chacun
    const count = (status: RentalStatus) =>
      this.rentals().filter((rental) => rental.status === status).length;
    return [
      { value: 'ALL' as Filter, label: 'All', count: this.rentals().length },
      { value: 'UPCOMING' as Filter, label: 'Upcoming', count: count('UPCOMING') },
      { value: 'ACTIVE' as Filter, label: 'Active', count: count('ACTIVE') },
      { value: 'COMPLETED' as Filter, label: 'Completed', count: count('COMPLETED') },
      { value: 'CANCELLED' as Filter, label: 'Cancelled', count: count('CANCELLED') },
    ];
  });

  protected readonly filtered = computed(() =>
    // locations de l'onglet sélectionné
    this.filter() === 'ALL'
      ? this.rentals()
      : this.rentals().filter((rental) => rental.status === this.filter()),
  );

  protected readonly stats = computed(() => [
    // tuiles du haut (recréées quand une valeur change : chiffres rejoués)
    {
      label: 'Active now',
      value: this.rentals().filter((rental) => rental.status === 'ACTIVE').length,
      decimals: 0,
      prefix: '',
    },
    {
      label: 'Upcoming',
      value: this.rentals().filter((rental) => rental.status === 'UPCOMING').length,
      decimals: 0,
      prefix: '',
    },
    {
      label: 'Total spent',
      value: this.rentals()
        .filter((rental) => rental.status !== 'CANCELLED')
        .reduce((sum, rental) => sum + rental.totalPrice, 0),
      decimals: 2,
      prefix: '$',
    },
  ]);

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.errorMessage.set(null);
    this.rentalService
      .listMine()
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

  protected progress(rental: Rental): number {
    // avancement d'une location en cours, en %
    const start = Date.parse(rental.startDate);
    const end = Date.parse(rental.endDate);
    return Math.min(100, Math.max(0, Math.round(((Date.now() - start) / (end - start)) * 100)));
  }

  protected askCancel(rental: Rental): void {
    this.cancelError.set(null);
    this.toCancel.set(rental); // ouvre la fenêtre de confirmation
  }

  protected confirmCancel(): void {
    const rental = this.toCancel();
    if (!rental) {
      return;
    }
    this.cancelling.set(true);
    this.rentalService
      .cancel(rental.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.rentals.update((list) =>
            list.map((item) => (item.id === rental.id ? response.rental : item)),
          );
          this.cancelling.set(false);
          this.toCancel.set(null);
        },
        error: (err: unknown) => {
          this.cancelError.set(getErrorMessage(err));
          this.cancelling.set(false);
          this.toCancel.set(null);
        },
      });
  }
}
