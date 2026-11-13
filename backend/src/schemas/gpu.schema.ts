import { z } from 'zod';

export const isoDateField = z                               // date ISO 8601, ex. "2026-11-02T09:00:00.000Z"
  .iso.datetime({ offset: true, error: 'Invalid date (ISO 8601 expected).' })
  .transform((value) => new Date(value));

export const durationHoursField = z.coerce                  // la query arrive en texte : "48" → 48
  .number({ error: 'Duration must be a number.' })
  .int({ error: 'Duration must be a whole number of hours.' })
  .min(1, { error: 'Duration must be at least 1 hour.' })
  .max(720, { error: 'Duration must be at most 720 hours (30 days).' });

export const periodQuerySchema = z.object({                 // période facultative pour calculer availableUnits
  startDate: isoDateField.optional(),
  durationHours: durationHoursField.optional(),
});

export const gpuListQuerySchema = periodQuerySchema.extend({ // query de GET /gpus (tout est optionnel)
  search: z.string().trim().max(100, { error: 'Search must be at most 100 characters.' }).optional(),
  manufacturer: z.string().trim().max(50, { error: 'Manufacturer must be at most 50 characters.' }).optional(),
  minVram: z.coerce.number({ error: 'Minimum VRAM must be a number.' })
    .int({ error: 'Minimum VRAM must be a whole number.' })
    .min(0, { error: 'Minimum VRAM cannot be negative.' })
    .optional(),
  maxPrice: z.coerce.number({ error: 'Maximum price must be a number.' })
    .min(0, { error: 'Maximum price cannot be negative.' })
    .optional(),
  available: z.enum(['true', 'false'], { error: 'Available must be true or false.' })
    .transform((value) => value === 'true')
    .optional(),
  sort: z.enum(['price_asc', 'price_desc', 'vram_desc', 'name_asc'], { error: 'Invalid sort value.' })
    .default('price_asc'),
});

export const idParamSchema = z.object({                     // paramètre :id d'une URL
  id: z.coerce.number({ error: 'Id must be a number.' })
    .int({ error: 'Id must be a whole number.' })
    .positive({ error: 'Id must be positive.' }),
});

export type PeriodQuery = z.infer<typeof periodQuerySchema>;
export type GpuListQuery = z.infer<typeof gpuListQuerySchema>;
