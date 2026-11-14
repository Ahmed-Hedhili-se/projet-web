import { Component, input, output, signal } from '@angular/core';
import { AgentConversation } from '../../../../core/models/agent';
import { timeAgo } from '../../../../shared/utils/date-time';

@Component({
  selector: 'app-advisor-history',
  templateUrl: './advisor-history.html',
})
export class AdvisorHistory {
  readonly conversations = input.required<AgentConversation[]>();
  readonly activeId = input<number | null>(null);
  readonly loading = input(false);
  readonly disabled = input(false);
  readonly selected = output<AgentConversation>();
  readonly created = output<void>();
  readonly removed = output<AgentConversation>();

  protected readonly open = signal(false);
  protected readonly timeAgo = (date: string) => timeAgo(new Date(date));

  protected select(conversation: AgentConversation): void {
    this.open.set(false);
    this.selected.emit(conversation);
  }
}
