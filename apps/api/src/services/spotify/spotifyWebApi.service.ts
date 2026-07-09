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