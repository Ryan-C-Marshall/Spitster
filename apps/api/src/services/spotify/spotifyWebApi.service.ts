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

// Spotify caps this endpoint at 50 items per request, but supports paging
// further via `offset` — so a caller-requested `limit` beyond 50 is served
// by making enough successive requests (bumping offset by 50 each time)
// until we've collected enough tracks or Spotify runs out of ranked tracks
// for this user (a page returning fewer items than requested means we've
// hit the end of their list).
const SPOTIFY_TOP_TRACKS_PAGE_SIZE = 50;

export async function fetchPlayerCollectionData(input: {
  account: SpotifyConnectedAccount;
  apiBaseUrl: string;
  limit?: number;
  timeRange?: 'short_term' | 'medium_term' | 'long_term';
}): Promise<SpotifyPlayerCollectedData> {
  const topTracks = await fetchUsersTopTracks({
    account: input.account,
    apiBaseUrl: input.apiBaseUrl,
    timeRange: input.timeRange ?? 'medium_term',
    limit: input.limit ?? SPOTIFY_TOP_TRACKS_PAGE_SIZE,
  });

  return {
    spotifyUserId: input.account.spotifyUserId,
    displayName: input.account.displayName,
    topTracks,
  };
}

export async function fetchUsersTopTracks(input: {
  account: SpotifyConnectedAccount;
  apiBaseUrl: string;
  timeRange: 'short_term' | 'medium_term' | 'long_term' | null;
  limit?: number;
}): Promise<SpotifyTrackSummary[]> {
  const timeRange = input.timeRange ?? 'medium_term';
  const totalLimit = input.limit ?? SPOTIFY_TOP_TRACKS_PAGE_SIZE;

  const tracks: SpotifyTrackSummary[] = [];
  let offset = 0;

  while (tracks.length < totalLimit) {
    const pageLimit = Math.min(SPOTIFY_TOP_TRACKS_PAGE_SIZE, totalLimit - tracks.length);

    const page = await fetchJson<SpotifyTopTracksResponse>(
      `${input.apiBaseUrl}/me/top/tracks?limit=${pageLimit}&offset=${offset}&time_range=${timeRange}`,
      input.account.tokens.accessToken,
    );

    tracks.push(
      ...page.items.map((track): SpotifyTrackSummary => ({
        id: track.id,
        name: track.name,
        uri: track.uri,
        artists: track.artists.map((artist): SpotifyArtistSummary => ({
          id: artist.id,
          name: artist.name,
          uri: artist.uri,
        })),
      })),
    );

    offset += pageLimit;

    // Fewer items than we asked for means we've reached the end of this
    // user's ranked list — no point paging further.
    if (page.items.length < pageLimit) {
      break;
    }
  }

  console.log(`Fetched ${tracks.length} top tracks for Spotify user ${input.account.spotifyUserId} (limit requested: ${totalLimit})`);
  console.log('Top tracks:', tracks);

  return tracks;
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