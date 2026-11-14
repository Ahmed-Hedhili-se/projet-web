import { describe, expect, it } from 'vitest';
import { analyzeRepo, paramsFromConfig, readRepoFile, selectFiles, sizeFromName } from '../src/agent/repoAnalyzer';
import { parseRepoUrl, RepoError, RepoSource } from '../src/lib/github';

function fakeRepo(files: Record<string, string>, branch = 'main'): RepoSource & { reads: string[] } {
  const reads: string[] = [];
  return {
    reads,
    getDefaultBranch: async () => branch,
    listFiles: async () => Object.entries(files).map(([path, text]) => ({ path, size: text.length })),
    readFile: async (_ref, _branch, path) => {
      if (!(path in files)) throw new RepoError('Repository or file not found (only public repositories can be read).');
      reads.push(path);
      return files[path];
    },
  };
}

const LLAMA_31_8B = {
  model_type: 'llama', hidden_act: 'silu', hidden_size: 4096, intermediate_size: 14336, num_hidden_layers: 32,
  num_attention_heads: 32, num_key_value_heads: 8, vocab_size: 128256, max_position_embeddings: 131072,
  tie_word_embeddings: false, torch_dtype: 'bfloat16',
};
const MIXTRAL_8X7B = {
  model_type: 'mixtral', hidden_act: 'silu', hidden_size: 4096, intermediate_size: 14336, num_hidden_layers: 32,
  num_attention_heads: 32, num_key_value_heads: 8, vocab_size: 32000, num_local_experts: 8, num_experts_per_tok: 2,
  max_position_embeddings: 32768, tie_word_embeddings: false,
};

const QLORA_REPO = {
  'README.md': '# legal-llama\nFine-tune Llama 3.1 8B on legal documents.\nWe trained it on a single A100 80GB.\n',
  'config.json': JSON.stringify(LLAMA_31_8B),
  'requirements.txt': 'torch>=2.3\ntransformers\npeft\nbitsandbytes\nflash-attn\ntrl\n',
  'scripts/train.py': [
    'import torch',
    'from transformers import AutoModelForCausalLM, BitsAndBytesConfig, TrainingArguments',
    'from peft import LoraConfig, get_peft_model',
    'bnb = BitsAndBytesConfig(load_in_4bit=True, bnb_4bit_compute_dtype=torch.bfloat16)',
    'model = AutoModelForCausalLM.from_pretrained("meta-llama/Llama-3.1-8B", quantization_config=bnb,',
    '    attn_implementation="flash_attention_2")',
    'args = TrainingArguments(per_device_train_batch_size=4, num_train_epochs=3, gradient_checkpointing=True, bf16=True)',
    'max_seq_length = 4096',
  ].join('\n'),
  'kernels/fused_rope.cu': '__global__ void rope() {}',
  'data/train.jsonl': '{"text": "..."}',
  'tests/test_train.py': 'import vllm  # ne doit pas être lu',
};

describe('parseRepoUrl', () => {
  it('accepts the usual forms of a GitHub URL', () => {
    for (const url of ['https://github.com/acme/legal-llama', 'github.com/acme/legal-llama.git',
      'https://www.github.com/acme/legal-llama/tree/main/scripts', 'http://github.com/acme/legal-llama/']) {
      expect(parseRepoUrl(url)).toEqual({ owner: 'acme', repo: 'legal-llama' });
    }
  });

  it('rejects other hosts and malformed URLs', () => {
    expect(() => parseRepoUrl('https://gitlab.com/acme/llm')).toThrow('Only public github.com repositories are supported.');
    expect(() => parseRepoUrl('https://github.com/acme')).toThrow(/expected https:\/\/github.com/);
    expect(() => parseRepoUrl('https://github.com/acme/re po')).toThrow(RepoError);
  });
});

describe('model size helpers', () => {
  it('counts Llama 3.1 8B and Mixtral 8x7B parameters from config.json', () => {
    expect(paramsFromConfig(LLAMA_31_8B)).toMatchObject({ paramsBillions: 8, layers: 32, kvHeads: 8, headDim: 128 });
    expect(paramsFromConfig(MIXTRAL_8X7B)).toMatchObject({ paramsBillions: 46.7, activeParamsBillions: 12.9 });
    expect(paramsFromConfig({ foo: 1 })).toBeNull();
  });

  it('reads the size in a model name', () => {
    expect(sizeFromName('meta-llama/Llama-3.1-8B')).toEqual({ total: 8 });
    expect(sizeFromName('Qwen/Qwen2.5-0.5B-Instruct')).toEqual({ total: 0.5 });
    expect(sizeFromName('mistralai/Mixtral-8x7B-v0.1')).toEqual({ total: 56 });
    expect(sizeFromName('bert-base-uncased')).toBeNull();
  });
});

describe('selectFiles', () => {
  it('reads useful files first and skips data, tests and huge files', () => {
    const files = Object.keys(QLORA_REPO).map((path) => ({ path, size: 100 }));
    files.push({ path: 'weights/model.py', size: 5_000_000 });
    const chosen = selectFiles(files);
    expect(chosen).toEqual(['README.md', 'config.json', 'requirements.txt', 'scripts/train.py']);
  });
});

