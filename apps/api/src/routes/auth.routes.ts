import { randomBytes, createHash } from 'node:crypto';
import { Router, type NextFunction, type Request, type Response } from 'express';

import type {
  SpotifyConnectedAccountSummary,
  SpotifyTrackSummary,
  SpotifySessionState,
  SpotifySessionSummary,
  SpotifyTokenResponse,
  SpotifyUserProfile,
} from '@spitster/shared';

import { getEnv } from '../config/env.js';
import { SPOTIFY_SCOPE_STRING } from '../config/spotifyScopes.js';
import { createEmptySpotifySessionState } from '../services/spotify/sessionStore.js';
import { fetchUsersTopTracks } from '../services/spotify/spotifyWebApi.service.js';

export const authRoutes = Router();

function base64Url(input: Buffer) {
  return input
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function createPkceChallenge(verifier: string) {
  return base64Url(createHash('sha256').update(verifier).digest());
}

async function fetchSpotifyProfile(accessToken: string, apiBaseUrl: string) {
  const response = await fetch(`${apiBaseUrl}/me`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch Spotify profile');
  }

  return (await response.json()) as SpotifyUserProfile;
}

async function fetchTopTrack(spotifySession: SpotifySessionState, spotifyUserId: string) {

  // get the new user's recent top songs
  const topTracks = await fetchUsersTopTracks({
    account: spotifySession.connectedAccounts[spotifyUserId],
    apiBaseUrl: getEnv().spotifyApiBaseUrl,
    timeRange: 'short_term',
    limit: 1,
  });

  return topTracks.length > 0 ? topTracks[0] : null;
}

authRoutes.get('/login', (request: Request, response: Response) => {
  const env = getEnv();

  if (!env.spotifyClientId || !env.spotifyRedirectUri) {
    response.status(500).json({ error: 'Spotify env vars are not configured' });
    return;
  }

  const codeVerifier = base64Url(randomBytes(32));
  const codeChallenge = createPkceChallenge(codeVerifier);
  const state = base64Url(randomBytes(16));

  request.session.spotify ??= createEmptySpotifySessionState();
  request.session.spotify.pendingAuths[state] = {
    codeVerifier,
    state,
  };

  const authorizeUrl = new URL(env.spotifyAuthorizeUrl);
  authorizeUrl.searchParams.set('client_id', env.spotifyClientId);
  authorizeUrl.searchParams.set('response_type', 'code');
  authorizeUrl.searchParams.set('redirect_uri', env.spotifyRedirectUri);
  authorizeUrl.searchParams.set('scope', SPOTIFY_SCOPE_STRING);
  authorizeUrl.searchParams.set('code_challenge_method', 'S256');
  authorizeUrl.searchParams.set('code_challenge', codeChallenge);
  authorizeUrl.searchParams.set('state', state);
  authorizeUrl.searchParams.set('show_dialog', 'true');

  response.redirect(authorizeUrl.toString());
});

authRoutes.get('/callback', async (request: Request, response: Response, next: NextFunction) => {
  try {
    const env = getEnv();
    const code = typeof request.query.code === 'string' ? request.query.code : null;
    const state = typeof request.query.state === 'string' ? request.query.state : null;
    const authError = typeof request.query.error === 'string' ? request.query.error : null;
    const pendingAuth = state && request.session.spotify?.pendingAuths[state] ? request.session.spotify.pendingAuths[state] : null;

    // The user cancelled the Spotify consent screen (or otherwise denied access).
    // This isn't a real failure, so just clean up and send them back to the lobby.
    if (authError) {
      console.log('Spotify auth callback cancelled by user. Error:', authError);

      if (state && request.session.spotify?.pendingAuths[state]) {
        delete request.session.spotify.pendingAuths[state];
      }

      const cancelledUrl = new URL(env.frontendOrigin);
      cancelledUrl.searchParams.set('auth', 'cancelled');
      response.redirect(cancelledUrl.toString());
      return;
    }

    if (!code) {
      response.status(400).json({ error: 'Invalid auth callback. Missing code.' });
      return;
    }

    if (!state) {
      response.status(400).json({ error: 'Invalid auth callback. Missing state.' });
      return;
    }

    if (!pendingAuth) {
      response.status(400).json({ error: 'Invalid auth callback. State does not match any pending auths.' });
      return;
    }

    if (!env.spotifyClientId || !env.spotifyRedirectUri) {
      response.status(500).json({ error: 'Spotify env vars are not configured' });
      return;
    }

    const tokenResponse = await fetch(env.spotifyTokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: env.spotifyClientId,
        grant_type: 'authorization_code',
        code,
        redirect_uri: env.spotifyRedirectUri,
        code_verifier: pendingAuth.codeVerifier,
      }),
    });

    if (!tokenResponse.ok) {
      response.status(502).json({ error: 'Spotify token exchange failed' });
      return;
    }

    const tokens = (await tokenResponse.json()) as SpotifyTokenResponse;
    const profile = await fetchSpotifyProfile(tokens.access_token, env.spotifyApiBaseUrl);

    console.log('Spotify auth callback successful. Profile:', profile);

    request.session.spotify ??= createEmptySpotifySessionState();
    delete request.session.spotify.pendingAuths[state];

    request.session.spotify.connectedAccounts[profile.id] = {
      spotifyUserId: profile.id,
      displayName: profile.display_name,
      username: profile.id,
      topTrack: null,
      tokens: {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt: Date.now() + tokens.expires_in * 1000,
        scope: tokens.scope,
        tokenType: tokens.token_type,
      },
    };

    // Need tokens to fetch top track
    const topTrack = await fetchTopTrack(request.session.spotify, profile.id);
    request.session.spotify.connectedAccounts[profile.id].topTrack = topTrack;

    // First account connected in this session becomes the playback host.
    // Intentionally never overwritten by later logins.
    request.session.spotify.hostSpotifyUserId ??= profile.id;

    const redirectUrl = new URL(env.frontendOrigin);
    redirectUrl.searchParams.set('auth', 'success');
    redirectUrl.searchParams.set('accountId', profile.id);
    response.redirect(redirectUrl.toString());
  } catch (error) {
    console.error('Error during Spotify auth callback:', error);
    
    const env = getEnv();
    const redirectUrl = new URL(env.frontendOrigin);
    redirectUrl.searchParams.set('auth', 'failed');
    redirectUrl.searchParams.set('message', 'Failed to retrieve that player\'s Spotify account.');
    response.redirect(redirectUrl.toString());
  }
});

authRoutes.get('/session', (request: Request, response: Response) => {
  const spotifySession = request.session.spotify;
  const connectedAccounts = Object.values(spotifySession?.connectedAccounts ?? {});

  response.json({
    authenticated: connectedAccounts.length > 0,
    hostSpotifyUserId: spotifySession?.hostSpotifyUserId ?? null,
    connectedAccounts: connectedAccounts.map(
      (account): SpotifyConnectedAccountSummary => ({
        spotifyUserId: account.spotifyUserId,
        displayName: account.displayName,
        username: account.username,
        topTrack: account.topTrack,
        isHost: account.spotifyUserId === spotifySession?.hostSpotifyUserId,
      }),
    ),
  } satisfies SpotifySessionSummary);
});

authRoutes.post('/logout', (request: Request, response: Response) => {
  request.session.destroy(() => {
    response.status(204).end();
  });
});