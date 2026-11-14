export interface ContactRequest {                          // body de POST /contact (docs/API.md, section 6)
  name: string;                                            // 1 à 100 caractères
  email: string;                                           // email valide
  subject: string;                                         // 1 à 150 caractères
  message: string;                                         // 10 à 2000 caractères
}

export interface ContactResponse {                         // réponse 201 de POST /contact
  success: boolean;
  id: number;                                              // identifiant du message enregistré
}

export interface ContactMessage {                          // objet « ContactMessage » de docs/API.md (lu par l'admin)
  id: number;
  name: string;
  email: string;
  subject: string;
  message: string;
  isRead: boolean;
  createdAt: string;                                       // date ISO 8601
}
