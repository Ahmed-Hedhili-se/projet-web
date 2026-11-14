import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription } from 'rxjs';
import { getErrorMessage } from '../../../core/models/api-error';
import { Gpu, GpuQuery } from '../../../core/models/gpu';
import { GpuService } from '../../../core/services/gpu-service';
import { Alert } from '../../../shared/components/alert/alert';
import { GpuCard } from '../../../shared/components/gpu-card/gpu-card';
import { GpuFilters } from '../../../shared/components/gpu-filters/gpu-filters';
import { SplitText } from '../../../shared/components/split-text/split-text';
import { Reveal } from '../../../shared/directives/reveal';

@Component({
  selector: 'app-gpu-catalog-page',
  imports: [GpuCard, GpuFilters, Alert, Reveal, SplitText],
  templateUrl: './gpu-catalog-page.html',
})
export class GpuCatalogPage implements OnInit {
  private readonly gpuService = inject(GpuService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly gpus = signal<Gpu[]>([]);
  protected readonly manufacturers = signal<string[]>([]);
  protected readonly loading = signal(true);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly filtersOpen = signal(false);
  protected readonly skeletons = [1, 2, 3, 4];

  private query: GpuQuery = {};
  private request?: Subscription;

  ngOnInit(): void {
    this.load({});
  }

  protected onFiltersChange(query: GpuQuery): void {
    this.load(query);
  }

  protected retry(): void {
    this.load(this.query);
  }

  protected toggleFilters(): void {
    this.filtersOpen.update((open) => !open);
  }

  private load(query: GpuQuery): void {
    this.query = query;
    this.request?.unsubscribe();
    this.loading.set(true);
    this.errorMessage.set(null);

    this.request = this.gpuService
      .list(query)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.gpus.set(response.gpus);
          this.manufacturers.set(response.manufacturers);
          this.loading.set(false);
        },
        error: (err: unknown) => {
          this.errorMessage.set(getErrorMessage(err));
          this.loading.set(false);
        },
      });
  }
}
