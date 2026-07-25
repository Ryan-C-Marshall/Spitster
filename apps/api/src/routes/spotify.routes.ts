import { Router } from 'express';

import { requireSession } from '../middleware/requireSession.js';
import { playTrack } from '../services/spotify/spotifyWebApi.service.js';

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


// -- Playback API --

// Hands the frontend SDK a token to authenticate with
spotifyRoutes.get('/me/player-token', requireSession, async (request, response) => {
  const selectedSpotifyUserId = request.session.spotify?.selectedSpotifyUserId ?? null;
  const account = selectedSpotifyUserId
    ? request.session.spotify?.connectedAccounts[selectedSpotifyUserId]
    : null;

  if (!account) {
    response.status(400).json({ error: 'No selected Spotify account' });
    return;
  }

  response.json({ accessToken: account.tokens.accessToken });
});

// Triggers playback on a given device
spotifyRoutes.post('/me/player/play', requireSession, async (request, response) => {
  const spotifySession = request.session.spotify;
  const selectedSpotifyUserId = spotifySession?.selectedSpotifyUserId ?? null;
  const account = selectedSpotifyUserId ? spotifySession?.connectedAccounts[selectedSpotifyUserId] : null;
  const deviceId = typeof request.body?.deviceId === 'string' ? request.body.deviceId : undefined;
  const trackUri = typeof request.body?.trackUri === 'string'
    ? request.body.trackUri
    : spotifySession?.connectedAccounts[selectedSpotifyUserId ?? '']?.topTrack?.uri;

  if (!account || !trackUri) {
    response.status(400).json({ error: 'No selected account or track to play' });
    return;
  }

  try {
    await playTrack({ account, trackUri, deviceId });
    response.status(204).end();
  } catch (error) {
    console.error('Error starting playback:', error);
    response.status(502).json({ error: error instanceof Error ? error.message : 'Failed to start playback' });
  }
});