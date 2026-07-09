import type { SpotifyConnectedAccount, SpotifyQuizCollectionResult } from '@spitster/shared';

import { getEnv } from '../../config/env.js';
import { fetchPlayerCollectionData } from '../spotify/spotifyWebApi.service.js';

export async function collectQuizSourceData(input: {
  accounts: SpotifyConnectedAccount[];
}): Promise<SpotifyQuizCollectionResult> {
  const env = getEnv();

  const players = [] as SpotifyQuizCollectionResult['players'];

  for (const account of input.accounts) {
    players.push(
      await fetchPlayerCollectionData({
        account,
        apiBaseUrl: env.spotifyApiBaseUrl,
      }),
    );
  }

  return {
    players,
  };
}