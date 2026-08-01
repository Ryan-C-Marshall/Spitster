import type { SpotifyConnectedAccount, SpotifyTokenResponse } from '@spitster/shared';
import { getEnv } from '../../config/env.js';

// Refresh a little before actual expiry so an in-flight request never gets
// caught using a token that dies mid-call.
const EXPIRY_BUFFER_MS = 60_000;

export class SpotifyReauthRequiredError extends Error {
  constructor(public spotifyUserId: string) {
    super(`Spotify account ${spotifyUserId} needs to reconnect`);
    this.name = 'SpotifyReauthRequiredError';
  }
}

function isExpiringSoon(account: SpotifyConnectedAccount): boolean {
  return Date.now() >= account.tokens.expiresAt - EXPIRY_BUFFER_MS;
}

async function refreshAccessToken(account: SpotifyConnectedAccount): Promise<void> {
  const env = getEnv();

  if (!env.spotifyClientId) {
    throw new Error('Spotify env vars are not configured');
  }
  if (!account.tokens.refreshToken) {
    throw new SpotifyReauthRequiredError(account.spotifyUserId);
  }

  const response = await fetch(env.spotifyTokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.spotifyClientId,
      grant_type: 'refresh_token',
      refresh_token: account.tokens.refreshToken,
    }),
  });

  // Spotify returns these when the refresh token itself is invalid/revoked —
  // no amount of retrying fixes that, the account needs to reconnect.
  if (response.status === 400 || response.status === 401) {
    throw new SpotifyReauthRequiredError(account.spotifyUserId);
  }
  if (!response.ok) {
    throw new Error(`Spotify token refresh failed: ${response.status}`);
  }

  const tokens = (await response.json()) as SpotifyTokenResponse;

  account.tokens = {
    accessToken: tokens.access_token,
    // Spotify only rotates the refresh token sometimes — keep the old one
    // when it doesn't send a new one, since it's still valid.
    refreshToken: tokens.refresh_token ?? account.tokens.refreshToken,
    expiresAt: Date.now() + tokens.expires_in * 1000,
    scope: tokens.scope,
    tokenType: tokens.token_type,
  };
}

// De-dupes concurrent refreshes for the same account (e.g. the SDK's
// getOAuthToken and a quiz-question fetch landing at the same moment) so we
// don't fire two refresh requests and risk the second invalidating the
// first's brand-new token via rotation.
const inFlightRefreshes = new Map<string, Promise<void>>();

async function refreshOnce(account: SpotifyConnectedAccount): Promise<void> {
  const existing = inFlightRefreshes.get(account.spotifyUserId);
  if (existing) return existing;

  const promise = refreshAccessToken(account).finally(() => {
    inFlightRefreshes.delete(account.spotifyUserId);
  });

  inFlightRefreshes.set(account.spotifyUserId, promise);
  return promise;
}

/**
 * Ensures `account` — a reference into the session's connectedAccounts map —
 * has a non-expired access token, refreshing in place if needed. Mutating in
 * place means express-session persists the new tokens automatically.
 */
export async function ensureFreshToken(account: SpotifyConnectedAccount): Promise<SpotifyConnectedAccount> {
  if (isExpiringSoon(account)) {
    await refreshOnce(account);
  }
  return account;
}

export async function ensureFreshTokens(accounts: SpotifyConnectedAccount[]): Promise<SpotifyConnectedAccount[]> {
  await Promise.all(accounts.map((account) => ensureFreshToken(account)));
  return accounts;
}