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
