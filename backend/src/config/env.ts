import 'dotenv/config';                                   // charge backend/.env dans process.env
import { z } from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),  // port HTTP du serveur
  DATABASE_URL: z.string().min(1),                          // connexion PostgreSQL (Prisma)
  REDIS_URL: z.string().min(1),                             // connexion Redis (rate limiting du login)
  JWT_SECRET: z.string().min(32),                           // clé de signature des tokens, longue et secrète
  JWT_EXPIRES_IN: z.string().default('24h'),                // durée de validité d'un token
  CORS_ORIGIN: z.string().default('http://localhost:4200'), // origine autorisée (frontend Angular)
  ADMIN_EMAIL: z.email().optional(),                        // compte admin créé par le seed
  ADMIN_PASSWORD: z.string().min(8).optional(),
  GITHUB_TOKEN: z.string().default(''),                     // vide = conseiller IA désactivé, le reste du site marche
  LLM_PROVIDER: z.enum(['github']).default('github'),       // fournisseur du modèle de langage (GitHub Models)
  LLM_MODEL: z.string().default('openai/gpt-4.1'),          // modèle utilisé par l'agent
  LLM_BASE_URL: z.url().default('https://models.github.ai/inference'), // toute API compatible OpenAI (/chat/completions)
  LLM_API_KEY: z.string().default(''),                      // vide = GITHUB_TOKEN est utilisé
  AGENT_DAILY_LIMIT: z.coerce.number().int().positive().default(30), // messages par utilisateur et par jour
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {                                      // arrêt immédiat si une variable manque ou est invalide
  console.error('Invalid environment variables:', z.flattenError(parsed.error).fieldErrors);
  process.exit(1);
}

export const env = parsed.data;                             // variables typées, utilisées dans tout le backend
