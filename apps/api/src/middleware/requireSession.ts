import type { RequestHandler } from 'express';

export const requireSession: RequestHandler = (request, response, next) => {
  if (!request.session.spotify || Object.keys(request.session.spotify.connectedAccounts).length === 0) {
    response.status(401).json({ error: 'Not authenticated' });
    return;
  }

  next();
};
