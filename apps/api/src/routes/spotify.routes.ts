import { Router } from 'express';

import { requireSession } from '../middleware/requireSession.js';

export const spotifyRoutes = Router();

spotifyRoutes.get('/me', requireSession, async (request, response) => {
  response.json({
    selectedSpotifyUserId: request.session.spotify?.selectedSpotifyUserId ?? null,
    connectedAccounts: Object.values(request.session.spotify?.connectedAccounts ?? {}).map((account) => ({
      spotifyUserId: account.spotifyUserId,
      displayName: account.displayName,
      username: account.username,
    })),
    note: 'Spotify proxy endpoints will be added here next.',
  });
});
