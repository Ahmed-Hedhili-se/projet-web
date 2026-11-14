# Guide pour Adem — brancher le conseiller IA (étape F10)

> De : Ahmed (backend) · Pour : Adem (frontend) · 14/11/2026
> **Changement du contrat :** `docs/API.md` a une nouvelle **section 10 « Conseiller IA (agent) »**
> (6 routes `/api/agent/...`, 2 nouveaux codes d'erreur). Rien d'autre n'a changé dans le contrat.

---

## 1. Ce qui est prêt côté backend

| Étape | Contenu | Pour toi |
|---|---|---|
| B3 ✅ | `GET /gpus` (filtres, tri, disponibilité) et `GET /gpus/:id` | Le catalogue et la fiche GPU marchent avec le vrai backend |
| B8 ✅ | Simulateur (mémoire, durée, coût, débit), lecture d'un dépôt GitHub, classement des configurations | Rien à faire : utilisé par l'agent |
| B9 ✅ | Conversations + agent IA en **flux SSE** | C'est l'étape **F10** : la page `/recommend` |

76 tests backend passent (`cd backend && npm test`).

### Ce que fait l'agent (à mettre en avant dans la page)

L'utilisateur écrit **en texte libre** ce qu'il veut faire, et/ou colle le **lien GitHub de son modèle**. L'agent :

1. **lit le dépôt** : taille du modèle (calculée depuis `config.json`), précision (BF16, FP8, 4 bits…), LoRA / QLoRA,
   FlashAttention, DeepSpeed ZeRO-3 / FSDP, kernels CUDA… Chaque fait a sa **preuve** (le fichier où il l'a trouvé) ;
2. **pose une question** s'il manque une info essentielle (ex. taille du dataset) avec des boutons de réponse rapide ;
3. **simule les 22 configurations** du catalogue (1, 2, 4 ou 8 GPU de chaque modèle actif) : mémoire, durée, coût total,
   tokens/s, et écarte celles qui ne marchent pas (pas assez de mémoire, BF16 non supporté, code CUDA sur GPU AMD…) ;
4. répond avec la **meilleure architecture de GPU** et pourquoi, plus des **cartes** avec un bouton **Rent this**.

Les prix et les estimations viennent toujours du backend, jamais de l'IA.

---

## 2. Les routes (détails : `docs/API.md`, section 10)

| Route | Usage dans la page |
|---|---|
| `GET /agent/status` | Au chargement : `available` (sinon formulaire de secours) et quota `messagesUsedToday / dailyMessageLimit` |
| `POST /agent/conversations` | Bouton « New conversation » (ou au premier message) |
| `GET /agent/conversations` | Historique (colonne de gauche sur desktop) |
| `GET /agent/conversations/:id` | Rouvrir une conversation : messages + cartes |
| `DELETE /agent/conversations/:id` | Supprimer (avec ta `ConfirmDialog`) |
| `POST /agent/conversations/:id/messages` | Envoyer un message → **flux SSE** : `user_message`, `step`, `card`, `text`, `done` ou `error` |

Toutes ces routes exigent d'être connecté. Visiteur non connecté → carte « Sign in to use the AI advisor » + formulaire de secours.

---

## 3. Code Angular proposé

### 3.1 Modèles — `core/models/agent.ts`

```ts
export type AgentRole = 'USER' | 'ASSISTANT';
export type Verdict = 'BEST_CHOICE' | 'CHEAPEST' | 'FASTEST' | 'ALTERNATIVE';

export interface AgentStatus { available: boolean; model: string; dailyMessageLimit: number; messagesUsedToday: number; }

export interface AgentConversation {
  id: number; title: string; repoUrl: string | null; messageCount: number; createdAt: string; updatedAt: string;
}

export interface AgentStep { tool: string; label: string; }                    // étape affichée (« ▸ 3 steps »)

export interface ProfileFact { field: string; value: string | number | boolean; evidence: string; } // preuve = fichier du dépôt

export interface ProfileCard {
  type: 'profile'; repoUrl: string | null; missing: string[]; facts: ProfileFact[];
  profile: {
    mode?: 'PRETRAINING' | 'FULL_FINETUNE' | 'LORA' | 'QLORA' | 'INFERENCE';
    paramsBillions?: number; activeParamsBillions?: number;
    precision?: 'FP32' | 'BF16' | 'FP16' | 'FP8' | 'INT8' | 'INT4';
    contextLength?: number; batchSize?: number; trainingTokens?: number; epochs?: number;
    gradientCheckpointing?: boolean; sharded?: boolean; usesCudaKernels?: boolean; flashAttention?: 'NONE' | 'FA2' | 'FA3';
  };
}

export interface ConfigItem {
  rank: number; verdict: Verdict;
  gpu: { id: number; name: string; manufacturer: string; architecture: string; vramGb: number; pricePerHour: number };
  gpuCount: number; pricePerHour: number; availableUnits: number;
  estimate: {
    memoryRequiredGb: number; memoryPerGpuGb: number;
    hours: number | null; totalCost: number | null;                             // entraînement
    tokensPerSecond: number | null; costPerMillionTokens: number | null;        // inférence
  };
  reasons: string[]; warnings: string[];
  rentPath: string;                                                             // ex. /account/rentals/new?gpuId=1&quantity=8
}

export interface ConfigsCard { type: 'configs'; items: ConfigItem[]; }
export interface RepliesCard { type: 'replies'; options: string[]; }
export type AgentCard = ProfileCard | ConfigsCard | RepliesCard;

export interface AgentMessage {
  id: number; role: AgentRole; content: string; steps: AgentStep[]; cards: AgentCard[]; createdAt: string;
}

export type AgentEvent =                                                       // événements du flux SSE
  | { event: 'user_message'; data: { message: AgentMessage } }
  | { event: 'step'; data: AgentStep }
  | { event: 'card'; data: { card: AgentCard } }
  | { event: 'text'; data: { delta: string } }
  | { event: 'done'; data: { message: AgentMessage; conversation: AgentConversation } }
  | { event: 'error'; data: { error: { code: string; message: string } } };
```

### 3.2 Lire le flux SSE — `core/services/agent-service.ts`

`EventSource` ne permet ni `POST` ni header `Authorization` → on utilise `fetch()` et on lit le flux à la main.
L'`authInterceptor` ne s'applique pas à `fetch` : il faut ajouter le token soi-même.

```ts
@Injectable({ providedIn: 'root' })
export class AgentService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly baseUrl = `${environment.apiUrl}/agent`;

  status() { return this.http.get<AgentStatus>(`${this.baseUrl}/status`); }
  create() { return this.http.post<{ conversation: AgentConversation }>(`${this.baseUrl}/conversations`, {}); }
  list() { return this.http.get<{ conversations: AgentConversation[]; total: number }>(`${this.baseUrl}/conversations`); }
  get(id: number) { return this.http.get<{ conversation: AgentConversation; messages: AgentMessage[] }>(`${this.baseUrl}/conversations/${id}`); }
  remove(id: number) { return this.http.delete<void>(`${this.baseUrl}/conversations/${id}`); }

  async send(id: number, content: string, onEvent: (e: AgentEvent) => void, signal?: AbortSignal): Promise<void> {
    const res = await fetch(`${this.baseUrl}/conversations/${id}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.auth.token()}` }, // même token que l'authInterceptor
      body: JSON.stringify({ content }),
      signal,
    });
    if (!res.ok || !res.body) {                                                // erreurs AVANT le flux : JSON normal (400, 404, 429, 503…)
      const body = await res.json().catch(() => null);
      throw body?.error ?? { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' };
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let end: number;
      while ((end = buffer.indexOf('\n\n')) >= 0) {                           // un événement = un bloc terminé par une ligne vide
        const block = buffer.slice(0, end);
        buffer = buffer.slice(end + 2);
        const event = block.match(/^event: (.+)$/m)?.[1];
        const data = block.match(/^data: (.+)$/m)?.[1];
        if (event && data) onEvent({ event, data: JSON.parse(data) } as AgentEvent);
      }
    }
  }
}
```

Dans la page : un signal `messages`, un signal `pending` (étapes et cartes reçues en direct) ; sur `done`, remplacer le
message en cours par `done.message` (**il fait foi** : texte complet + toutes les cartes) et mettre à jour la conversation
dans l'historique. Sur `error` : `Alert` rouge avec `error.message` (déjà en anglais).

---

## 4. Page `/recommend` proposée (UX « avancée »)

```
┌ History (desktop) ┐ ┌───────────────────────── AI GPU Advisor ─────────────────────────┐
│ + New conversation│ │  Describe your workload or paste your model's GitHub repo.       │
│ ▸ legal-llama …   │ │  [Fine-tune Llama 8B with QLoRA] [Serve Mistral 7B] [Analyze …]  │  ← exemples cliquables
│ ▸ Serve 70B …     │ │                                                                  │
│                   │ │  You: Here is my repo github.com/acme/legal-llama, 300M tokens   │
│                   │ │  AI ▸ 3 steps                                                    │
│                   │ │   ┌ What the AI understood ──────────────────────────────────┐   │  ← carte "profile"
│                   │ │   │ QLoRA · 8B params · BF16 · FlashAttention-2 · CUDA       │   │
│                   │ │   │ evidence: train.py · config.json (liens vers GitHub)     │   │
│                   │ │   └──────────────────────────────────────────────────────────┘   │
│                   │ │   Your repo fine-tunes Llama 3.1 8B… Best architecture: Hopper   │  ← Markdown
│                   │ │   ┌ BEST CHOICE ─────┐ ┌ CHEAPEST ───────┐ ┌ ALTERNATIVE ──┐     │  ← carte "configs"
│                   │ │   │ 8 × H100 Hopper  │ │ 1 × H100        │ │ 8 × A100 80GB │     │
│                   │ │   │ ~1.5 h · ~$38    │ │ ~10.8 h · ~$35  │ │ …             │     │
│                   │ │   │ [Rent this]      │ │ [Rent this]     │ │ [Rent this]   │     │
│                   │ │   └──────────────────┘ └─────────────────┘ └───────────────┘     │
│                   │ │   [Cheapest option] [Fastest option] [What if I use FP8?]       │  ← carte "replies"
│                   │ │ ┌──────────────────────────────────────────────────────────────┐ │
│                   │ │ │ 🔗 GitHub repo (optional)  https://github.com/…              │ │  ← champ dédié au dépôt
│                   │ │ │ Message…                                         [Send]     │ │
│                   │ │ └──────────────────────────────────────────────────────────────┘ │
│                   │ │  4 / 30 messages today · Prefer a quick form? → fallback form    │
└───────────────────┘ └──────────────────────────────────────────────────────────────────┘
```

- **Champ « GitHub repo »** séparé du message : à l'envoi, construire
  `content = repo ? \`Repository: ${repo}\n\n${message}\`` : message`. Valider côté client `https://github.com/<owner>/<repo>`.
- **Exemples cliquables** au départ (remplissent le message), ex. « Fine-tune Llama 3.1 8B with QLoRA on 300M tokens »,
  « Serve Mistral 7B for 50 concurrent users », « Analyze https://github.com/artidoro/qlora ».
- **Étapes** : « ▸ 3 steps » repliable ; pendant l'attente, afficher le `label` de la dernière étape avec un spinner
  (« Analyzing github.com/acme/legal-llama… »). Une réponse prend 5 à 60 s.
- **Carte profile** : badges (mode, taille, précision…), et pour chaque fait un lien de preuve
  `${repoUrl}/blob/HEAD/${fact.evidence}`. Si `missing` n'est pas vide : « Still needed: dataset size ».
- **Cartes configs** : badge du `verdict`, `gpuCount × gpu.name`, **architecture** en évidence, prix/heure, estimation
  (« ~1.5 h · ~$38 » ou « ~38 tokens/s · $5.07 / 1M tokens »), `reasons` en vert, `warnings` en orange,
  bouton **Rent this** → `router.navigateByUrl(item.rentPath)`. Préciser « estimates ±30% ».
- **Replies** : un clic envoie l'option comme nouveau message.
- **Markdown** : `content` est du Markdown. Rendu proposé : `marked` puis `[innerHTML]` (le sanitizer d'Angular retire
  les scripts). Ne jamais afficher de HTML brut venant d'un dépôt.
- **Formulaire de secours** (F4) gardé : visiteur non connecté, `available: false`, ou lien « Prefer a quick form? ».
- **Design** : DESIGN.md + DESIGN-MOTION.md (cartes en verre, accent Aurora pour icônes et badges ;
  bleu `#0071e3` seulement pour **Send** et **Rent this**). Mobile : historique dans un tiroir, cartes en colonne.

### Petite modification demandée : quantité dans « New rental »

`rentPath` contient `&quantity=8`. Ta page `new-rental` lit déjà `gpuId` ; il suffirait d'ajouter
`readonly quantity = input<string>();` et de pré-remplir le champ (borné par le stock).

---

## 5. Données fictives (`useMockApi: true`)

`fetch` ne passe pas par les interceptors : pour le mode fictif, je propose que `AgentService.send()` rejoue un
scénario local quand `environment.useMockApi` est vrai (`user_message` → 3 `step` avec `setTimeout` → cartes → `text`
→ `done`), avec un exemple de réponse copié de `docs/API.md` (section 10). Les autres routes `/agent/...` peuvent
aller dans ton `mockApiInterceptor` comme d'habitude.

---

## 6. Tester avec le vrai backend

```bash
docker compose up -d
cd backend
npm install
npx prisma migrate dev      # applique les 2 nouvelles migrations (GPU specs, conversations)
npx prisma db seed
npm test                    # 76 tests
npm run dev                 # http://localhost:3000/api
```
Dans `backend/.env` : `GITHUB_TOKEN` (token GitHub avec la permission « Models : read-only »).
Puis dans `frontend/src/environments/environment.ts` : `useMockApi: false` (pour tester l'agent et le catalogue ;
les autres pages ont encore besoin du mode fictif tant que B4–B7 ne sont pas finis).

⚠️ **À savoir :** depuis mon PC, `models.github.ai` répond un simple texte « OK » au lieu du JSON du modèle, donc
le dialogue **réel** avec l'IA n'a pas encore pu être testé (tous les tests utilisent un faux modèle). L'agent affiche alors
une erreur claire dans le chat. Si ça marche chez toi, dis-le-moi. Sinon, le backend accepte n'importe quelle API
compatible OpenAI : `LLM_BASE_URL`, `LLM_API_KEY` et `LLM_MODEL` dans `backend/.env`.

---

## 7. Checklist F10

- [ ] `core/models/agent.ts` et `AgentService` (avec lecture SSE)
- [ ] Page `/recommend` : chat + champ GitHub + exemples, historique, étapes, cartes profile / configs / replies
- [ ] États : non connecté, `available: false`, quota atteint (429), erreur `AGENT_ERROR`, chargement
- [ ] Formulaire de secours (F4) accessible
- [ ] `new-rental` : paramètre `quantity`
- [ ] Mode fictif pour l'agent
- [ ] Responsive + `prefers-reduced-motion` + accessibilité (zone de messages `aria-live="polite"`)

Questions → message à Ahmed. Toute modification de `docs/API.md` passe par moi.
