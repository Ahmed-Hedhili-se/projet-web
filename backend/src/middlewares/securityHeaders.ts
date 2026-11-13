import { NextFunction, Request, Response } from 'express';

export function securityHeaders(_req: Request, res: Response, next: NextFunction) { // l'API ne renvoie que du JSON
  res.setHeader('X-Content-Type-Options', 'nosniff');       // le navigateur ne devine pas le type des réponses
  res.setHeader('X-Frame-Options', 'DENY');                 // l'API ne peut pas être affichée dans une iframe
  res.setHeader('Referrer-Policy', 'no-referrer');          // aucune URL transmise aux autres sites
  res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'"); // aucune ressource chargée
  res.setHeader('Cache-Control', 'no-store');               // les réponses (tokens, profils) ne sont pas mises en cache
  next();
}
