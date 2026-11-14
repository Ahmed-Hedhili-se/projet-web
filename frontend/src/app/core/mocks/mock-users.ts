import { User } from '../models/user';

export interface MockAccount {
  password: string;
  user: User;
}

const ACCOUNTS_KEY = 'teramind_mock_accounts_v3';

export const MOCK_ACCOUNTS: MockAccount[] = [
  {
    password: 'Password123',
    user: { id: 3, email: 'jane.doe@example.com', firstName: 'Jane', lastName: 'Doe', role: 'USER', isBlocked: false, createdAt: '2026-10-20T14:32:10.000Z' },
  },
  {
    password: 'Admin12345',
    user: { id: 1, email: 'admin@teramind.example', firstName: 'Amira', lastName: 'Haddad', role: 'ADMIN', isBlocked: false, createdAt: '2026-10-01T08:00:00.000Z' },
  },
  {
    password: 'Password123',
    user: { id: 9, email: 'blocked@example.com', firstName: 'Sam', lastName: 'Blocked', role: 'USER', isBlocked: true, createdAt: '2026-10-15T09:00:00.000Z' },
  },
  {
    password: 'Password123',
    user: { id: 4, email: 'lucas.martin@example.com', firstName: 'Lucas', lastName: 'Martin', role: 'USER', isBlocked: false, createdAt: '2026-05-03T10:00:00.000Z' },
  },
  {
    password: 'Password123',
    user: { id: 5, email: 'sofia.rossi@example.com', firstName: 'Sofia', lastName: 'Rossi', role: 'USER', isBlocked: false, createdAt: '2026-05-21T16:20:00.000Z' },
  },
  {
    password: 'Password123',
    user: { id: 6, email: 'omar.benali@example.com', firstName: 'Omar', lastName: 'Benali', role: 'USER', isBlocked: false, createdAt: '2026-06-12T08:45:00.000Z' },
  },
  {
    password: 'Password123',
    user: { id: 7, email: 'mia.chen@example.com', firstName: 'Mia', lastName: 'Chen', role: 'USER', isBlocked: false, createdAt: '2026-07-30T13:10:00.000Z' },
  },
];

let memoryAccounts: MockAccount[] | null = null;

export function allMockAccounts(): MockAccount[] {
  try {
    const json = localStorage.getItem(ACCOUNTS_KEY);
    return json ? (JSON.parse(json) as MockAccount[]) : structuredClone(MOCK_ACCOUNTS);
  } catch {
    return memoryAccounts ?? structuredClone(MOCK_ACCOUNTS);
  }
}

export function saveMockAccounts(accounts: MockAccount[]): void {
  memoryAccounts = accounts;
  try {
    localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
  } catch {
    return;
  }
}

export function addMockAccount(account: MockAccount): void {
  saveMockAccounts([...allMockAccounts(), account]);
}

export function updateMockAccount(userId: number, changes: { password?: string; user?: Partial<User> }): MockAccount | null {
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
  return Math.max(...allMockAccounts().map((account) => account.user.id)) + 1;
}

export function mockTokenFor(user: User): string {
  return `mock-token-${user.id}`;
}
