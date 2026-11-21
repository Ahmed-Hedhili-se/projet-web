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
  private readonly destroyRef = inject(DestroyRef); // permet d'annuler les requêtes en quittant la page

  protected readonly gpus = signal<Gpu[]>([]); // GPU affichés
  protected readonly manufacturers = signal<string[]>([]); // options du filtre « Manufacturer »
  protected readonly loading = signal(true);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly filtersOpen = signal(false); // panneau de filtres ouvert sur mobile
  protected readonly skeletons = [1, 2, 3, 4]; // cartes grises affichées pendant le chargement

  private query: GpuQuery = {}; // derniers filtres demandés (pour « Try again »)
  private request?: Subscription; // requête en cours

  ngOnInit(): void {
    this.load({}); // premier chargement, sans filtre
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
    this.request?.unsubscribe(); // annule la requête précédente si elle n'est pas finie
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
          this.errorMessage.set(getErrorMessage(err)); // message lisible pour l'utilisateur
          this.loading.set(false);
        },
      });
  }
}
