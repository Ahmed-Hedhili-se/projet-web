import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, DestroyRef, OnInit, computed, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { catchError, debounceTime, distinctUntilChanged, map, of, startWith, switchMap, tap } from 'rxjs';
import { getErrorCode, getErrorMessage } from '../../../core/models/api-error';
import { Gpu } from '../../../core/models/gpu';
import { Rental } from '../../../core/models/rental';
import { GpuService } from '../../../core/services/gpu-service';
import { RentalService } from '../../../core/services/rental-service';
import { Alert } from '../../../shared/components/alert/alert';
import { SplitText } from '../../../shared/components/split-text/split-text';
import { formatDuration, nextFullHour, toDateTimeLocal } from '../../../shared/utils/date-time';

const HOUR_MS = 60 * 60 * 1000;

@Component({
  selector: 'app-new-rental-page',
  imports: [ReactiveFormsModule, RouterLink, CurrencyPipe, DatePipe, Alert, SplitText],
  templateUrl: './new-rental-page.html',
})
export class NewRentalPage implements OnInit {
  readonly gpuId = input<string>();                        // ?gpuId=… (lien « Rent this GPU »)

  private readonly gpuService = inject(GpuService);
  private readonly rentalService = inject(RentalService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly durationPresets = [1, 8, 24, 72, 168]; // durées proposées, en heures
  protected readonly formatDuration = formatDuration;      // utilisé dans le template
  protected readonly minStartDate = toDateTimeLocal(new Date()); // pas de date passée

  protected readonly form = new FormGroup({
    gpuId: new FormControl<number | null>(null, [Validators.required]),
    quantity: new FormControl(1, { nonNullable: true, validators: [Validators.required, Validators.min(1)] }),
    startDate: new FormControl(toDateTimeLocal(nextFullHour(1)), { nonNullable: true, validators: [Validators.required] }), // dans une heure, à l'heure pile
    durationHours: new FormControl<number | null>(24, [Validators.required, Validators.min(1), Validators.max(720)]),
  });

  private readonly formValue = toSignal(                   // valeurs du formulaire sous forme de signal (pour les computed)
    this.form.valueChanges.pipe(map(() => this.form.getRawValue()), startWith(this.form.getRawValue())),
    { requireSync: true },
  );

  protected readonly gpus = signal<Gpu[]>([]);             // GPU proposés dans la liste
  protected readonly loadingGpus = signal(true);
  protected readonly available = signal<number | null>(null); // unités libres sur la période choisie
  protected readonly checking = signal(false);             // vérification de disponibilité en cours
  protected readonly submitting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly shaking = signal(false);
  protected readonly booked = signal<Rental | null>(null); // location créée : affiche la confirmation

  protected readonly selectedGpu = computed(() => this.gpus().find((gpu) => gpu.id === this.formValue().gpuId) ?? null);

  protected readonly period = computed(() => {             // début et fin de la location (null si la saisie est incomplète)
    const { startDate, durationHours } = this.formValue();
    const start = new Date(startDate);
    if (!startDate || Number.isNaN(start.getTime()) || !durationHours || durationHours < 1 || durationHours > 720) {
      return null;
    }
    return { start, end: new Date(start.getTime() + durationHours * HOUR_MS), hours: durationHours };
  });

  protected readonly estimatedTotal = computed(() => {     // estimation affichée ; le backend recalcule le vrai prix
    const gpu = this.selectedGpu();
    const period = this.period();
    return gpu && period ? Math.round(gpu.pricePerHour * this.formValue().quantity * period.hours * 100) / 100 : 0;
  });

  protected readonly tooManyUnits = computed(() => {       // plus d'unités demandées que d'unités libres
    const available = this.available();
    return available !== null && this.formValue().quantity > available;
  });

  constructor() {
    this.form.valueChanges                                 // revérifie la disponibilité quand le GPU ou la période change
      .pipe(
        map(() => this.form.getRawValue()),
        map((value) => ({ gpuId: value.gpuId, startDate: value.startDate, durationHours: value.durationHours })),
        distinctUntilChanged((a, b) => JSON.stringify(a) === JSON.stringify(b)), // la quantité seule ne relance pas la requête
        debounceTime(300),
        tap(() => this.checking.set(true)),
        switchMap(() => {                                  // annule la vérification précédente si elle n'est pas finie
          const gpuId = this.form.controls.gpuId.value;
          const period = this.period();
          if (gpuId === null || !period) {
            return of(null);
          }
          return this.gpuService
            .getById(gpuId, { startDate: period.start.toISOString(), durationHours: period.hours })
            .pipe(map((response) => response.gpu.availableUnits), catchError(() => of(null)));
        }),
        takeUntilDestroyed(),
      )
      .subscribe((available) => {
        this.available.set(available);
        this.checking.set(false);
      });
  }

  ngOnInit(): void {
    this.gpuService
      .list({ sort: 'name_asc' })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.gpus.set(response.gpus);
          this.loadingGpus.set(false);
          const requested = Number(this.gpuId());          // GPU demandé dans l'URL, sinon le premier de la liste
          const initial = response.gpus.find((gpu) => gpu.id === requested) ?? response.gpus[0];
          this.form.controls.gpuId.setValue(initial?.id ?? null); // déclenche la vérification de disponibilité
        },
        error: (err: unknown) => {
          this.errorMessage.set(getErrorMessage(err));
          this.loadingGpus.set(false);
        },
      });
  }

  protected setDuration(hours: number): void {
    this.form.controls.durationHours.setValue(hours);      // clic sur « 1 day », « 1 week »…
  }

  protected changeQuantity(step: number): void {          // boutons − et +
    const max = this.available() ?? this.selectedGpu()?.totalUnits ?? 1;
    const next = Math.min(Math.max(1, this.form.controls.quantity.value + step), Math.max(1, max));
    this.form.controls.quantity.setValue(next);
  }

  protected submit(): void {
    const period = this.period();
    const gpuId = this.form.controls.gpuId.value;
    if (this.form.invalid || !period || gpuId === null || this.tooManyUnits()) {
      this.form.markAllAsTouched();
      return;
    }
    if (period.start.getTime() < Date.now()) {
      this.errorMessage.set('The start date must be in the future.');
      this.shaking.set(true);
      return;
    }
    this.submitting.set(true);
    this.errorMessage.set(null);

    this.rentalService
      .create({ gpuId, quantity: this.form.controls.quantity.value, startDate: period.start.toISOString(), durationHours: period.hours })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.booked.set(response.rental);                // affiche la confirmation
          this.submitting.set(false);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        },
        error: (err: unknown) => {
          this.errorMessage.set(getErrorMessage(err));
          if (getErrorCode(err) === 'NOT_ENOUGH_UNITS') {
            this.gpuService                                // quelqu'un a réservé entre-temps : on met à jour les unités libres
              .getById(gpuId, { startDate: period.start.toISOString(), durationHours: period.hours })
              .pipe(takeUntilDestroyed(this.destroyRef))
              .subscribe({ next: (response) => this.available.set(response.gpu.availableUnits) });
          }
          this.shaking.set(true);
          this.submitting.set(false);
        },
      });
  }

  protected bookAnother(): void {
    this.booked.set(null);
    this.form.controls.startDate.setValue(toDateTimeLocal(nextFullHour(1)));
  }
}
