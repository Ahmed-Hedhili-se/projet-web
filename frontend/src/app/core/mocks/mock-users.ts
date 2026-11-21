import { User } from '../models/user';

export interface MockAccount {
  // compte fictif : le vrai backend stocke un mot de passe haché (bcrypt)
  password: string;
  user: User;
}

const ACCOUNTS_KEY = 'teramind_mock_accounts_v3'; // tous les comptes fictifs, gardés dans le navigateur (mock seulement)

export const MOCK_ACCOUNTS: MockAccount[] = [
  // comptes de démonstration (valeurs de départ)
  {
    password: 'Password123',
    user: {
      id: 3,
      email: 'jane.doe@example.com',
      firstName: 'Jane',
      lastName: 'Doe',
      role: 'USER',
      isBlocked: false,
      createdAt: '2026-10-20T14:32:10.000Z',
    },
  },
  {
    password: 'Admin12345',
    user: {
      id: 1,
      email: 'admin@teramind.example',
      firstName: 'Amira',
      lastName: 'Haddad',
      role: 'ADMIN',
      isBlocked: false,
      createdAt: '2026-10-01T08:00:00.000Z',
    },
  },
  {
    password: 'Password123',
    user: {
      id: 9,
      email: 'blocked@example.com',
      firstName: 'Sam',
      lastName: 'Blocked',
      role: 'USER',
      isBlocked: true,
      createdAt: '2026-10-15T09:00:00.000Z',
    },
  },
  {
    // clients fictifs : remplissent l'historique du dashboard admin
    password: 'Password123',
    user: {
      id: 4,
      email: 'lucas.martin@example.com',
      firstName: 'Lucas',
      lastName: 'Martin',
      role: 'USER',
      isBlocked: false,
      createdAt: '2026-05-03T10:00:00.000Z',
    },
  },
  {
    password: 'Password123',
    user: {
      id: 5,
      email: 'sofia.rossi@example.com',
      firstName: 'Sofia',
      lastName: 'Rossi',
      role: 'USER',
      isBlocked: false,
      createdAt: '2026-05-21T16:20:00.000Z',
    },
  },
  {
    password: 'Password123',
    user: {
      id: 6,
      email: 'omar.benali@example.com',
      firstName: 'Omar',
      lastName: 'Benali',
      role: 'USER',
      isBlocked: false,
      createdAt: '2026-06-12T08:45:00.000Z',
    },
  },
  {
    password: 'Password123',
    user: {
      id: 7,
      email: 'mia.chen@example.com',
      firstName: 'Mia',
      lastName: 'Chen',
      role: 'USER',
      isBlocked: false,
      createdAt: '2026-07-30T13:10:00.000Z',
    },
  },
];

let memoryAccounts: MockAccount[] | null = null; // secours si le localStorage est indisponible

export function allMockAccounts(): MockAccount[] {
  // comptes de démonstration + comptes créés ou modifiés
  try {
    const json = localStorage.getItem(ACCOUNTS_KEY);
    return json ? (JSON.parse(json) as MockAccount[]) : structuredClone(MOCK_ACCOUNTS); // vide = premier lancement : comptes de démonstration
  } catch {
    // stockage indisponible ou illisible
    return memoryAccounts ?? structuredClone(MOCK_ACCOUNTS);
  }
}

export function saveMockAccounts(accounts: MockAccount[]): void {
  // enregistre la liste (survit au rafraîchissement)
  memoryAccounts = accounts;
  try {
    localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
  } catch {
    // stockage indisponible : la liste reste en mémoire
    return;
  }
}

export function addMockAccount(account: MockAccount): void {
  // nouveau compte (Register)
  saveMockAccounts([...allMockAccounts(), account]);
}

export function updateMockAccount(
  userId: number,
  changes: { password?: string; user?: Partial<User> },
): MockAccount | null {
  const accounts = allMockAccounts();
  const account = accounts.find((item) => item.user.id === userId);
  if (!account) {
    return null;
  }
  if (changes.password) {
    account.password = changes.password;
  }
  account.user = { ...account.user, ...changes.user };
  saveMockAccounts(accounts);
  return account;
}

export function nextMockUserId(): number {
  // identifiant libre pour un nouveau compte
  return Math.max(...allMockAccounts().map((account) => account.user.id)) + 1;
}

export function mockTokenFor(user: User): string {
  // faux JWT : suffisant pour reconnaître l'utilisateur dans le mock
  return `mock-token-${user.id}`;
}
