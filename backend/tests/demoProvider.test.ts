import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { demoProvider, profileFromText } from '../src/agent/demoProvider';
import { openAiCompatibleProvider, setLlmProvider } from '../src/agent/llm';
import { setRepoSource } from '../src/agent/tools';
import { app } from '../src/app';
import { githubSource, RepoSource } from '../src/lib/github';
import { cleanupTestData, closeConnections, registerUser, waitForRedis } from './helpers';

const REPO: Record<string, string> = {
  'requirements.txt': 'torch\ntransformers\npeft\nbitsandbytes\n',
  'train.py': 'from peft import LoraConfig\nbnb = BitsAndBytesConfig(load_in_4bit=True)\n'
    + 'model = AutoModelForCausalLM.from_pretrained("meta-llama/Llama-3.1-8B")\nargs = TrainingArguments(bf16=True)\n',
};
const fakeRepo: RepoSource = {
  getDefaultBranch: async () => 'main',
  listFiles: async () => Object.entries(REPO).map(([path, t]) => ({ path, size: t.length })),
  readFile: async (_r, _b, path) => REPO[path],
};

async function chat(token: string, id: number, content: string) {
  const res = await request(app).post(`/api/agent/conversations/${id}/messages`)
    .set('Authorization', `Bearer ${token}`).send({ content })
    .buffer(true).parse((r, cb) => { let b = ''; r.setEncoding('utf8'); r.on('data', (c: string) => { b += c; }); r.on('end', () => cb(null, b)); });
  const events = String(res.body).split('\n\n').filter(Boolean).map((block) => ({
    event: block.match(/^event: (.+)$/m)![1], data: JSON.parse(block.match(/^data: (.+)$/m)![1]),
  }));
  const done = events.find((e) => e.event === 'done');
  if (!done) throw new Error(`No done event: ${JSON.stringify(events.at(-1))}`);
  return done.data.message as { content: string; steps: { tool: string }[]; cards: { type: string; [k: string]: any }[] };
}

let token: string;
const newConversation = async () =>
  (await request(app).post('/api/agent/conversations').set('Authorization', `Bearer ${token}`)).body.conversation.id as number;

beforeAll(async () => {
  await waitForRedis();
  setLlmProvider(demoProvider);
  setRepoSource(fakeRepo);
  token = (await registerUser('demo')).token;
});
afterAll(async () => {
  setLlmProvider(openAiCompatibleProvider);
  setRepoSource(githubSource);
  await cleanupTestData();
  await closeConnections();
});

describe('profileFromText', () => {
  it('reads size, mode, precision and dataset size from a sentence', () => {
    expect(profileFromText('Fine-tune an 8B model with QLoRA on 300M tokens')).toEqual({ paramsBillions: 8, mode: 'QLORA', trainingTokens: 3e8 });
    expect(profileFromText('Serve Mistral 7B in FP8')).toEqual({ paramsBillions: 7, mode: 'INFERENCE', precision: 'FP8' });
    expect(profileFromText('pretrain on 1B tokens')).toEqual({ mode: 'PRETRAINING', trainingTokens: 1e9 });
    expect(profileFromText('see https://github.com/huggyllama/llama-7b')).toEqual({});
  });
});

describe('demo provider through the real agent', () => {
  it('analyzes a repository and recommends configurations', async () => {
    const message = await chat(token, await newConversation(), 'https://github.com/acme/legal-llama — QLoRA on 300M tokens, which GPU?');
    expect(message.steps.map((s) => s.tool)).toEqual(['analyze_repo', 'update_workload_profile', 'rank_configs']);
    expect(message.cards.map((c) => c.type)).toEqual(['profile', 'configs', 'replies']);
    expect(message.cards[0].profile).toMatchObject({ mode: 'QLORA', paramsBillions: 8, trainingTokens: 3e8 });
    expect(message.cards[1].items.length).toBeGreaterThan(0);
    expect(message.content).toMatch(/^Best architecture: \*\*\w+/);
    expect(message.content).toContain('Demo mode');
  });

  it('answers a text-only inference request with tokens per second', async () => {
    const id = await newConversation();
    const first = await chat(token, id, 'I want to serve a 7B model for a chatbot');
    const configs = first.cards.find((c) => c.type === 'configs')!;
    expect(configs.items[0].estimate.tokensPerSecond).toBeGreaterThan(0);
    expect(first.content).toContain('tokens/s');

    const cheaper = await chat(token, id, 'Cheapest option');
    expect(cheaper.steps.map((s) => s.tool)).toEqual(['rank_configs']);
    expect(cheaper.cards.find((c) => c.type === 'configs')).toBeDefined();
  });

  it('asks one question with quick replies when the request is vague', async () => {
    const message = await chat(token, await newConversation(), 'Hello');
    expect(message.cards).toEqual([{ type: 'replies', options: ['Serve a 7B model', 'QLoRA fine-tuning of an 8B model', 'Analyze my GitHub repo'] }]);
    expect(message.content).toContain('Tell me about your workload');
  });

  it('asks for the model size when it is missing', async () => {
    const message = await chat(token, await newConversation(), 'I want to fine-tune with LoRA on 1B tokens');
    expect(message.content).toContain('How big is the model');
    expect(message.cards.find((c) => c.type === 'replies')!.options).toContain('7B model');
  });
});
