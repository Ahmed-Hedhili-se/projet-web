import { z } from 'zod';

export const sendMessageSchema = z.object({                 // body de POST /agent/conversations/:id/messages
  content: z
    .string({ error: 'Message is required.' })
    .trim()
    .min(1, { error: 'Message is required.' })
    .max(4000, { error: 'Message must be at most 4000 characters.' }),
});
