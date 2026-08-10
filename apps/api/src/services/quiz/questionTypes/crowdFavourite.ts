import { randomUUID } from 'node:crypto';

import type { CrowdFavoriteQuestion, SpotifyConnectedAccount, SpotifyTrackSummary } from '@spitster/shared';

import { getEnv } from '../../../config/env.js';
import {
  fetchPlaylistTracks,
  fetchUsersTopTracks,
  searchPlaylists,
} from '../../spotify/spotifyWebApi.service.js';
import { getOrFetchSpotifyData } from '../../spotify/spotifyDataCache.service.js';
import { trackSignature } from './trackSignature.js';
import type { QuestionGenerator } from '../quizGenerator.service.js';

const MIN_PLAYERS = 2;

// ---------------------------------------------------------------------------
// Track source configuration
//
// Where Crowd Favourite draws each player's "song pool" from is controlled
// by CROWD_FAVORITE_SOURCE below. Two options:
//
//  - 'top-tracks': the classic behaviour — a player's Spotify "Top Tracks"
//    for a given time_range (Spotify's own rolling taste ranking).
//  - 'top-songs-playlist': the Spotify-generated "Your Top Songs [year]"
//    playlist (the one that appears in-app labelled "Made for [Name]").
//    This is a fixed, dated snapshot (~100 songs) rather than a rolling
//    ranking, and — because it's a Spotify-owned playlist rather than one
//    owned by the user — it has to be located via search rather than via
//    the user's own playlist list. See the big comment on
//    fetchTopSongsPlaylistTracks below for an important caveat about
//    whether this actually works for this app.
//
// Change `kind` (and the fields alongside it) to switch sources; nothing
// else in this file needs to change.
// ---------------------------------------------------------------------------
type CrowdFavoriteSourceConfig =
  | {
      kind: 'top-tracks';
      /** Spotify's own ranking window for "top" tracks. */
      timeRange: 'short_term' | 'medium_term' | 'long_term';
      /** How many tracks to pull per player (Spotify pages internally). */
      limit: number;
    }
  | {
      kind: 'top-songs-playlist';
      /** How many tracks to pull from the playlist (it's usually ~100 long). */
      limit: number;
      /**
       * Which year's "Your Top Songs" playlist to use. Leave unset to
       * auto-detect the most recently published one (see
       * guessTopSongsPlaylistYears below).
       */
      year?: number;
    };

const CROWD_FAVORITE_SOURCE: CrowdFavoriteSourceConfig = {
  kind: 'top-tracks',
  timeRange: 'medium_term',
  limit: 1000,
};

interface PlayerTopTracks {
  spotifyUserId: string;
  displayName: string | null;
  topTracks: SpotifyTrackSummary[];
}

async function fetchTopTracksForAccount(account: SpotifyConnectedAccount): Promise<PlayerTopTracks> {
  const topTracks =
    CROWD_FAVORITE_SOURCE.kind === 'top-tracks'
      ? await fetchFromTopTracks(account, CROWD_FAVORITE_SOURCE)
      : await fetchFromTopSongsPlaylist(account, CROWD_FAVORITE_SOURCE);

  console.log('Fetched', topTracks.length, 'tracks for Spotify user', account.spotifyUserId, '(limit requested:', CROWD_FAVORITE_SOURCE.limit, ')');
  topTracks.forEach((track, index) => console.log(account.displayName || account.spotifyUserId, ` - `, index + 1, ` ${track.name} (${track.artists.map((a) => a.name).join(', ')})`));

  return { spotifyUserId: account.spotifyUserId, displayName: account.displayName, topTracks };
}

async function fetchFromTopTracks(
  account: SpotifyConnectedAccount,
  source: Extract<CrowdFavoriteSourceConfig, { kind: 'top-tracks' }>,
): Promise<SpotifyTrackSummary[]> {
  const env = getEnv();

  return getOrFetchSpotifyData({
    spotifyUserId: account.spotifyUserId,
    dataKind: 'topTracks',
    params: { timeRange: source.timeRange, limit: source.limit },
    fetcher: () =>
      fetchUsersTopTracks({
        account,
        apiBaseUrl: env.spotifyApiBaseUrl,
        limit: source.limit,
        timeRange: source.timeRange,
      }),
  });
}

// Wrapped-style "Your Top Songs [year]" playlists are typically published
// in early December, summarizing that same calendar year. Before that
// year's release, the most recent one available is last year's — so we try
// the "most likely" year first and step backwards a couple of years as a
// fallback (covers being asked right around the December cutover, and
// players who don't have a playlist for the most recent year for whatever
// reason).
const WRAPPED_RELEASE_MONTH_INDEX = 11; // December, 0-indexed
const YEARS_TO_TRY = 3;

