import { User } from '../models/user';

export interface MockAccount {                             // compte fictif : le vrai backend stocke un mot de passe haché (bcrypt)
  password: string;
  user: User;
}

export const MOCK_ACCOUNTS: MockAccount[] = [              // comptes de démonstration, utilisés seulement par le mock
  {
    password: 'Password123',
    user: { id: 3, email: 'jane.doe@example.com', firstName: 'Jane', lastName: 'Doe', role: 'USER', isBlocked: false, createdAt: '2026-10-20T14:32:10.000Z' },
  },
  {
    password: 'Admin12345',
    user: { id: 1, email: 'admin@neurogrid.example', firstName: 'Amira', lastName: 'Haddad', role: 'ADMIN', isBlocked: false, createdAt: '2026-10-01T08:00:00.000Z' },
  },
  {
    password: 'Password123',
    user: { id: 9, email: 'blocked@example.com', firstName: 'Sam', lastName: 'Blocked', role: 'USER', isBlocked: true, createdAt: '2026-10-15T09:00:00.000Z' },
  },
];

export function mockTokenFor(user: User): string {         // faux JWT : suffisant pour reconnaître l'utilisateur dans le mock
  return `mock-token-${user.id}`;
}
