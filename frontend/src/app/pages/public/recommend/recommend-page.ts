import { CurrencyPipe } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { getErrorMessage } from '../../../core/models/api-error';
import { GpuConfiguration, ModelType, RecommendationResponse, WorkloadMode } from '../../../core/models/recommendation';
import { RecommendationService } from '../../../core/services/recommendation-service';
import { Alert } from '../../../shared/components/alert/alert';
import { SplitText } from '../../../shared/components/split-text/split-text';
import { CountUp } from '../../../shared/directives/count-up';
import { Reveal } from '../../../shared/directives/reveal';
import { Tilt } from '../../../shared/directives/tilt';

@Component({
  selector: 'app-recommend-page',
  imports: [ReactiveFormsModule, RouterLink, CurrencyPipe, Alert, SplitText, CountUp, Reveal, Tilt],
  templateUrl: './recommend-page.html',
})
export class RecommendPage {
  private readonly recommendationService = inject(RecommendationService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly modelTypes: { value: ModelType; label: string; hint: string }[] = [ // choix « Model type »
    { value: 'LLM', label: 'LLM', hint: 'Chat, text, code' },
    { value: 'VISION', label: 'Vision', hint: 'Detection, segmentation' },
    { value: 'DIFFUSION', label: 'Diffusion', hint: 'Image generation' },
    { value: 'AUDIO', label: 'Audio', hint: 'Speech, music' },
    { value: 'OTHER', label: 'Other', hint: 'Any other model' },
  ];
  protected readonly modes: { value: WorkloadMode; label: string; hint: string }[] = [ // choix « Mode »
    { value: 'INFERENCE', label: 'Inference', hint: 'Serve a trained model' },
    { value: 'TRAINING', label: 'Training', hint: 'Train or fine-tune' },
  ];
  protected readonly parameterPresets = [1, 7, 13, 70, 405]; // tailles courantes, en milliards de paramètres
  protected readonly estimateSteps = [                     // section « How we estimate » (docs/PLAN.md, section 8)
    { value: '2 / 16 bytes', title: 'Per parameter', text: '2 bytes in inference (FP16 weights). 16 bytes in training: weights, gradients and optimizer states.' },
    { value: '+20%', title: 'Safety margin', text: 'Extra memory for activations, batches and the KV cache.' },
    { value: '×1.1 – ×1.3', title: 'Model type', text: 'Vision and diffusion models need more working memory than text models.' },
  ];

  protected readonly form = new FormGroup({
    modelType: new FormControl<ModelType>('LLM', { nonNullable: true }),
    parametersBillions: new FormControl<number | null>(7, [Validators.required, Validators.min(0.01), Validators.max(2000)]),
    mode: new FormControl<WorkloadMode>('INFERENCE', { nonNullable: true }),
    budgetPerHour: new FormControl(2, { nonNullable: true, validators: [Validators.required, Validators.min(0.5)] }),
  });

  protected readonly loading = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly result = signal<RecommendationResponse | null>(null);
  protected readonly resultList = computed(() => {         // liste de 0 ou 1 élément : un nouvel objet recrée le bloc et rejoue les animations
    const result = this.result();
    return result ? [result] : [];
  });

  protected setParameters(value: number): void {
    this.form.controls.parametersBillions.setValue(value); // clic sur un bouton « 7B », « 70B »…
  }

  protected gaugePercent(required: number, config: GpuConfiguration): number {
    return Math.min(100, Math.round((required / config.totalVramGb) * 100)); // part de la mémoire utilisée
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();                        // affiche les messages d'erreur
      return;
    }
    const value = this.form.getRawValue();
    this.loading.set(true);
    this.errorMessage.set(null);

    this.recommendationService
      .recommend({
        modelType: value.modelType,
        parametersBillions: value.parametersBillions ?? 0,
        mode: value.mode,
        budgetPerHour: value.budgetPerHour,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.result.set(response);
          this.loading.set(false);
          this.scrollToResultOnMobile();
        },
        error: (err: unknown) => {
          this.errorMessage.set(getErrorMessage(err));
          this.loading.set(false);
        },
      });
  }

  private scrollToResultOnMobile(): void {                 // sur petit écran, le résultat est sous le formulaire : on y descend
    if (window.innerWidth < 1024) {
      setTimeout(() => document.getElementById('recommendation-result')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    }
  }
}
