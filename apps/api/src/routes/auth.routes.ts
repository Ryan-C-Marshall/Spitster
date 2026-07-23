import { randomBytes, createHash } from 'node:crypto';
import { Router, type NextFunction, type Request, type Response } from 'express';

import type {
  SpotifyConnectedAccountSummary,
  SpotifySessionSummary,
  SpotifyTokenResponse,
  SpotifyUserProfile,
} from '@spitster/shared';

import { getEnv } from '../config/env.js';
import { SPOTIFY_SCOPE_STRING } from '../config/spotifyScopes.js';
import { createEmptySpotifySessionState } from '../services/spotify/sessionStore.js';

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

authRoutes.get('/login', (request: Request, response: Response) => {
  console.log('Spotify login initiated. Request session:', request.session);
  const env = getEnv();
  console.log('Spotify login initiated. Env vars:', {
    ...env
  });
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

  response.redirect(authorizeUrl.toString());
});

authRoutes.get('/callback', async (request: Request, response: Response, next: NextFunction) => {
  try {
    const env = getEnv();
    const code = typeof request.query.code === 'string' ? request.query.code : null;
    const state = typeof request.query.state === 'string' ? request.query.state : null;
    const pendingAuth = state && request.session.spotify?.pendingAuths[state] ? request.session.spotify.pendingAuths[state] : null;

    console.log('Spotify auth callback recieved. Vars:', {
      "code": code,
      "state": state,
      "pendingAuth": pendingAuth,
    });

    if (!code) {
      response.status(400).json({ error: 'Invalid auth callback. Missing code.' });
      return;
    }

    if (!state) {
      response.status(400).json({ error: 'Invalid auth callback. Missing state.' });
      return;
    }

    // Removed this as it doesn't seem necessary
    // if (!pendingAuth) {
    //   response.status(400).json({ error: 'Invalid auth callback. State does not match any pending auths.' });
    //   return;
    // }

    if (!env.spotifyClientId || !env.spotifyRedirectUri) {
      response.status(500).json({ error: 'Spotify env vars are not configured' });
      return;
    }

    console.log('Spotify auth callback proceeding with token exchange.');

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

    console.log('Spotify token exchange response status:', tokenResponse.status);

    if (!tokenResponse.ok) {
      response.status(502).json({ error: 'Spotify token exchange failed' });
      return;
    }

    const tokens = (await tokenResponse.json()) as SpotifyTokenResponse;
    const profile = await fetchSpotifyProfile(tokens.access_token, env.spotifyApiBaseUrl);

    request.session.spotify ??= createEmptySpotifySessionState();
    delete request.session.spotify.pendingAuths[state];
    request.session.spotify.connectedAccounts[profile.id] = {
      spotifyUserId: profile.id,
      displayName: profile.display_name,
      username: profile.id,
      tokens: {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt: Date.now() + tokens.expires_in * 1000,
        scope: tokens.scope,
        tokenType: tokens.token_type,
      },
    };
    request.session.spotify.selectedSpotifyUserId = profile.id;
    request.session.spotify.quizPreparation = null;

    const redirectUrl = new URL(env.frontendOrigin);
    redirectUrl.searchParams.set('auth', 'success');
    redirectUrl.searchParams.set('accountId', profile.id);
    response.redirect(redirectUrl.toString());
  } catch (error) {
    const env = getEnv();
    const redirectUrl = new URL('/auth/callback', env.frontendOrigin);
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
    selectedSpotifyUserId: spotifySession?.selectedSpotifyUserId ?? null,
    quizPreparation: spotifySession?.quizPreparation ?? null,
    connectedAccounts: connectedAccounts.map(
      (account): SpotifyConnectedAccountSummary => ({
        spotifyUserId: account.spotifyUserId,
        displayName: account.displayName,
        username: account.username,
      }),
    ),
  } satisfies SpotifySessionSummary);
});

authRoutes.post('/accounts/select', (request: Request, response: Response) => {
  const spotifyUserId = typeof request.body?.spotifyUserId === 'string' ? request.body.spotifyUserId : null;
  const spotifySession = request.session.spotify;

  if (!spotifySession || !spotifyUserId || !spotifySession.connectedAccounts[spotifyUserId]) {
    response.status(400).json({ error: 'Invalid Spotify account selection' });
    return;
  }

  spotifySession.selectedSpotifyUserId = spotifyUserId;
  response.json({
    selectedSpotifyUserId: spotifyUserId,
  });
});

authRoutes.post('/logout', (request: Request, response: Response) => {
  request.session.destroy(() => {
    response.status(204).end();
  });
});
