import { HttpErrorResponse } from '@angular/common/http';

export interface ApiError {                                // format d'erreur commun (docs/API.md, section 1)
  error: {
    code: string;                                          // ex. "GPU_NOT_FOUND"
    message: string;                                       // message en anglais, affichable tel quel
    details?: { field: string; message: string }[];        // seulement pour VALIDATION_ERROR
  };
}

export function getErrorMessage(err: unknown): string {    // transforme une erreur HTTP en message pour l'utilisateur
  if (err instanceof HttpErrorResponse) {
    const apiError = err.error as ApiError | null;
    if (apiError?.error?.message) {
      return apiError.error.message;                       // message renvoyé par l'API
    }
    if (err.status === 0) {
      return 'Unable to reach the server. Please check your connection.'; // serveur éteint ou pas de réseau
    }
  }
  return 'Something went wrong. Please try again.';
}

export function getErrorCode(err: unknown): string | null { // code d'erreur de l'API, ex. "GPU_NOT_FOUND"
  if (err instanceof HttpErrorResponse) {
    return (err.error as ApiError | null)?.error?.code ?? null;
  }
  return null;
}
