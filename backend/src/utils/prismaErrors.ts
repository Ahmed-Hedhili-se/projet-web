import { Prisma } from '@prisma/client';

export function isUniqueViolation(err: unknown): boolean { // P2002 = valeur déjà prise sur un champ @unique
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
}
