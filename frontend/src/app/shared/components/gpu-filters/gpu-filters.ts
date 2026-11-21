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
export class GpuFilters {
  readonly manufacturers = input<string[]>([]);
  readonly filtersChange = output<GpuQuery>();

  protected readonly vramOptions = [16, 24, 40, 80, 128];
  protected readonly priceOptions = [1, 2, 3, 5];
  protected readonly sortOptions: { value: GpuSort; label: string }[] = [
    { value: 'price_asc', label: 'Price: low to high' },
    { value: 'price_desc', label: 'Price: high to low' },
    { value: 'vram_desc', label: 'Memory: high to low' },
    { value: 'name_asc', label: 'Name: A to Z' },
  ];
  protected readonly minStartDate = toDateTimeLocal(new Date());

  protected readonly form = new FormGroup({
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
      .pipe(debounceTime(300), takeUntilDestroyed())
      .subscribe(() => this.filtersChange.emit(this.toQuery()));
  }

  protected reset(): void {
    this.form.reset();
  }

  private toQuery(): GpuQuery {
    const value = this.form.getRawValue();
    const hasPeriod =
      value.startDate !== '' && value.durationHours !== null && value.durationHours > 0;

    return {
      search: value.search.trim() || undefined,
      manufacturer: value.manufacturer || undefined,
      minVram: value.minVram ? Number(value.minVram) : undefined,
      maxPrice: value.maxPrice ? Number(value.maxPrice) : undefined,
      available: value.available || undefined,
      startDate: hasPeriod ? new Date(value.startDate).toISOString() : undefined,
      durationHours: hasPeriod ? (value.durationHours ?? undefined) : undefined,
      sort: value.sort,
    };
  }
}
