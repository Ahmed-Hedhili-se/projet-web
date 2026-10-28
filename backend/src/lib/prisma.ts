import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();                   // client unique partagé par tout le backend
