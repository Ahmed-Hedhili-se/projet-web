import { Component, input, output } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { debounceTime } from 'rxjs';
import { GpuQuery, GpuSort } from '../../../core/models/gpu';
import { toDateTimeLocal } from '../../utils/date-time';

@Component({
  selector: 'app-gpu-filters',
  imports: [ReactiveFormsModule],
  templateUrl: './gpu-filters.html',
})
export class GpuFilters {                                  // formulaire de filtres du catalogue
  readonly manufacturers = input<string[]>([]);            // options de la liste « Manufacturer »
  readonly filtersChange = output<GpuQuery>();             // émis à chaque changement de filtre

  protected readonly vramOptions = [16, 24, 40, 80, 128];  // VRAM minimale proposée (Go)
  protected readonly priceOptions = [1, 2, 3, 5];          // prix maximal proposé ($ / heure)
  protected readonly sortOptions: { value: GpuSort; label: string }[] = [
    { value: 'price_asc', label: 'Price: low to high' },
    { value: 'price_desc', label: 'Price: high to low' },
    { value: 'vram_desc', label: 'Memory: high to low' },
    { value: 'name_asc', label: 'Name: A to Z' },
  ];
  protected readonly minStartDate = toDateTimeLocal(new Date()); // on ne peut pas choisir une date passée

  protected readonly form = new FormGroup({                // un contrôle par filtre
    search: new FormControl('', { nonNullable: true }),
    manufacturer: new FormControl('', { nonNullable: true }),
    minVram: new FormControl('', { nonNullable: true }),
    maxPrice: new FormControl('', { nonNullable: true }),
    available: new FormControl(false, { nonNullable: true }),
    startDate: new FormControl('', { nonNullable: true }),
    durationHours: new FormControl<number | null>(null),
    sort: new FormControl<GpuSort>('price_asc', { nonNullable: true }),
  });

  constructor() {
    this.form.valueChanges
      .pipe(debounceTime(300), takeUntilDestroyed())       // attend 300 ms après la dernière frappe
      .subscribe(() => this.filtersChange.emit(this.toQuery()));
  }

  protected reset(): void {
    this.form.reset();                                     // remet les valeurs initiales (et émet un changement)
  }

  private toQuery(): GpuQuery {                            // valeurs du formulaire → paramètres de GET /gpus
    const value = this.form.getRawValue();
    const hasPeriod = value.startDate !== '' && value.durationHours !== null && value.durationHours > 0;

    return {
      search: value.search.trim() || undefined,
      manufacturer: value.manufacturer || undefined,
      minVram: value.minVram ? Number(value.minVram) : undefined,
      maxPrice: value.maxPrice ? Number(value.maxPrice) : undefined,
      available: value.available || undefined,
      startDate: hasPeriod ? new Date(value.startDate).toISOString() : undefined, // envoyés seulement s'ils sont remplis tous les deux
      durationHours: hasPeriod ? (value.durationHours ?? undefined) : undefined,
      sort: value.sort,
    };
  }
}
