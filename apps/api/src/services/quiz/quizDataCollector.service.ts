import type { SpotifyConnectedAccount, SpotifyQuizCollectionResult } from '@spitster/shared';

import { getEnv } from '../../config/env.js';
import { fetchUsersTopTracks } from '../spotify/spotifyWebApi.service.js';
import { getOrFetchSpotifyData } from '../spotify/spotifyDataCache.service.js';

const TOP_TRACKS_LIMIT = 200;
const TOP_TRACKS_TIME_RANGE = 'medium_term' as const;

export async function collectQuizSourceData(input: {
  accounts: SpotifyConnectedAccount[];
}): Promise<SpotifyQuizCollectionResult> {
  const env = getEnv();

  const players = [] as SpotifyQuizCollectionResult['players'];

  // Sequential by design (matches the previous loop) — keeps Spotify call
  // volume predictable and avoids bursting requests for large player counts.
  for (const account of input.accounts) {
    const topTracks = await getOrFetchSpotifyData({
      spotifyUserId: account.spotifyUserId,
      dataKind: 'topTracks',
      params: { timeRange: TOP_TRACKS_TIME_RANGE, limit: TOP_TRACKS_LIMIT },
      fetcher: () =>
        fetchUsersTopTracks({
          account,
          apiBaseUrl: env.spotifyApiBaseUrl,
          limit: TOP_TRACKS_LIMIT,
          timeRange: TOP_TRACKS_TIME_RANGE,
        }),
    });

    players.push({
      spotifyUserId: account.spotifyUserId,
      displayName: account.displayName,
      topTracks,
    });
  }

  return {
    players,
  };
}