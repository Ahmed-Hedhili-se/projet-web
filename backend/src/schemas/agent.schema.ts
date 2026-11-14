import { z } from 'zod';

export const sendMessageSchema = z.object({
  content: z
    .string({ error: 'Message is required.' })
    .trim()
    .min(1, { error: 'Message is required.' })
    .max(4000, { error: 'Message must be at most 4000 characters.' }),
});
