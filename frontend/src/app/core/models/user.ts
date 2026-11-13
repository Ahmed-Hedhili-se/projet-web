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

export interface RegisterRequest {                         // body de POST /auth/register
  email: string;
  password: string;                                        // 8 à 72 caractères
  firstName: string;                                       // 1 à 50 caractères
  lastName: string;                                        // 1 à 50 caractères
}

export interface AuthResponse {                            // réponse de POST /auth/login et POST /auth/register
  token: string;                                           // JWT à envoyer dans le header Authorization
  user: User;
}

export interface MeResponse {                              // réponse de GET /auth/me, GET /users/me et PUT /users/me
  user: User;
}

export interface UpdateProfileRequest {                    // body de PUT /users/me (les 3 champs sont obligatoires)
  email: string;
  firstName: string;
  lastName: string;
}

export interface ChangePasswordRequest {                   // body de PUT /users/me/password
  currentPassword: string;
  newPassword: string;                                     // 8 à 72 caractères
}
