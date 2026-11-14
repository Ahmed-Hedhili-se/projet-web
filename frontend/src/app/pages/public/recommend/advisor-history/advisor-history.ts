import { Component, input, output, signal } from '@angular/core';
import { AgentConversation } from '../../../../core/models/agent';
import { timeAgo } from '../../../../shared/utils/date-time';

@Component({
  selector: 'app-advisor-history',                         // historique des conversations avec le conseiller IA (GET /agent/conversations)
  templateUrl: './advisor-history.html',
})
export class AdvisorHistory {
  readonly conversations = input.required<AgentConversation[]>(); // de la plus récente à la plus ancienne
  readonly activeId = input<number | null>(null);          // conversation ouverte dans le chat
  readonly loading = input(false);
  readonly disabled = input(false);                        // réponse de l'IA en cours : on ne change pas de conversation
  readonly selected = output<AgentConversation>();         // clic sur une conversation
  readonly created = output<void>();                       // bouton « New conversation »
  readonly removed = output<AgentConversation>();          // bouton de suppression

  protected readonly open = signal(false);                 // sur mobile, la liste est repliée par défaut
  protected readonly timeAgo = (date: string) => timeAgo(new Date(date));

  protected select(conversation: AgentConversation): void {
    this.open.set(false);                                  // sur mobile : referme la liste pour montrer le chat
    this.selected.emit(conversation);
  }
}
