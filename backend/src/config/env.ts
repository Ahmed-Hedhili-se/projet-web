import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('24h'),
  CORS_ORIGIN: z.string().default('http://localhost:4200'),
  ADMIN_EMAIL: z.email().optional(),
  ADMIN_PASSWORD: z.string().min(8).optional(),
  GITHUB_TOKEN: z.string().default(''),
  LLM_PROVIDER: z.enum(['github']).default('github'),
  LLM_MODEL: z.string().default('openai/gpt-4.1'),
  LLM_BASE_URL: z.url().default('https://models.github.ai/inference'),
  LLM_API_KEY: z.string().default(''),
  AGENT_DAILY_LIMIT: z.coerce.number().int().positive().default(30),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:', z.flattenError(parsed.error).fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
