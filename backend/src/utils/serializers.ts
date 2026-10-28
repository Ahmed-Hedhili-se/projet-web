import { User } from '@prisma/client';

export function toPublicUser(user: User) {                  // objet "User" de API.md : jamais de passwordHash
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    isBlocked: user.isBlocked,
    createdAt: user.createdAt.toISOString(),
  };
}
