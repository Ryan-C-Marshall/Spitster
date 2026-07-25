import type { SpotifyArtistSummary, SpotifyConnectedAccount, SpotifyPlayerCollectedData, SpotifyTrackSummary } from '@spitster/shared';

type SpotifyTrackItemResponse = {
  id: string;
  name: string;
  uri: string;
  artists: Array<{
    id: string;
    name: string;
    uri: string;
  }>;
};

type SpotifyTopTracksResponse = {
  items: SpotifyTrackItemResponse[];
};

async function fetchJson<T>(url: string, accessToken: string): Promise<T> {
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Spotify request failed: ${response.status}`);
  }

  return (await response.json()) as T;
}

export async function fetchPlayerCollectionData(input: {
  account: SpotifyConnectedAccount;
  apiBaseUrl: string;
}): Promise<SpotifyPlayerCollectedData> {
  const topTracks = await fetchJson<SpotifyTopTracksResponse>(
    `${input.apiBaseUrl}/me/top/tracks?limit=10&time_range=medium_term`,
    input.account.tokens.accessToken,
  );

  return {
    spotifyUserId: input.account.spotifyUserId,
    displayName: input.account.displayName,
    topTracks: topTracks.items.map((track): SpotifyTrackSummary => ({
      id: track.id,
      name: track.name,
      uri: track.uri,
      artists: track.artists.map((artist): SpotifyArtistSummary => ({
        id: artist.id,
        name: artist.name,
        uri: artist.uri,
      })),
    })),
  };
}

export async function fetchUsersTopTracks(input: {
  account: SpotifyConnectedAccount;
  apiBaseUrl: string;
  timeRange: 'short_term' | 'medium_term' | 'long_term' | null;
}): Promise<SpotifyTrackSummary[]> {
  if (!input.timeRange) {
    input.timeRange = 'medium_term';
  }

  const topTracks = await fetchJson<SpotifyTopTracksResponse>(
    `${input.apiBaseUrl}/me/top/tracks?limit=10&time_range=${input.timeRange}`,
    input.account.tokens.accessToken,
  );

  return topTracks.items.map((track): SpotifyTrackSummary => ({
    id: track.id,
    name: track.name,
    uri: track.uri,
    artists: track.artists.map((artist): SpotifyArtistSummary => ({
      id: artist.id,
      name: artist.name,
      uri: artist.uri,
    })),
  }));
}


// Playback API
export async function playTrack(input: {
  account: SpotifyConnectedAccount;
  trackUri: string;
  deviceId?: string;
}): Promise<void> {
  const url = new URL('https://api.spotify.com/v1/me/player/play');
  if (input.deviceId) {
    url.searchParams.set('device_id', input.deviceId);
  }

  const response = await fetch(url.toString(), {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${input.account.tokens.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ uris: [input.trackUri] }),
  });

  if (response.status === 204) {
    return; // success — no body
  }
  if (response.status === 404) {
    throw new Error('No active Spotify device found. Open Spotify on a device to play.');
  }
  if (response.status === 403) {
    throw new Error('Playback control requires Spotify Premium.');
  }
  if (!response.ok) {
    throw new Error(`Failed to start playback: ${response.status} ${response.statusText}`);
  }
}