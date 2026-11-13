export interface MockContactMessage {                      // objet « ContactMessage » de docs/API.md (table contact_messages)
  id: number;
  name: string;
  email: string;
  subject: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

const MESSAGES_KEY = 'teramind_mock_messages';            // messages fictifs, gardés dans le navigateur
const HOUR_MS = 60 * 60 * 1000;
let memoryMessages: MockContactMessage[] | null = null;    // secours si le localStorage est indisponible

export function allMockMessages(): MockContactMessage[] {
  try {
    const json = localStorage.getItem(MESSAGES_KEY);
    return json ? (JSON.parse(json) as MockContactMessage[]) : seedMessages(); // vide = messages d'exemple
  } catch {
    return memoryMessages ?? seedMessages();
  }
}

export function saveMockMessages(messages: MockContactMessage[]): void {
  memoryMessages = messages;
  try {
    localStorage.setItem(MESSAGES_KEY, JSON.stringify(messages));
  } catch {                                                // stockage indisponible : la liste reste en mémoire
    return;
  }
}

export function addMockMessage(message: Omit<MockContactMessage, 'id' | 'isRead' | 'createdAt'>): MockContactMessage { // POST /contact
  const messages = allMockMessages();
  const saved: MockContactMessage = {
    ...message,
    id: Math.max(12, ...messages.map((item) => item.id)) + 1, // continue après l'exemple n° 12 de docs/API.md
    isRead: false,
    createdAt: new Date().toISOString(),
  };
  saveMockMessages([...messages, saved]);
  return saved;
}

function seedMessages(): MockContactMessage[] {            // quelques messages d'exemple, des plus anciens aux plus récents
  const ago = (hours: number) => new Date(Date.now() - hours * HOUR_MS).toISOString();
  return [
    { id: 7, name: 'Nadia Karim', email: 'nadia.karim@example.com', subject: 'Invoice for October', message: 'Hello, could you send me the invoice for my October rentals? Thanks.', isRead: true, createdAt: ago(400) },
    { id: 8, name: 'Leo Fischer', email: 'leo.fischer@example.com', subject: 'Technical support', message: 'My training job stopped after 12 hours. Is there a time limit on A100 rentals?', isRead: true, createdAt: ago(250) },
    { id: 9, name: 'Ines Duarte', email: 'ines.duarte@example.com', subject: 'Partnership', message: 'We are a university lab and would like to discuss a partnership for student projects.', isRead: true, createdAt: ago(120) },
    { id: 10, name: 'Tom Becker', email: 'tom.becker@example.com', subject: 'Sales & pricing', message: 'Do you offer monthly plans for 4 × H100? We need them for at least three months.', isRead: false, createdAt: ago(30) },
    { id: 11, name: 'Yara Haddad', email: 'yara.haddad@example.com', subject: 'Technical support', message: 'Which CUDA version is installed on the RTX 4090 machines?', isRead: false, createdAt: ago(9) },
    { id: 12, name: 'John Smith', email: 'john.smith@example.com', subject: 'Volume pricing', message: 'Hello, do you offer discounts for 30-day rentals of 8 GPUs?', isRead: false, createdAt: ago(2) },
  ];
}
