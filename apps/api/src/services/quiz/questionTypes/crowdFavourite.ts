import { randomUUID } from 'node:crypto';

import type { CrowdFavoriteQuestion, SpotifyConnectedAccount, SpotifyTrackSummary } from '@spitster/shared';

import { getEnv } from '../../../config/env.js';
import { fetchUsersTopTracks } from '../../spotify/spotifyWebApi.service.js';
import { getOrFetchSpotifyData } from '../../spotify/spotifyDataCache.service.js';
import { trackSignature } from './trackSignature.js';
import type { QuestionGenerator } from '../quizGenerator.service.js';

const MIN_PLAYERS = 2;

const TOP_TRACKS_LIMIT = 1000;
const TOP_TRACKS_TIME_RANGE = 'medium_term' as const;

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

  return { spotifyUserId: account.spotifyUserId, displayName: account.displayName, topTracks };
}

function binomialCoefficient(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  let result = 1;
  for (let i = 1; i <= k; i += 1) {
    result = (result * (n - k + i)) / i;
  }
  return result;
}

// Picks a track so that, over many calls, each "layer" of the venn diagram
// (songs shared by exactly k of the N players) gets roughly equal
// representation — not each individual song. A song shared by k players is
// therefore weighted proportional to C(N, k): the rarer the layer size is
// among all possible subsets of players, the more each song in it "counts".
// Empty layers (no song is shared by exactly that many players) simply
// don't participate — the weights are normalized over non-empty layers only.
function pickWeightedTrack(
  bySignature: Map<string, { track: SpotifyTrackSummary; ownerSpotifyUserIds: string[] }>,
  playerCount: number,
): { track: SpotifyTrackSummary; ownerSpotifyUserIds: string[] } | null {
  const layers = new Map<number, { track: SpotifyTrackSummary; ownerSpotifyUserIds: string[] }[]>();

  for (const entry of bySignature.values()) {
    const k = entry.ownerSpotifyUserIds.length;
    const layer = layers.get(k);
    if (layer) {
      layer.push(entry);
    } else {
      layers.set(k, [entry]);
    }
  }

  if (layers.size === 0) return null;

  const weightedLayers = [...layers.entries()].map(([k, entries]) => ({
    k,
    entries,
    weight: binomialCoefficient(playerCount, k),
  }));

  const totalWeight = weightedLayers.reduce((sum, layer) => sum + layer.weight, 0);
  if (totalWeight <= 0) return null;

  let roll = Math.random() * totalWeight;
  let chosenLayer = weightedLayers[weightedLayers.length - 1];
  for (const layer of weightedLayers) {
    if (roll < layer.weight) {
      chosenLayer = layer;
      break;
    }
    roll -= layer.weight;
  }

  console.log("Layers + song counts:", weightedLayers.map((layer) => `k=${layer.k}: ${layer.entries.length} songs, weight=${layer.weight}`).join('; '));

  return chosenLayer.entries[Math.floor(Math.random() * chosenLayer.entries.length)];
}

export const crowdFavoriteGenerator: QuestionGenerator<CrowdFavoriteQuestion> = {
  type: 'crowd-favorite',
  // Marks this generator as classic-mode-only — see quizGenerator.service.ts.
  isClassicMode: true,
  async generate({ accounts }) {
    const players = await Promise.all(accounts.map((account) => fetchTopTracksForAccount(account)));

    const eligiblePlayers = players.filter((player) => player.topTracks.length > 0);
    if (eligiblePlayers.length < MIN_PLAYERS) {
      return null;
    }

    // signature -> representative track + every eligible player who has it
    const bySignature = new Map<string, { track: SpotifyTrackSummary; ownerSpotifyUserIds: string[] }>();

    for (const player of eligiblePlayers) {
      const seenForPlayer = new Set<string>(); // guard against dupes within one player's own list
      for (const track of player.topTracks) {
        const signature = trackSignature(track);
        if (seenForPlayer.has(signature)) continue;
        seenForPlayer.add(signature);

        const existing = bySignature.get(signature);
        if (existing) {
          existing.ownerSpotifyUserIds.push(player.spotifyUserId);
        } else {
          bySignature.set(signature, { track, ownerSpotifyUserIds: [player.spotifyUserId] });
        }
      }
    }

    const chosen = pickWeightedTrack(bySignature, eligiblePlayers.length);
    if (!chosen) {
      return null;
    }

    return {
      id: randomUUID(),
      type: 'crowd-favorite',
      track: chosen.track,
      options: eligiblePlayers.map((player) => ({
        spotifyUserId: player.spotifyUserId,
        displayName: player.displayName,
      })),
      correctSpotifyUserIds: chosen.ownerSpotifyUserIds,
    };
  },
};