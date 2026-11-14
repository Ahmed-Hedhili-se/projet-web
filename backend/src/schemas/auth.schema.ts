import { z } from 'zod';

export const emailField = z
  .string({ error: 'Email is required.' })
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: 'Invalid email address.' }));

export const passwordField = z
  .string({ error: 'Password is required.' })
  .min(8, { error: 'Password must be at least 8 characters.' })
  .max(72, { error: 'Password must be at most 72 characters.' });

export const nameField = (label: string) =>
  z
    .string({ error: `${label} is required.` })
    .trim()
    .min(1, { error: `${label} is required.` })
    .max(50, { error: `${label} must be at most 50 characters.` });

export const registerSchema = z.object({
  email: emailField,
  password: passwordField,
  firstName: nameField('First name'),
  lastName: nameField('Last name'),
});

export const loginSchema = z.object({
  email: emailField,
  password: z.string({ error: 'Password is required.' }).min(1, { error: 'Password is required.' }),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
