import { randomUUID } from 'node:crypto';

import type { OffTheChartQuestion, SpotifyConnectedAccount, SpotifyTrackSummary } from '@spitster/shared';

import { getEnv } from '../../../config/env.js';
import { fetchUsersTopTracks } from '../../spotify/spotifyWebApi.service.js';
import { getOrFetchSpotifyData } from '../../spotify/spotifyDataCache.service.js';
import type { QuestionGenerator } from '../quizGenerator.service.js';
import { trackSignature } from './trackSignature.js';

const TOP_TRACKS_LIMIT = 500;
const TOP_TRACKS_TIME_RANGE = 'short_term' as const;
const TOP_HUNDRED_CUTOFF = 100;

const DECOY_COUNT = 3; // top-100 songs shown alongside the one that isn't
const MIN_TOP_HUNDRED_UNUSED = DECOY_COUNT;
const MIN_OUTSIDE_TOP_HUNDRED_UNUSED = 1;

interface PlayerTopTracks {
  spotifyUserId: string;
  displayName: string | null;
  // Spotify's top-tracks endpoint returns tracks in rank order, so slicing
  // the first 100 off a short-term/500 fetch *is* the player's top 100 —
  // no separate request needed.
  topHundred: SpotifyTrackSummary[];
  outsideTopHundred: SpotifyTrackSummary[];
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
    topHundred: topTracks.slice(0, TOP_HUNDRED_CUTOFF),
    outsideTopHundred: topTracks.slice(TOP_HUNDRED_CUTOFF),
  };
}

// This generator's answer history is scoped per-player rather than shared
// globally (contrast with e.g. whoseTopTrack, where one bucket covers every
// player) — a song burned as an option for one player shouldn't stop it
// from being offered for a different player. Namespacing the history key
// with the player's Spotify user id is enough to get that scoping out of
// the existing flat AnswerHistory bucket, with no changes needed there.
function historyKeyFor(spotifyUserId: string, track: SpotifyTrackSummary): string {
  return `${spotifyUserId}::${trackSignature(track)}`;
}

export const offTheChartGenerator: QuestionGenerator<OffTheChartQuestion> = {
  type: 'off-the-chart',
  async generate({ accounts, history }) {
    // Fetched in parallel — see whoseTopTrack.ts for why sequential
    // per-account fetching isn't needed. Cache-backed per account.
    const players = await Promise.all(accounts.map((account) => fetchTopTracksForAccount(account)));

    const eligiblePlayers = players
      .map((player) => ({
        player,
        unusedTopHundred: dedupeBySignature(player.topHundred).filter(
          (track) => !history.has(historyKeyFor(player.spotifyUserId, track)),
        ),
        unusedOutsideTopHundred: dedupeBySignature(player.outsideTopHundred).filter(
          (track) => !history.has(historyKeyFor(player.spotifyUserId, track)),
        ),
      }))
      .filter(
        (entry) =>
          entry.unusedTopHundred.length >= MIN_TOP_HUNDRED_UNUSED &&
          entry.unusedOutsideTopHundred.length >= MIN_OUTSIDE_TOP_HUNDRED_UNUSED,
      );

    if (eligiblePlayers.length === 0) {
      return null;
    }

    const { player, unusedTopHundred, unusedOutsideTopHundred } = pickRandom(eligiblePlayers);

    const correctTrack = pickRandom(unusedOutsideTopHundred);
    const decoyTracks = pickRandomDistinct(unusedTopHundred, DECOY_COUNT);

    const options = shuffle([correctTrack, ...decoyTracks]);

    // Every song shown as an option this round — whether it was the
    // correct out-of-top-100 answer or a top-100 decoy — is burned for
    // this player so it can never come up as an option for them again.
    for (const track of options) {
      history.add(historyKeyFor(player.spotifyUserId, track));
    }

    return {
      id: randomUUID(),
      type: 'off-the-chart',
      spotifyUserId: player.spotifyUserId,
      displayName: player.displayName,
      options,
      correctTrackId: correctTrack.id,
    };
  },
};

function dedupeBySignature(tracks: SpotifyTrackSummary[]): SpotifyTrackSummary[] {
  const seen = new Set<string>();
  return tracks.filter((track) => {
    const signature = trackSignature(track);
    if (seen.has(signature)) return false;
    seen.add(signature);
    return true;
  });
}

function pickRandom<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function pickRandomDistinct<T>(items: T[], count: number): T[] {
  return shuffle(items).slice(0, count);
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}