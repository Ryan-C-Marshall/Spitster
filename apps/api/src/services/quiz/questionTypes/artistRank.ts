import { randomUUID } from 'node:crypto';

import type {
  ArtistRankOption,
  ArtistRankPlayerRank,
  ArtistRankQuestion,
  SpotifyArtistSummary,
  SpotifyConnectedAccount,
} from '@spitster/shared';

import { getEnv } from '../../../config/env.js';
import { fetchUsersTopArtists } from '../../spotify/spotifyWebApi.service.js';
import { getOrFetchSpotifyData } from '../../spotify/spotifyDataCache.service.js';
import type { QuestionGenerator } from '../quizGenerator.service.js';

// Need at least two players for there to be any point comparing ranks.
const MIN_PLAYERS = 2;

// An artist only qualifies as a correct answer if it shows up in at least
// two players' top-200 lists — otherwise "here's everyone's rank" would
// only ever have one non-"unranked" entry.
const MIN_PLAYERS_SHARING_ARTIST = 2;

const DECOY_COUNT = 3;
const TOP_ARTISTS_LIMIT = 200;
const TOP_ARTISTS_TIME_RANGE = 'medium_term' as const;

interface PlayerTopArtists {
  spotifyUserId: string;
  displayName: string | null;
  // Ranked, index 0 = rank 1.
  topArtists: SpotifyArtistSummary[];
}

async function fetchTopArtistsForAccount(account: SpotifyConnectedAccount): Promise<PlayerTopArtists> {
  const env = getEnv();

  const topArtists = await getOrFetchSpotifyData({
    spotifyUserId: account.spotifyUserId,
    dataKind: 'topArtists',
    params: { timeRange: TOP_ARTISTS_TIME_RANGE, limit: TOP_ARTISTS_LIMIT },
    fetcher: () =>
      fetchUsersTopArtists({
        account,
        apiBaseUrl: env.spotifyApiBaseUrl,
        limit: TOP_ARTISTS_LIMIT,
        timeRange: TOP_ARTISTS_TIME_RANGE,
      }),
  });

  console.log(`Fetched top artists for ${account.displayName ?? account.spotifyUserId}: ${topArtists.length} artists`);
  console.log(`Top artists: ${topArtists.map((artist) => artist.name).join(', ')}`);

  return {
    spotifyUserId: account.spotifyUserId,
    displayName: account.displayName,
    topArtists,
  };
}

export const artistRankGenerator: QuestionGenerator<ArtistRankQuestion> = {
  type: 'artist-rank',
  async generate({ accounts, history }) {
    // Fetched in parallel — see whoseTopTrack.ts for why sequential
    // per-account fetching isn't needed. Per-account results are
    // cache-backed.
    const players = await Promise.all(accounts.map((account) => fetchTopArtistsForAccount(account)));

    const eligiblePlayers = players.filter((player) => player.topArtists.length > 0);
    if (eligiblePlayers.length < MIN_PLAYERS) {
      return null;
    }

    // Per-player rank lookup (artistId -> 1-indexed rank), plus a deduped
    // artist pool across everyone — the pool doubles as the decoy source.
    const ranksByPlayer = new Map<string, Map<string, number>>();
    const artistPool = new Map<string, SpotifyArtistSummary>();

    for (const player of eligiblePlayers) {
      const ranks = new Map<string, number>();
      player.topArtists.forEach((artist, index) => {
        ranks.set(artist.id, index + 1);
        if (!artistPool.has(artist.id)) {
          artistPool.set(artist.id, artist);
        }
      });
      ranksByPlayer.set(player.spotifyUserId, ranks);
    }

    // Correct-answer candidates: artists ranked by at least two players.
    const correctCandidates: SpotifyArtistSummary[] = [];
    for (const artist of artistPool.values()) {
      let sharedByCount = 0;
      for (const ranks of ranksByPlayer.values()) {
        if (ranks.has(artist.id)) sharedByCount += 1;
      }
      if (sharedByCount >= MIN_PLAYERS_SHARING_ARTIST) {
        correctCandidates.push(artist);
      }
    }

    console.log("Correct candidates for 'artist-rank' question:", correctCandidates.map((artist) => artist.name).join(', '));

    const unusedCorrectCandidates = correctCandidates.filter((artist) => !history.has(artist.id));

    if (unusedCorrectCandidates.length === 0) {      
      return null;
    }

    const correctArtist = pickRandom(unusedCorrectCandidates);

    const playerRanks: ArtistRankPlayerRank[] = eligiblePlayers.map((player) => ({
      spotifyUserId: player.spotifyUserId,
      displayName: player.displayName,
      rank: ranksByPlayer.get(player.spotifyUserId)?.get(correctArtist.id) ?? null,
    }));

    // Requirement: at least one decoy must be an artist shared by 2+ players.
    const sharedDecoyPool = correctCandidates.filter((artist) => artist.id !== correctArtist.id);

    const guaranteedDecoys: SpotifyArtistSummary[] = [];
    if (sharedDecoyPool.length > 0) {
      guaranteedDecoys.push(pickRandom(sharedDecoyPool));
    }

    const remainingPool = [...artistPool.values()].filter(
      (artist) => artist.id !== correctArtist.id && !guaranteedDecoys.some((d) => d.id === artist.id),
    );

    const remainingDecoyCount = DECOY_COUNT - guaranteedDecoys.length;
    if (remainingPool.length < remainingDecoyCount) {
      return null;
    }

    const decoys = [...guaranteedDecoys, ...pickRandomDistinct(remainingPool, remainingDecoyCount)];

    const options: ArtistRankOption[] = shuffle([
      toArtistOption(correctArtist),
      ...decoys.map(toArtistOption),
    ]);

    history.add(correctArtist.id);

    return {
      id: randomUUID(),
      type: 'artist-rank',
      playerRanks,
      options,
      correctArtistId: correctArtist.id,
    };
  },
};

function toArtistOption(artist: SpotifyArtistSummary): ArtistRankOption {
  return { artistId: artist.id, name: artist.name, uri: artist.uri };
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