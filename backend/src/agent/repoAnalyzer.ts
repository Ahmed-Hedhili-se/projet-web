// Outils analyze_repo et read_repo_file : lisent un repo GitHub et en extraient des faits avec leur preuve.
// Le contenu du repo est traité comme de la DONNÉE : on n'exécute rien, on cherche seulement des motifs.
import { githubSource, parseRepoUrl, RepoError, RepoFile, RepoSource } from '../lib/github';
import { FlashAttention, Precision, WorkloadMode, WorkloadProfile } from './types';

const MAX_FILES = 12;                                       // fichiers lus au maximum par analyse
const MAX_FILE_BYTES = 200_000;                             // on ignore les fichiers plus gros (données, poids)
const MAX_TEXT = 30_000;                                    // caractères analysés par fichier
const READ_FILE_LIMIT = 4_000;                              // caractères renvoyés par read_repo_file

export interface Fact {
  field: string;                                            // ex. "precision"
  value: string | number | boolean;
  evidence: string;                                         // fichier où le fait a été trouvé
}

export interface RepoAnalysis {                             // résumé compact renvoyé au LLM
  repo: string;
  branch: string;
  filesRead: string[];
  framework: string | null;
  libraries: string[];
  facts: Fact[];
  suggestedProfile: Partial<WorkloadProfile>;
  hardwareHints: { text: string; evidence: string }[];
  missing: string[];                                        // informations à demander à l'utilisateur
}

type Texts = { path: string; text: string }[];

// ---------- 1. Choix des fichiers à lire ----------

const PRIORITIES: RegExp[] = [                              // ordre de lecture (le premier motif = le plus utile)
  /^readme(\.md|\.rst|\.txt)?$/i,
  /(^|\/)config\.json$/i,
  /(^|\/)(requirements[^/]*\.txt|pyproject\.toml|setup\.py|environment\.ya?ml)$/i,
  /(^|\/)[^/]*(ds_config|deepspeed|zero|fsdp|accelerate)[^/]*\.(json|ya?ml)$/i,
  /(^|\/)[^/]*(train|finetune|fine_tune|sft|pretrain|infer|serve|generate)[^/]*\.(py|sh|ya?ml)$/i,
  /(^|\/)(main|run|app)\.py$/i,
  /^[^/]+\.py$/i,                                           // scripts Python à la racine (ex. qlora.py)
  /(^|\/)dockerfile$/i,
];
const SKIP = /(^|\/)(node_modules|\.git|\.github|tests?|docs?|examples?|assets|data)\//i;

export function selectFiles(files: RepoFile[]): string[] {  // jusqu'à MAX_FILES chemins, les plus utiles d'abord
  const candidates = files.filter((f) => f.size <= MAX_FILE_BYTES && !SKIP.test(f.path));
  const chosen: string[] = [];
  for (const pattern of PRIORITIES) {
    const matches = candidates
      .filter((f) => pattern.test(f.path) && !chosen.includes(f.path))
      .sort((a, b) => a.path.split('/').length - b.path.split('/').length); // fichiers proches de la racine d'abord
    for (const f of matches.slice(0, 3)) {                  // 3 fichiers maximum par catégorie
      if (chosen.length < MAX_FILES) chosen.push(f.path);
    }
  }
  return chosen;
}

// ---------- 2. Extraction des faits ----------

function findFirst(texts: Texts, pattern: RegExp): { match: RegExpMatchArray; path: string } | null {
  for (const { path, text } of texts) {
    const match = text.match(pattern);
    if (match) return { match, path };
  }
  return null;
}

const LIBRARIES: [string, RegExp][] = [                     // nom affiché → motif dans le code ou les dépendances
  ['torch', /\b(import torch|torch[=<>~! \n]|^torch$)/m],
  ['tensorflow', /\b(import tensorflow|tensorflow)\b/],
  ['jax', /\b(import jax|from jax|flax)\b/],
  ['transformers', /\btransformers\b/],
  ['diffusers', /\bdiffusers\b/],
  ['peft', /\bpeft\b/],
  ['trl', /\b(trl|SFTTrainer)\b/],
  ['bitsandbytes', /\bbitsandbytes\b/],
  ['deepspeed', /\bdeepspeed\b/i],
  ['accelerate', /\baccelerate\b/],
  ['flash-attn', /\bflash[-_]attn\b|flash_attention_[23]/],
  ['xformers', /\bxformers\b/],
  ['vllm', /\bvllm\b/],
  ['tensorrt-llm', /\btensorrt[-_]llm\b/i],
  ['transformer-engine', /\btransformer[-_]engine\b/],
  ['unsloth', /\bunsloth\b/],
  ['auto-gptq / autoawq', /\b(auto[-_]gptq|autoawq|awq)\b/i],
];

