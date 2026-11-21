import {
  Component,
  DestroyRef,
  ElementRef,
  OnInit,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../../environments/environment';
import {
  AgentCard,
  AgentConversation,
  AgentError,
  AgentEvent,
  AgentMessage,
  AgentStatus,
} from '../../../../core/models/agent';
import { getErrorMessage } from '../../../../core/models/api-error';
import { AgentService } from '../../../../core/services/agent-service';
import { SmoothScroll } from '../../../../core/services/smooth-scroll';
import { Alert } from '../../../../shared/components/alert/alert';
import { ConfirmDialog } from '../../../../shared/components/confirm-dialog/confirm-dialog';
import { AdvisorHistory } from '../advisor-history/advisor-history';
import { AdvisorMessage } from '../advisor-message/advisor-message';

const REPO_URL = /^(https?:\/\/)?(www\.)?github\.com\/[\w.-]+\/[\w.-]+\/?$/i; // https://github.com/<owner>/<repo>
const CARD_ORDER: AgentCard['type'][] = ['profile', 'configs', 'replies']; // ordre d'affichage des cartes (docs/API.md)

function isAgentError(err: unknown): err is AgentError {
  // erreur de l'agent : { code, message }
  return typeof err === 'object' && err !== null && 'code' in err && 'message' in err;
}

@Component({
  selector: 'app-advisor-chat', // conversation avec le conseiller IA (docs/API.md, section 10)
  imports: [RouterLink, Alert, ConfirmDialog, AdvisorHistory, AdvisorMessage],
  templateUrl: './advisor-chat.html',
})
export class AdvisorChat implements OnInit {
  readonly status = input.required<AgentStatus>(); // disponibilité et quota, chargés par la page
  readonly useForm = output<void>(); // lien « Prefer a quick form? »

  private readonly agentService = inject(AgentService);
  private readonly smoothScroll = inject(SmoothScroll);
  private readonly composer = viewChild.required<ElementRef<HTMLElement>>('composer');
  private readonly abort = new AbortController(); // coupe le flux si on quitte la page

  protected readonly demo = environment.useMockApi; // données fictives : réponses simulées dans le navigateur
  protected readonly examples = [
    // exemples cliquables, affichés avant le premier message
    {
      label: 'Fine-tune Llama 3.1 8B with QLoRA',
      message: 'Fine-tune Llama 3.1 8B with QLoRA on 300M tokens',
      repo: '',
    },
    { label: 'Serve Mistral 7B', message: 'Serve Mistral 7B for 50 concurrent users', repo: '' },
    {
      label: 'Analyze a GitHub repository',
      message: 'Which GPU should I rent to run this repository?',
      repo: 'https://github.com/artidoro/qlora',
    },
  ];

  protected readonly conversation = signal<AgentConversation | null>(null);
  protected readonly messages = signal<AgentMessage[]>([]);
  protected readonly pending = signal<AgentMessage | null>(null); // réponse en cours : étapes, cartes et texte reçus en direct
  protected readonly sending = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly repo = signal(''); // champ « GitHub repository »
  protected readonly repoError = signal<string | null>(null);
  protected readonly draft = signal(''); // champ du message
  protected readonly used = signal(0); // messages envoyés aujourd'hui

  protected readonly history = signal<AgentConversation[]>([]); // mes conversations, la plus récente d'abord
  protected readonly loadingHistory = signal(true);
  protected readonly opening = signal(false); // conversation de l'historique en cours de chargement
  protected readonly toDelete = signal<AgentConversation | null>(null);
  protected readonly deleting = signal(false);

  protected readonly remaining = computed(() =>
    Math.max(0, this.status().dailyMessageLimit - this.used()),
  );
  protected readonly canSend = computed(
    () =>
      !this.sending() &&
      this.remaining() > 0 &&
      (this.draft().trim() !== '' || this.repo().trim() !== ''),
  );

  constructor() {
    inject(DestroyRef).onDestroy(() => this.abort.abort());
    effect(() => {
      // nouveau message ou nouvelle carte : on garde le bas du chat visible
      if (this.messages().length > 0 || this.pending()) {
        setTimeout(() => this.smoothScroll.showBottomOf(this.composer().nativeElement));
      }
    });
  }

  ngOnInit(): void {
    this.used.set(this.status().messagesUsedToday);
    this.refreshHistory();
  }

  private refreshHistory(): void {
    // GET /agent/conversations
    this.agentService.list().subscribe({
      next: (response) => {
        this.history.set(response.conversations);
        this.loadingHistory.set(false);
      },
      error: () => this.loadingHistory.set(false), // l'historique n'est pas bloquant : le chat reste utilisable
    });
  }

  protected openConversation(conversation: AgentConversation): void {
    // rouvre une conversation de l'historique
    if (this.sending() || this.opening() || conversation.id === this.conversation()?.id) {
      return;
    }
    this.opening.set(true);
    this.errorMessage.set(null);
    this.agentService.get(conversation.id).subscribe({
      // GET /agent/conversations/:id : messages et cartes
      next: (response) => {
        this.conversation.set(response.conversation);
        this.messages.set(response.messages);
        this.opening.set(false);
      },
      error: (err: unknown) => {
        this.errorMessage.set(getErrorMessage(err));
        this.opening.set(false);
      },
    });
  }

  protected confirmDelete(): void {
    // DELETE /agent/conversations/:id
    const conversation = this.toDelete();
    if (!conversation) {
      return;
    }
    this.deleting.set(true);
    this.agentService.remove(conversation.id).subscribe({
      next: () => {
        this.history.update((list) => list.filter((item) => item.id !== conversation.id));
        if (this.conversation()?.id === conversation.id) {
          this.newConversation(); // la conversation ouverte vient d'être supprimée
        }
        this.deleting.set(false);
        this.toDelete.set(null);
      },
      error: (err: unknown) => {
        this.errorMessage.set(getErrorMessage(err));
        this.deleting.set(false);
        this.toDelete.set(null);
      },
    });
  }

  protected useExample(example: { message: string; repo: string }): void {
    // remplit les champs, sans envoyer
    this.draft.set(example.message);
    this.repo.set(example.repo);
    this.repoError.set(null);
  }

  protected newConversation(): void {
    this.conversation.set(null);
    this.messages.set([]);
    this.errorMessage.set(null);
  }

  protected onEnter(event: Event): void {
    // Entrée = envoyer ; Maj + Entrée = nouvelle ligne
    if (!(event as KeyboardEvent).shiftKey) {
      event.preventDefault();
      void this.send();
    }
  }

  protected async send(text = this.draft()): Promise<void> {
    const message = text.trim();
    const repo = this.repo().trim();
    if (this.sending() || this.remaining() <= 0 || (!message && !repo)) {
      return;
    }
    if (repo && !REPO_URL.test(repo)) {
      this.repoError.set(
        'Enter the link of a public GitHub repository, for example https://github.com/owner/repo.',
      );
      return;
    }
    const content = repo ? `Repository: ${repo}${message ? `\n\n${message}` : ''}` : message; // format proposé par le backend
    this.sending.set(true);
    this.errorMessage.set(null);
    this.repoError.set(null);
    this.pending.set({
      id: -1,
      role: 'ASSISTANT',
      content: '',
      steps: [],
      cards: [],
      createdAt: new Date().toISOString(),
    });

    try {
      const conversation =
        this.conversation() ?? (await firstValueFrom(this.agentService.create())).conversation;
      this.conversation.set(conversation);
      await this.agentService.send(
        conversation.id,
        content,
        (event) => this.onEvent(event),
        this.abort.signal,
      );
    } catch (err) {
      if (!this.abort.signal.aborted) {
        // erreur avant le flux : quota, IA indisponible, réseau…
        this.errorMessage.set(isAgentError(err) ? err.message : getErrorMessage(err));
      }
    } finally {
      this.sending.set(false);
      this.pending.set(null);
      this.refreshHistory(); // nouveau titre, nouvelle date, nouvel ordre
    }
  }

  private onEvent(event: AgentEvent): void {
    // un événement du flux
    switch (event.event) {
      case 'user_message': // le message est enregistré : il s'affiche, les champs se vident
        this.messages.update((list) => [...list, event.data.message]);
        this.used.update((count) => count + 1);
        this.draft.set('');
        this.repo.set('');
        break;
      case 'step':
        this.pending.update(
          (current) => current && { ...current, steps: [...current.steps, event.data] },
        );
        break;
      case 'card': // une carte du même type remplace la précédente
        this.pending.update(
          (current) =>
            current && {
              ...current,
              cards: [
                ...current.cards.filter((card) => card.type !== event.data.card.type),
                event.data.card,
              ].sort((a, b) => CARD_ORDER.indexOf(a.type) - CARD_ORDER.indexOf(b.type)),
            },
        );
        break;
      case 'text':
        this.pending.update(
          (current) => current && { ...current, content: current.content + event.data.delta },
        );
        break;
      case 'done': // le message final fait foi : texte complet et toutes les cartes
        this.messages.update((list) => [...list, event.data.message]);
        this.conversation.set(event.data.conversation);
        this.pending.set(null);
        break;
      case 'error':
        this.errorMessage.set(event.data.error.message);
        this.pending.set(null);
        break;
    }
  }
}