describe('analyzeRepo', () => {
  it('extracts a QLoRA fine-tuning profile with evidence for each fact', async () => {
    const repo = fakeRepo(QLORA_REPO);
    const result = await analyzeRepo('https://github.com/acme/legal-llama', repo);

    expect(result.repo).toBe('acme/legal-llama');
    expect(repo.reads).not.toContain('tests/test_train.py');
    expect(result.framework).toBe('PyTorch');
    expect(result.libraries).toEqual(expect.arrayContaining(['transformers', 'peft', 'bitsandbytes', 'flash-attn']));
    expect(result.suggestedProfile).toEqual({
      paramsBillions: 8, layers: 32, hiddenSize: 4096, kvHeads: 8, headDim: 128,
      mode: 'QLORA', precision: 'BF16', flashAttention: 'FA2', usesCudaKernels: true,
      gradientCheckpointing: true, contextLength: 4096, batchSize: 4, epochs: 3,
    });
    const evidence = Object.fromEntries(result.facts.map((f) => [f.field, f.evidence]));
    expect(evidence).toMatchObject({
      paramsBillions: 'config.json', mode: 'scripts/train.py', usesCudaKernels: 'kernels/fused_rope.cu',
      modelId: 'scripts/train.py', maxContextLength: 'config.json',
    });
    expect(result.hardwareHints).toEqual([{ text: 'We trained it on a single A100 80GB.', evidence: 'README.md' }]);
    expect(result.missing).toEqual(['trainingTokens']);
  });

  it('detects an AWQ inference server with vLLM, sized from the model name', async () => {
    const repo = fakeRepo({
      'README.md': 'Serve Mistral with vLLM.',
      'serve.py': 'from vllm import LLM\nllm = LLM(model="mistralai/Mistral-7B-Instruct-v0.3", quantization="awq")\n',
    });
    const result = await analyzeRepo('github.com/acme/serve', repo);
    expect(result.suggestedProfile).toMatchObject({ mode: 'INFERENCE', precision: 'INT4', paramsBillions: 7 });
    expect(result.missing).toEqual([]);
  });

  it('detects DeepSpeed ZeRO-3 as sharded full fine-tuning', async () => {
    const repo = fakeRepo({
      'train.py': 'import deepspeed\nengine, *_ = deepspeed.initialize(model=model)\nloss.backward()\n',
      'ds_config_zero3.json': '{"zero_optimization": {"stage": 3}, "fp16": {"enabled": false}, "bf16": {"enabled": true}}',
    });
    const result = await analyzeRepo('https://github.com/acme/ds', repo);
    expect(result.suggestedProfile).toMatchObject({ mode: 'FULL_FINETUNE', sharded: true, precision: 'BF16' });
    expect(result.facts).toContainEqual({ field: 'deepspeedStage', value: 3, evidence: 'ds_config_zero3.json' });
    expect(result.missing).toEqual(['paramsBillions', 'trainingTokens']);
  });

  it('detects QLoRA from command-line flags in a root script', async () => {
    const repo = fakeRepo({
      'requirements.txt': 'transformers\npeft\nbitsandbytes\n',
      'qlora.py': 'parser.add_argument("--lora_r", type=int, default=64)\n',
      'scripts/finetune.sh': 'python qlora.py --model_name_or_path huggyllama/llama-7b --bits 4 --bf16 --gradient_checkpointing\n',
    });
    const result = await analyzeRepo('https://github.com/artidoro/qlora', repo);
    expect(repo.reads).toContain('qlora.py');
    expect(result.framework).toBe('PyTorch');
    expect(result.suggestedProfile).toMatchObject({ mode: 'QLORA', precision: 'BF16', paramsBillions: 7 });
  });

  it('does not guess LoRA from an installed package alone', async () => {
    const repo = fakeRepo({ 'requirements.txt': 'peft\n', 'serve.py': 'out = model.generate(ids)\n' });
    const result = await analyzeRepo('https://github.com/acme/p', repo);
    expect(result.suggestedProfile.mode).toBe('INFERENCE');
  });

  it('asks for the precision when the code does not say it', async () => {
    const repo = fakeRepo({ 'train.py': 'loss.backward()\noptimizer.step()\n' });
    const result = await analyzeRepo('https://github.com/acme/plain', repo);
    expect(result.missing).toEqual(['paramsBillions', 'precision', 'trainingTokens']);
  });

  it('propagates readable GitHub errors', async () => {
    const failing: RepoSource = {
      getDefaultBranch: async () => { throw new RepoError('This repository is private: only public repositories can be read.'); },
      listFiles: async () => [],
      readFile: async () => '',
    };
    await expect(analyzeRepo('https://github.com/acme/secret', failing)).rejects.toThrow(/private/);
  });
});

describe('readRepoFile', () => {
  it('returns at most 4000 characters and refuses path traversal', async () => {
    const repo = fakeRepo({ 'big.py': 'x'.repeat(5000) });
    const file = await readRepoFile('https://github.com/acme/r', '/big.py', repo);
    expect(file).toMatchObject({ path: 'big.py', truncated: true });
    expect(file.content).toHaveLength(4000);
    await expect(readRepoFile('https://github.com/acme/r', '../etc/passwd', repo)).rejects.toThrow('Invalid file path.');
  });
});