function guessTopSongsPlaylistYears(explicitYear?: number): number[] {
  if (explicitYear) return [explicitYear];

  const now = new Date();
  const mostLikelyYear =
    now.getUTCMonth() >= WRAPPED_RELEASE_MONTH_INDEX ? now.getUTCFullYear() : now.getUTCFullYear() - 1;

  return Array.from({ length: YEARS_TO_TRY }, (_, i) => mostLikelyYear - i);
}

// The "Your Top Songs [year]" playlist a user sees in-app (labelled "Made
// for [Name]") is owned by Spotify, not by the user — so it never appears
// in `fetchOwnedPlaylists`/`/me/playlists`, whether or not the user has
// saved it to their library. The only way to locate it is by searching for
// it by name and picking the result actually owned by Spotify.
//
// IMPORTANT CAVEAT: as of Spotify's Nov 27, 2024 Web API policy change,
// apps in Development Mode (the default for small/personal apps, and
// effectively the only option for indie projects since extended-quota
// access now requires an organization with 250k+ monthly active users)
// lose access to "Algorithmic and Spotify-owned editorial playlists" —
// which explicitly includes things like this one. In practice that means
// fetching this playlist's tracks (the fetchPlaylistTracks call below) may
// simply 403/404 for every account, regardless of search succeeding. If
// Spitster's Spotify app is still in Development Mode, this source will
// most likely come back empty for everyone. It's implemented here so it's
// ready to go if that ever changes (or if this app has/gets extended
// access) — but it's worth testing directly before relying on it.
async function fetchFromTopSongsPlaylist(
  account: SpotifyConnectedAccount,
  source: Extract<CrowdFavoriteSourceConfig, { kind: 'top-songs-playlist' }>,
): Promise<SpotifyTrackSummary[]> {
  const env = getEnv();
  const candidateYears = guessTopSongsPlaylistYears(source.year);

  return getOrFetchSpotifyData({
    spotifyUserId: account.spotifyUserId,
    dataKind: 'topSongsPlaylistTracks',
    params: { years: candidateYears.join(','), limit: source.limit },
    fetcher: async () => {
      for (const year of candidateYears) {
        try {
          const playlist = await findTopSongsPlaylist(account, env.spotifyApiBaseUrl, year);
          if (!playlist) {
            console.log(
              `No "Your Top Songs ${year}" playlist found via search for Spotify user ${account.spotifyUserId}`,
            );
            continue;
          }

          const tracks = await fetchPlaylistTracks({
            account,
            apiBaseUrl: env.spotifyApiBaseUrl,
            playlistId: playlist.id,
            limit: source.limit,
          });

          if (tracks.length > 0) {
            console.log(
              `Fetched ${tracks.length} tracks from "${playlist.name}" (${year}) for Spotify user ${account.spotifyUserId}`,
            );
            return tracks;
          }
        } catch (error) {
          // Most likely cause: this app doesn't have API access to
          // Spotify-owned/algorithmic playlists (see the caveat above).
          // Don't let one player's failure break question generation for
          // everyone — just treat this player as having no tracks from
          // this source, same as if they had none.
          console.warn(
            `Failed to fetch "Your Top Songs ${year}" playlist tracks for Spotify user ${account.spotifyUserId} — likely blocked by Spotify's restrictions on Development Mode access to Spotify-owned playlists. Error:`,
            error,
          );
        }
      }

      return [];
    },
  });
}

async function findTopSongsPlaylist(
  account: SpotifyConnectedAccount,
  apiBaseUrl: string,
  year: number,
): Promise<{ id: string; name: string } | null> {
  const results = await searchPlaylists({
    account,
    apiBaseUrl,
    query: `Your Top Songs ${year}`,
    limit: 10,
  });

  // Only trust results actually owned by Spotify's own editorial account —
  // otherwise a fan-made playlist with a similar name could slip through.
  const match = results.find(
    (playlist) => playlist.ownerId.toLowerCase() === 'spotify' && playlist.name.includes(String(year)),
  );

  return match ? { id: match.id, name: match.name } : null;
}

function binomialCoefficient(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  let result = 1;
  for (let i = 1; i <= k; i += 1) {
    result = (result * (n - k + i)) / i;
  }
  return result;
}

// Picks a track so that, over many calls, each "layer" in the venn diagram
// (songs shared by exactly k of the N players) gets songs picked proportional 
// to the number of sections in that layer (i.e. the number of ways to choose k 
// players from N). This roughly results in each 'section' in the venn diagram
// being represented proportionally, though similarities / differences in music 
// taste may affect the distribution. A song shared by k players is therefore 
// weighted proportional to C(N, k): the rarer the layer size is among all 
// possible subsets of players, the more each song in it "counts". Empty layers
// (no song is shared by exactly that many players) simply don't participate — 
// the weights are normalized over non-empty layers only.
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
  async generate({ accounts, history }) {
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
        if (history.has(signature)) continue;
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

    history.add(trackSignature(chosen.track));

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