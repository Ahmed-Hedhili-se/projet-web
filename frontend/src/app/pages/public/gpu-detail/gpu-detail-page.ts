import { Component, DestroyRef, OnInit, computed, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { getErrorCode, getErrorMessage } from '../../../core/models/api-error';
import { Gpu } from '../../../core/models/gpu';
import { GpuService } from '../../../core/services/gpu-service';
import { Alert } from '../../../shared/components/alert/alert';
import { SplitText } from '../../../shared/components/split-text/split-text';
import { CountUp } from '../../../shared/directives/count-up';
import { Reveal } from '../../../shared/directives/reveal';
import { Tilt } from '../../../shared/directives/tilt';

@Component({
  selector: 'app-gpu-detail-page',
  imports: [RouterLink, Alert, Reveal, Tilt, CountUp, SplitText],
  templateUrl: './gpu-detail-page.html',
})
export class GpuDetailPage implements OnInit {
  readonly id = input.required<string>();                  // paramètre « :id » de l'URL (withComponentInputBinding)

  private readonly gpuService = inject(GpuService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly gpu = signal<Gpu | null>(null);
  protected readonly loading = signal(true);
  protected readonly notFound = signal(false);             // GPU inexistant ou désactivé (404)
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly costExamples = computed(() => {       // exemples de coût pour 1 unité, recalculés si le GPU change
    const gpu = this.gpu();
    if (!gpu) {
      return [];
    }
    return [
      { label: '1 hour', hours: 1 },
      { label: '1 day', hours: 24 },
      { label: '1 week', hours: 168 },
    ].map((example) => ({ ...example, cost: gpu.pricePerHour * example.hours }));
  });

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.errorMessage.set(null);
    this.notFound.set(false);

    this.gpuService
      .getById(Number(this.id()))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.gpu.set(response.gpu);
          this.loading.set(false);
        },
        error: (err: unknown) => {
          if (getErrorCode(err) === 'GPU_NOT_FOUND') {
            this.notFound.set(true);
          } else {
            this.errorMessage.set(getErrorMessage(err));
          }
          this.loading.set(false);
        },
      });
  }
}
