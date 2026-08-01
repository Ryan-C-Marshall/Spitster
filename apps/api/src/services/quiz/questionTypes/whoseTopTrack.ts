import { randomUUID } from 'node:crypto';

import type { SpotifyConnectedAccount, SpotifyTrackSummary, WhoseTopTrackQuestion } from '@spitster/shared';

import { getEnv } from '../../../config/env.js';
import { fetchUsersTopTracks } from '../../spotify/spotifyWebApi.service.js';
import { getOrFetchSpotifyData } from '../../spotify/spotifyDataCache.service.js';
import type { QuestionGenerator } from '../quizGenerator.service.js';

// Need at least two players so there's more than one possible answer.
const MIN_PLAYERS = 2;

const TOP_TRACKS_LIMIT = 200;
const TOP_TRACKS_TIME_RANGE = 'medium_term' as const;

// Local to this generator for now — pull out into a shared fetcher module
// if a second question type ends up needing top tracks too.
interface PlayerTopTracks {
  spotifyUserId: string;
  displayName: string | null;
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

  return {
    spotifyUserId: account.spotifyUserId,
    displayName: account.displayName,
    topTracks,
  };
}

// Spotify can relink the "same" song to a different track id per user (e.g.
// regional/market availability, remasters vs. original releases), so
// comparing by id under-counts matches. Track name + artist name is a much
// more reliable notion of "the same song" for quiz purposes.
function trackSignature(track: Pick<SpotifyTrackSummary, 'name' | 'artists'>): string {
  const normalizedArtists = track.artists
    .map((artist) => artist.name.trim().toLowerCase())
    .sort()
    .join(',');

  return `${track.name.trim().toLowerCase()}::${normalizedArtists}`;
}

export const whoseTopTrackGenerator: QuestionGenerator<WhoseTopTrackQuestion> = {
  type: 'whose-top-track',
  async generate({ accounts }) {
    // Sequential by design (matches the original collector) — keeps
    // Spotify call volume predictable and avoids bursting requests for
    // large player counts. Individual accounts are still cache-backed, so
    // repeat questions don't re-fetch.
    const players: PlayerTopTracks[] = [];
    for (const account of accounts) {
      players.push(await fetchTopTracksForAccount(account));
    }

    const eligiblePlayers = players.filter((player) => player.topTracks.length > 0);

    if (eligiblePlayers.length < MIN_PLAYERS) {
      return null;
    }

    const correctPlayer = pickRandom(eligiblePlayers);
    const track = pickRandom(correctPlayer.topTracks);

    // The same song can appear in more than one player's top tracks (e.g. a
    // couple who both have a favorite song in their top 200) — anyone who
    // has it should count as correct, not just whichever player it was
    // originally drawn from. Matched by name + artist rather than track id,
    // since Spotify can return different ids for what's really the same song.
    const correctTrackSignature = trackSignature(track);
    const correctSpotifyUserIds = eligiblePlayers
      .filter((player) =>
        player.topTracks.some((topTrack) => trackSignature(topTrack) === correctTrackSignature),
      )
      .map((player) => player.spotifyUserId);

    return {
      id: randomUUID(),
      type: 'whose-top-track',
      track,
      options: eligiblePlayers.map((player) => ({
        spotifyUserId: player.spotifyUserId,
        displayName: player.displayName,
      })),
      correctSpotifyUserIds,
    };
  },
};

function pickRandom<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}