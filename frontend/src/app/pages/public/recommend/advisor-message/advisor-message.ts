import { CurrencyPipe } from '@angular/common';
import { Component, computed, inject, input, output, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AgentMessage, AgentWorkloadMode, ConfigItem, ConfigsCard, ProfileCard, RepliesCard, Verdict } from '../../../../core/models/agent';
import { renderMarkdown } from '../../../../shared/utils/markdown';

const MODE_LABELS: Record<AgentWorkloadMode, string> = {
  PRETRAINING: 'Pre-training', FULL_FINETUNE: 'Full fine-tuning', LORA: 'LoRA', QLORA: 'QLoRA', INFERENCE: 'Inference',
};
const MISSING_LABELS: Record<string, string> = {           // champs de `missing` → texte lisible
  mode: 'workload type', paramsBillions: 'model size', precision: 'precision', trainingTokens: 'dataset size',
};

function compact(value: number): string {                  // 300000000 → « 300M »
  if (value >= 1e9) return `${Math.round(value / 1e8) / 10}B`;
  if (value >= 1e6) return `${Math.round(value / 1e5) / 10}M`;
  if (value >= 1e3) return `${Math.round(value / 100) / 10}K`;
  return String(value);
}

@Component({
  selector: 'app-advisor-message',                         // un message du chat : bulle de l'utilisateur, ou réponse de l'IA avec ses cartes
  imports: [RouterLink, CurrencyPipe],
  templateUrl: './advisor-message.html',
})
export class AdvisorMessage {
  readonly message = input.required<AgentMessage>();
  readonly working = input(false);                         // réponse en cours d'arrivée : roue + dernière étape
  readonly interactive = input(false);                     // dernier message : les boutons de réponse rapide sont actifs
  readonly reply = output<string>();                       // clic sur une réponse rapide

  private readonly router = inject(Router);

  protected readonly stepsOpen = signal(false);
  protected readonly verdictLabels: Record<Verdict, string> = {
    BEST_CHOICE: 'Best choice', CHEAPEST: 'Cheapest', FASTEST: 'Fastest', ALTERNATIVE: 'Alternative',
  };

  protected readonly html = computed(() => renderMarkdown(this.message().content)); // Markdown → HTML sûr

  protected readonly profileCard = computed(() => this.message().cards.find((card): card is ProfileCard => card.type === 'profile') ?? null);
  protected readonly repliesCard = computed(() => this.message().cards.find((card): card is RepliesCard => card.type === 'replies') ?? null);
  protected readonly configs = computed(() => {            // configurations + lien « Rent this » prêt pour routerLink
    const card = this.message().cards.find((item): item is ConfigsCard => item.type === 'configs');
    return (card?.items ?? []).map((item) => ({ item, rentUrl: this.router.parseUrl(item.rentPath) }));
  });

  protected readonly badges = computed(() => {             // pastilles de la carte « What the AI understood »
    const profile = this.profileCard()?.profile;
    if (!profile) {
      return [];
    }
    const badges: string[] = [];
    if (profile.mode) badges.push(MODE_LABELS[profile.mode]);
    if (profile.paramsBillions) badges.push(`${profile.paramsBillions}B parameters`);
    if (profile.precision) badges.push(profile.precision);
    if (profile.trainingTokens) badges.push(`${compact(profile.trainingTokens)} tokens`);
    if (profile.flashAttention && profile.flashAttention !== 'NONE') badges.push(profile.flashAttention === 'FA3' ? 'FlashAttention-3' : 'FlashAttention-2');
    if (profile.usesCudaKernels) badges.push('CUDA kernels');
    if (profile.sharded) badges.push('ZeRO-3 / FSDP');
    if (profile.gradientCheckpointing) badges.push('Gradient checkpointing');
    if (profile.contextLength) badges.push(`${compact(profile.contextLength)} context`);
    if (profile.batchSize) badges.push(`Batch ${profile.batchSize}`);
    if (profile.epochs) badges.push(`${profile.epochs} epoch${profile.epochs === 1 ? '' : 's'}`);
    return badges;
  });

  protected readonly evidence = computed(() => {           // fichiers du dépôt qui prouvent les faits (un lien par fichier)
    const card = this.profileCard();
    const files = [...new Set((card?.facts ?? []).map((fact) => fact.evidence))];
    return files.map((file) => ({ file, url: card?.repoUrl ? `${card.repoUrl}/blob/HEAD/${file}` : null }));
  });

  protected readonly missing = computed(() => (this.profileCard()?.missing ?? []).map((field) => MISSING_LABELS[field] ?? field).join(', '));

  protected estimateText(item: ConfigItem): string {       // « ~1.5 h · ~$38 » ou « ~143 tokens/s · $6.21 / 1M tokens »
    const { hours, totalCost, tokensPerSecond, costPerMillionTokens } = item.estimate;
    if (hours !== null && totalCost !== null) {
      const duration = hours < 1 ? `${Math.max(1, Math.round(hours * 60))} min` : hours >= 72 ? `${Math.round(hours / 2.4) / 10} days` : `${Math.round(hours * 10) / 10} h`;
      return `~${duration} · ~$${totalCost >= 100 ? Math.round(totalCost).toLocaleString('en-US') : totalCost.toFixed(2)}`;
    }
    if (tokensPerSecond !== null && costPerMillionTokens !== null) {
      return `~${tokensPerSecond.toLocaleString('en-US')} tokens/s · $${costPerMillionTokens.toFixed(2)} / 1M tokens`;
    }
    return 'No estimate';
  }
}
