export type Role = 'USER' | 'ADMIN';                      // rôles de docs/API.md

export interface User {                                    // objet « User » de docs/API.md (jamais de mot de passe)
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
  isBlocked: boolean;
  createdAt: string;                                       // date ISO 8601
}

export interface LoginRequest {                            // body de POST /auth/login
  email: string;
  password: string;
}

export interface AuthResponse {                            // réponse de POST /auth/login (et plus tard /auth/register)
  token: string;                                           // JWT à envoyer dans le header Authorization
  user: User;
}

export interface MeResponse {                              // réponse de GET /auth/me
  user: User;
}
