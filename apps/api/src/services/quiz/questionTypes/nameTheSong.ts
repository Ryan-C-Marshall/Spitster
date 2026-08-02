import { randomUUID } from 'node:crypto';

import type {
  NameTheArtistQuestion,
  NameTheTitleQuestion,
  SpotifyConnectedAccount,
  SpotifyTrackSummary,
} from '@spitster/shared';

import { getEnv } from '../../../config/env.js';
import { fetchUsersTopTracks } from '../../spotify/spotifyWebApi.service.js';
import { getOrFetchSpotifyData } from '../../spotify/spotifyDataCache.service.js';
import { trackSignature } from './trackSignature.js';
import type { QuestionGenerator } from '../quizGenerator.service.js';

const MIN_PLAYERS = 2;
const MIN_PLAYERS_SHARING_TRACK = 2;

const TOP_TRACKS_LIMIT = 1000;
const TOP_TRACKS_TIME_RANGE = 'long_term' as const;

interface PlayerTopTracks {
  spotifyUserId: string;
  topTracks: SpotifyTrackSummary[];
}

async function fetchTopTracksForAccount(account: SpotifyConnectedAccount): Promise<PlayerTopTracks> {
  const env = getEnv();

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

  return { spotifyUserId: account.spotifyUserId, topTracks };
}

// Shared core: builds the pool of "songs at least two players have in their
// long-term top 1000" and picks one. Both question types wrap this — they
// only differ in the `type` literal they stamp on the result.
async function pickSharedTrack(accounts: SpotifyConnectedAccount[]): Promise<SpotifyTrackSummary | null> {
  const players: PlayerTopTracks[] = [];
  for (const account of accounts) {
    players.push(await fetchTopTracksForAccount(account));
  }

  const eligiblePlayers = players.filter((player) => player.topTracks.length > 0);
  if (eligiblePlayers.length < MIN_PLAYERS) {
    return null;
  }

  // signature -> (representative track, count of players who have it)
  const bySignature = new Map<string, { track: SpotifyTrackSummary; ownerCount: number }>();

  for (const player of eligiblePlayers) {
    const seenForPlayer = new Set<string>(); // guard against dupes within one player's own list
    for (const track of player.topTracks) {
      const signature = trackSignature(track);
      if (seenForPlayer.has(signature)) continue;
      seenForPlayer.add(signature);

      const existing = bySignature.get(signature);
      if (existing) {
        existing.ownerCount += 1;
      } else {
        bySignature.set(signature, { track, ownerCount: 1 });
      }
    }
  }

  const pool = [...bySignature.values()]
    .filter((entry) => entry.ownerCount >= MIN_PLAYERS_SHARING_TRACK)
    .map((entry) => entry.track);

  if (pool.length === 0) {
    return null;
  }

  return pool[Math.floor(Math.random() * pool.length)];
}

export const nameTheTitleGenerator: QuestionGenerator<NameTheTitleQuestion> = {
  type: 'name-the-title',
  async generate({ accounts }) {
    const track = await pickSharedTrack(accounts);
    if (!track) return null;
    return { id: randomUUID(), type: 'name-the-title', track };
  },
};

export const nameTheArtistGenerator: QuestionGenerator<NameTheArtistQuestion> = {
  type: 'name-the-artist',
  async generate({ accounts }) {
    const track = await pickSharedTrack(accounts);
    if (!track) return null;
    return { id: randomUUID(), type: 'name-the-artist', track };
  },
};