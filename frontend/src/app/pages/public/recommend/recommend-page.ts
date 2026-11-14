import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { AgentStatus } from '../../../core/models/agent';
import { AgentService } from '../../../core/services/agent-service';
import { AuthService } from '../../../core/services/auth-service';
import { Alert } from '../../../shared/components/alert/alert';
import { SplitText } from '../../../shared/components/split-text/split-text';
import { AdvisorChat } from './advisor-chat/advisor-chat';
import { RecommendForm } from './recommend-form/recommend-form';

type Mode = 'advisor' | 'form';

@Component({
  selector: 'app-recommend-page',
  imports: [RouterLink, Alert, SplitText, AdvisorChat, RecommendForm],
  templateUrl: './recommend-page.html',
})
export class RecommendPage implements OnInit {             // page Recommendation : conseiller IA (mode principal) ou formulaire de secours
  private readonly agentService = inject(AgentService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly authService = inject(AuthService);

  protected readonly mode = signal<Mode>('advisor');
  protected readonly modes: { value: Mode; label: string }[] = [
    { value: 'advisor', label: 'AI advisor' },
    { value: 'form', label: 'Quick form' },
  ];
  protected readonly status = signal<AgentStatus | null>(null); // disponibilité et quota du conseiller
  protected readonly loadingStatus = signal(false);
  protected readonly unavailable = signal(false);          // IA éteinte ou injoignable : on montre le formulaire

  ngOnInit(): void {
    if (!this.authService.isLoggedIn()) {
      return;                                              // visiteur : carte « Sign in », pas d'appel à l'API
    }
    this.loadingStatus.set(true);
    this.agentService
      .status()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (status) => {
          this.status.set(status);
          this.loadingStatus.set(false);
          if (!status.available) {
            this.showFallback();
          }
        },
        error: () => {
          this.loadingStatus.set(false);
          this.showFallback();
        },
      });
  }

  private showFallback(): void {                           // docs/API.md : available = false → formulaire de secours
    this.unavailable.set(true);
    this.mode.set('form');
  }
}
