import { Router } from 'express';

import { requireSession } from '../middleware/requireSession.js';
import { playTrack } from '../services/spotify/spotifyWebApi.service.js';
import { ensureFreshToken, SpotifyReauthRequiredError } from '../services/spotify/tokenRefresh.service.js';

export const spotifyRoutes = Router();

spotifyRoutes.get('/me', requireSession, async (request, response) => {
  response.json({
    hostSpotifyUserId: request.session.spotify?.hostSpotifyUserId ?? null,
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
  const hostSpotifyUserId = request.session.spotify?.hostSpotifyUserId ?? null;
  const account = hostSpotifyUserId
    ? request.session.spotify?.connectedAccounts[hostSpotifyUserId]
    : null;

  if (!account) {
    response.status(400).json({ error: 'No host Spotify account connected yet' });
    return;
  }

  try {
    await ensureFreshToken(account);
  } catch (error) {
    if (error instanceof SpotifyReauthRequiredError) {
      response.status(409).json({ error: 'Host needs to reconnect their Spotify account' });
      return;
    }
    throw error;
  }

  response.json({ accessToken: account.tokens.accessToken });
});

// Triggers playback on a given device
spotifyRoutes.post('/me/player/play', requireSession, async (request, response) => {
  const spotifySession = request.session.spotify;
  const hostSpotifyUserId = spotifySession?.hostSpotifyUserId ?? null;
  const account = hostSpotifyUserId ? spotifySession?.connectedAccounts[hostSpotifyUserId] : null;
  const deviceId = typeof request.body?.deviceId === 'string' ? request.body.deviceId : undefined;
  const trackUri = typeof request.body?.trackUri === 'string' ? request.body.trackUri : undefined;

  if (!account || !trackUri) {
    response.status(400).json({ error: 'No host account connected or no track to play' });
    return;
  }

  try {
    await ensureFreshToken(account);
    await playTrack({ account, trackUri, deviceId });
    response.status(204).end();
  } catch (error) {
    if (error instanceof SpotifyReauthRequiredError) {
      response.status(409).json({ error: 'Host needs to reconnect their Spotify account' });
      return;
    }
    console.error('Error starting playback:', error);
    response.status(502).json({ error: error instanceof Error ? error.message : 'Failed to start playback' });
  }
});