function detectMode(code: Texts, paths: string[]): { value: WorkloadMode; evidence: string } | null {
  const lora = findFirst(code, /LoraConfig|get_peft_model|--lora_r\b|\blora_r\s*[=:]/); // un indice dans le code, pas seulement "peft" installé
  const fourBit = findFirst(code, /load_in_4bit\s*=\s*True|bnb_4bit|prepare_model_for_kbit_training|--bits[ =]4\b|--quant_type[ =]nf4/);
  if (lora && fourBit) return { value: 'QLORA', evidence: fourBit.path };
  if (lora) return { value: 'LORA', evidence: lora.path };
  const pretrainFile = paths.find((p) => /pretrain/i.test(p));
  const fromScratch = findFirst(code, /from_config\(|train(ing)? from scratch/i);
  if (pretrainFile || fromScratch) return { value: 'PRETRAINING', evidence: pretrainFile ?? fromScratch!.path };
  const training = findFirst(code, /\b(SFTTrainer|Trainer)\(|\.backward\(|optimizer\.step\(|deepspeed\.initialize/);
  if (training) return { value: 'FULL_FINETUNE', evidence: training.path };
  const inference = findFirst(code, /\bvllm\b|\.generate\(|pipeline\(\s*["']text-generation|text-generation-inference/);
  if (inference) return { value: 'INFERENCE', evidence: inference.path };
  return null;
}

function detectPrecision(code: Texts, mode: WorkloadMode | undefined): { value: Precision; evidence: string } | null {
  const checks: [Precision, RegExp][] = [
    ['FP8', /transformer_engine|fp8_autocast|float8|["']fp8["']|--fp8\b/i],
    ...(mode === 'INFERENCE' || mode === undefined         // en QLoRA les poids sont en 4 bits mais le calcul en BF16
      ? ([['INT4', /load_in_4bit\s*=\s*True|\bawq\b|gptq|\bnf4\b/i], ['INT8', /load_in_8bit\s*=\s*True/]] as [Precision, RegExp][])
      : []),
    ['BF16', /bf16["']?\s*[=:]\s*(True|true|\{\s*["']enabled["']\s*:\s*true)|torch\.bfloat16|mixed_precision\s*[=:]\s*["']?bf16|--bf16\b/],
    ['FP16', /fp16["']?\s*[=:]\s*(True|true|\{\s*["']enabled["']\s*:\s*true)|torch\.float16|mixed_precision\s*[=:]\s*["']?fp16|--fp16\b/],
  ];
  for (const [value, pattern] of checks) {
    const hit = findFirst(code, pattern);
    if (hit) return { value, evidence: hit.path };
  }
  return null;
}

function detectFlashAttention(code: Texts): { value: FlashAttention; evidence: string } | null {
  const fa3 = findFirst(code, /flash_attention_3|flash_attn_interface|flash-attn-3|FlashAttention-3/i);
  if (fa3) return { value: 'FA3', evidence: fa3.path };
  const fa2 = findFirst(code, /flash_attention_2|flash[-_]attn\b/);
  if (fa2) return { value: 'FA2', evidence: fa2.path };
  return null;
}

function findNumber(code: Texts, keys: string): { value: number; evidence: string } | null {
  const hit =
    findFirst(code, new RegExp(`\\b(?:${keys})\\b["']?\\s*[=:]\\s*(\\d+(?:\\.\\d+)?)`)) ?? // max_seq_length = 4096 / "epochs": 3
    findFirst(code, new RegExp(`--(?:${keys})[ =](\\d+(?:\\.\\d+)?)`));                   // --max_seq_length 4096
  return hit ? { value: Number(hit.match[1]), evidence: hit.path } : null;
}

export function sizeFromName(name: string): { total: number; active?: number } | null { // "Mixtral-8x7B" → 56 ; "Llama-3.1-8B" → 8
  const moe = name.match(/(\d+)x(\d+(?:\.\d+)?)[bB](?![a-zA-Z])/);
  if (moe) return { total: Number(moe[1]) * Number(moe[2]) };
  const dense = name.match(/(?:^|[-_/\s(])(\d+(?:\.\d+)?)\s?[bB](?![a-zA-Z])/);
  return dense ? { total: Number(dense[1]) } : null;
}

export function paramsFromConfig(config: Record<string, unknown>) { // compte les paramètres à partir d'un config.json Hugging Face
  const num = (...keys: string[]) => keys.map((k) => config[k]).find((v): v is number => typeof v === 'number');
  const L = num('num_hidden_layers', 'n_layer', 'num_layers');
  const h = num('hidden_size', 'n_embd', 'd_model');
  const heads = num('num_attention_heads', 'n_head');
  if (!L || !h || !heads) return null;                      // pas un config.json de transformer
  const kvHeads = num('num_key_value_heads') ?? heads;
  const headDim = num('head_dim') ?? h / heads;
  const inter = num('intermediate_size', 'n_inner', 'ffn_dim') ?? 4 * h;
  const vocab = num('vocab_size') ?? 32000;
  const experts = num('num_local_experts', 'num_experts', 'n_routed_experts');
  const topK = num('num_experts_per_tok', 'moe_topk');
  const gated = /silu|swiglu|geglu/i.test(String(config.hidden_act ?? config.activation_function ?? '')); // 3 matrices au lieu de 2

  const attention = h * heads * headDim + 2 * h * kvHeads * headDim + heads * headDim * h; // Q, K, V, O
  const mlp = (gated ? 3 : 2) * h * inter;
  const embeddings = vocab * h * (config.tie_word_embeddings === true ? 1 : 2);
  const total = L * (attention + mlp * (experts ?? 1)) + embeddings;
  const active = L * (attention + mlp * (experts && topK ? topK : 1)) + embeddings;
  const round = (n: number) => Math.round(n / 1e8) / 10;   // en milliards, 1 décimale
  return {
    paramsBillions: round(total),
    activeParamsBillions: experts ? round(active) : undefined,
    layers: L, hiddenSize: h, kvHeads, headDim,
    contextLength: num('max_position_embeddings', 'n_positions', 'max_seq_len'),
  };
}

export function extractFacts(texts: Texts, allPaths: string[]) { // texte des fichiers → faits + profil suggéré
  const facts: Fact[] = [];
  const profile: Partial<WorkloadProfile> = {};
  const add = <K extends keyof WorkloadProfile>(field: K, value: WorkloadProfile[K], evidence: string) => {
    if (value === undefined || profile[field] !== undefined) return; // le premier fait trouvé gagne
    profile[field] = value;
    facts.push({ field, value: value as string | number | boolean, evidence });
  };
  const all = texts.map((t) => t.text).join('\n');
  const libraries = LIBRARIES.filter(([, pattern]) => pattern.test(all)).map(([name]) => name);
  const pytorchOnly = ['peft', 'bitsandbytes', 'deepspeed', 'flash-attn', 'vllm', 'unsloth']; // bibliothèques qui imposent PyTorch
  const framework = libraries.includes('torch') || libraries.some((l) => pytorchOnly.includes(l)) ? 'PyTorch'
    : libraries.includes('tensorflow') ? 'TensorFlow' : libraries.includes('jax') ? 'JAX' : null;

  const config = texts.find((t) => /(^|\/)config\.json$/i.test(t.path));
  if (config) {                                             // 1. config.json : la source la plus fiable
    try {
      const parsed = paramsFromConfig(JSON.parse(config.text));
      if (parsed) {
        for (const key of ['paramsBillions', 'activeParamsBillions', 'layers', 'hiddenSize', 'kvHeads', 'headDim'] as const) {
          add(key, parsed[key], config.path);
        }
        if (parsed.contextLength) {                         // contexte MAXIMAL du modèle, pas celui utilisé par le script
          facts.push({ field: 'maxContextLength', value: parsed.contextLength, evidence: config.path });
        }
      }
    } catch { /* JSON invalide : ignoré */ }
  }

  const modelId =                                           // 2. nom du modèle Hugging Face, ex. meta-llama/Llama-3.1-8B
    findFirst(texts, /(?:from_pretrained\(\s*|\bmodel(?:_name(?:_or_path)?|_id)?\s*[=:]\s*)["']([\w.-]+\/[\w.-]+)["']/) ??
    findFirst(texts, /--model(?:_name_or_path)?[ =]([\w.-]+\/[\w.-]+)/);
  if (modelId) {
    facts.push({ field: 'modelId', value: modelId.match[1], evidence: modelId.path });
    const size = sizeFromName(modelId.match[1]);
    if (size) add('paramsBillions', size.total, modelId.path);
  }
  const readme = texts.find((t) => /^readme/i.test(t.path));
  const readmeSize = readme && sizeFromName(readme.text.slice(0, 5000));
  if (readmeSize) add('paramsBillions', readmeSize.total, readme.path); // 3. taille citée dans le README

  const code = texts.filter((t) => !/^readme/i.test(t.path)); // le README décrit, le code fait foi
  const mode = detectMode(code, allPaths);
  if (mode) add('mode', mode.value, mode.evidence);
  const precision = detectPrecision(code, profile.mode);
  if (precision) add('precision', precision.value, precision.evidence);
  const flash = detectFlashAttention(code);
  if (flash) add('flashAttention', flash.value, flash.evidence);

  const cuFile = allPaths.find((p) => /\.(cu|cuh)$/i.test(p));
  const cudaLib = findFirst(code, /bitsandbytes|tensorrt[-_]llm|xformers/i);
  if (cuFile) add('usesCudaKernels', true, cuFile);
  else if (cudaLib) add('usesCudaKernels', true, cudaLib.path);

  const zero = findFirst(code, /["']?stage["']?\s*[:=]\s*(\d)/);
  if (zero) facts.push({ field: 'deepspeedStage', value: Number(zero.match[1]), evidence: zero.path });
  const fsdp = findFirst(code, /\bfsdp\b|FullyShardedDataParallel/i);
  if (zero?.match[1] === '3') add('sharded', true, zero.path);
  else if (fsdp) add('sharded', true, fsdp.path);
  const checkpointing = findFirst(code, /gradient_checkpointing\s*[=:]\s*(True|true)|gradient_checkpointing_enable\(|--gradient_checkpointing\b/);
  if (checkpointing) add('gradientCheckpointing', true, checkpointing.path);

  const context = findNumber(code, 'max_seq_length|max_seq_len|model_max_length|cutoff_len|block_size|seq_len|max_length');
  if (context) add('contextLength', context.value, context.evidence);
  const batch = findNumber(code, 'per_device_train_batch_size|micro_batch_size|train_batch_size|batch_size');
  if (batch) add('batchSize', batch.value, batch.evidence);
  const epochs = findNumber(code, 'num_train_epochs|epochs');
  if (epochs) add('epochs', epochs.value, epochs.evidence);

  const hardwareHints: RepoAnalysis['hardwareHints'] = [];  // phrases du README qui citent du matériel
  for (const t of texts.filter((t) => /^readme/i.test(t.path))) {
    for (const line of t.text.split('\n')) {
      if (hardwareHints.length < 5 && /\b(H100|H200|B200|A100|A10G?|L40S?|L4|RTX ?\d{4}|V100|T4|MI300X?|\d+\s?GB (of )?(VRAM|GPU))\b/.test(line)) {
        hardwareHints.push({ text: line.trim().slice(0, 160), evidence: t.path });
      }
    }
  }

  const missing = (['mode', 'paramsBillions', 'precision'] as const).filter((f) => profile[f] === undefined) as string[];
  if (profile.mode && profile.mode !== 'INFERENCE') missing.push('trainingTokens'); // jamais dans le code : taille du dataset
  return { framework, libraries, facts, suggestedProfile: profile, hardwareHints, missing };
}

// ---------- 3. Outils appelés par l'agent ----------

export async function analyzeRepo(repoUrl: string, source: RepoSource = githubSource): Promise<RepoAnalysis> {
  const ref = parseRepoUrl(repoUrl);
  const branch = await source.getDefaultBranch(ref);
  const files = await source.listFiles(ref, branch);
  const chosen = selectFiles(files);
  const texts: Texts = [];
  for (const path of chosen) {                              // un par un : reste poli avec l'API GitHub
    texts.push({ path, text: (await source.readFile(ref, branch, path)).slice(0, MAX_TEXT) });
  }
  return {
    repo: `${ref.owner}/${ref.repo}`,
    branch,
    filesRead: chosen,
    ...extractFacts(texts, files.map((f) => f.path)),
  };
}

export async function readRepoFile(repoUrl: string, path: string, source: RepoSource = githubSource) { // extrait d'un fichier précis
  const ref = parseRepoUrl(repoUrl);
  const cleanPath = path.replace(/^\/+/, '');
  if (!cleanPath || cleanPath.split('/').includes('..')) throw new RepoError('Invalid file path.');
  const branch = await source.getDefaultBranch(ref);
  const text = await source.readFile(ref, branch, cleanPath);
  return { path: cleanPath, content: text.slice(0, READ_FILE_LIMIT), truncated: text.length > READ_FILE_LIMIT };
}
