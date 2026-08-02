import { randomUUID } from 'node:crypto';

import type {
  GuessThePlaylistQuestion,
  PlaylistOption,
  SpotifyConnectedAccount,
  SpotifyTrackSummary,
} from '@spitster/shared';

import { getEnv } from '../../../config/env.js';
import {
  fetchOwnedPlaylists,
  fetchPlaylistTracks,
  type SpotifyPlaylistSummary,
} from '../../spotify/spotifyWebApi.service.js';
import { getOrFetchSpotifyData } from '../../spotify/spotifyDataCache.service.js';
import type { QuestionGenerator } from '../quizGenerator.service.js';

// Need at least 4 distinct playlists pooled across every connected
// account's own playlists to fill one correct + three decoy options.
const MIN_PLAYLISTS_IN_POOL = 4;
const MIN_TRACKS_IN_CORRECT_PLAYLIST = 3;
const TRACKS_TO_ASK_ABOUT = 3;
const DECOY_COUNT = 3;

const PLAYLISTS_LIMIT = 100;
const PLAYLIST_TRACKS_LIMIT = 100;

interface PooledPlaylist extends SpotifyPlaylistSummary {
  ownerSpotifyUserId: string;
}

async function fetchPlaylistsForAccount(account: SpotifyConnectedAccount): Promise<PooledPlaylist[]> {
  const env = getEnv();

  const playlists = await getOrFetchSpotifyData({
    spotifyUserId: account.spotifyUserId,
    dataKind: 'ownedPlaylists',
    fetcher: () =>
      fetchOwnedPlaylists({ account, apiBaseUrl: env.spotifyApiBaseUrl, limit: PLAYLISTS_LIMIT }),
  });

  console.log(`Fetched ${playlists.length} owned playlists for Spotify user ${account.spotifyUserId} (limit requested: ${PLAYLISTS_LIMIT})`);
  console.log('Owned playlists:', playlists);

  return playlists.map((playlist) => ({ ...playlist, ownerSpotifyUserId: account.spotifyUserId }));
}

async function fetchTracksForPlaylist(
  account: SpotifyConnectedAccount,
  playlistId: string,
): Promise<SpotifyTrackSummary[]> {
  const env = getEnv();

  return getOrFetchSpotifyData({
    spotifyUserId: account.spotifyUserId,
    dataKind: 'playlistTracks',
    params: { playlistId },
    fetcher: () =>
      fetchPlaylistTracks({
        account,
        apiBaseUrl: env.spotifyApiBaseUrl,
        playlistId,
        limit: PLAYLIST_TRACKS_LIMIT,
      }),
  });
}

export const guessThePlaylistGenerator: QuestionGenerator<GuessThePlaylistQuestion> = {
  type: 'guess-the-playlist',
  async generate({ accounts }) {
    const accountsByUserId = new Map(accounts.map((account) => [account.spotifyUserId, account]));

    // Fetched in parallel — see whoseTopTrack.ts for why sequential
    // per-account fetching isn't needed. Each account's playlist list is
    // cache-backed so repeat questions don't re-fetch it. Accounts with no
    // owned playlists simply contribute nothing to the pool.
    const pooledResults = await Promise.all(accounts.map((account) => fetchPlaylistsForAccount(account)));
    const pool: PooledPlaylist[] = pooledResults.flat();

    if (pool.length < MIN_PLAYLISTS_IN_POOL) {
      return null;
    }

    // Only playlists with enough *listed* tracks are worth fetching as a
    // correct-answer candidate — though that count can still overstate
    // what's actually usable (local files, removed tracks), so it's a
    // pre-filter, not a guarantee. Decoys don't need this at all, since
    // they're never played.
    const correctCandidates = shuffle(
      pool.filter((playlist) => playlist.trackCount >= MIN_TRACKS_IN_CORRECT_PLAYLIST),
    );

    let correctPlaylist: PooledPlaylist | null = null;
    let sampledTracks: SpotifyTrackSummary[] = [];

    for (const candidate of correctCandidates) {
      const account = accountsByUserId.get(candidate.ownerSpotifyUserId);
      if (!account) continue; // defensive; shouldn't happen

      const tracks = dedupeById(await fetchTracksForPlaylist(account, candidate.id));
      if (tracks.length < MIN_TRACKS_IN_CORRECT_PLAYLIST) continue;

      correctPlaylist = candidate;
      sampledTracks = pickRandomDistinct(tracks, TRACKS_TO_ASK_ABOUT);
      break;
    }

    if (!correctPlaylist) {
      return null;
    }

    const decoyPool = pool.filter((playlist) => playlist.id !== correctPlaylist!.id);
    if (decoyPool.length < DECOY_COUNT) {
      return null;
    }

    const decoys = pickRandomDistinct(decoyPool, DECOY_COUNT);

    const options: PlaylistOption[] = shuffle([
      toPlaylistOption(correctPlaylist),
      ...decoys.map(toPlaylistOption),
    ]);

    return {
      id: randomUUID(),
      type: 'guess-the-playlist',
      tracks: sampledTracks,
      options,
      correctPlaylistId: correctPlaylist.id,
    };
  },
};

function toPlaylistOption(playlist: PooledPlaylist): PlaylistOption {
  return {
    playlistId: playlist.id,
    name: playlist.name,
    ownerSpotifyUserId: playlist.ownerSpotifyUserId,
    ownerDisplayName: playlist.ownerDisplayName,
  };
}

function dedupeById(tracks: SpotifyTrackSummary[]): SpotifyTrackSummary[] {
  const seen = new Set<string>();
  return tracks.filter((track) => (seen.has(track.id) ? false : (seen.add(track.id), true)));
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