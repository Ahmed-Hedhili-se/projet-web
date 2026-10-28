export interface ErrorDetail {
  field: string;                                            // champ concerné, ex. "email"
  message: string;                                          // message en anglais
}

export class AppError extends Error {                       // erreur "prévue", transformée en JSON par errorHandler
  constructor(
    public readonly status: number,                         // code HTTP, ex. 404
    public readonly code: string,                           // code d'erreur de API.md, ex. "GPU_NOT_FOUND"
    message: string,                                        // message lisible en anglais
    public readonly details?: ErrorDetail[],                // seulement pour VALIDATION_ERROR
  ) {
    super(message);
  }
}
