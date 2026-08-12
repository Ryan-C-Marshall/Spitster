import { randomUUID } from 'node:crypto';

import type {
  ArtistSongCountQuestion,
  SpotifyArtistSummary,
  SpotifyConnectedAccount,
  SpotifyTrackSummary,
} from '@spitster/shared';

import { getEnv } from '../../../config/env.js';
import { fetchUsersTopTracks } from '../../spotify/spotifyWebApi.service.js';
import { getOrFetchSpotifyData } from '../../spotify/spotifyDataCache.service.js';
import type { QuestionGenerator } from '../quizGenerator.service.js';

const TOP_TRACKS_LIMIT = 100;
const TOP_TRACKS_TIME_RANGE = 'short_term' as const;

// How many of a player's most-represented artists are eligible to be
// picked as the correct answer.
const TOP_ARTIST_CANDIDATE_COUNT = 5;

// The number line's upper bound is `A * correctCount`, capped at 100 (a
// player's top-100 list can't produce a count above 100 anyway). `A` is
// `random() * random() * (3-1) + 1` — see ArtistSongCountQuestion's doc
// comment in packages/shared for why the +1 is necessary: the
// product of two independent uniform(0,1) randoms is below 1/3 about 70%
// of the time, so without the +1 the line's max would usually end up
// smaller than the answer it needs to show.
const NUMBER_LINE_MULTIPLIER_SCALE = 3;
const NUMBER_LINE_MAX_CAP = 100;

interface PlayerTopTracks {
  spotifyUserId: string;
  displayName: string | null;
  topHundred: SpotifyTrackSummary[];
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
    topHundred: topTracks,
  };
}

interface ArtistTally {
  artist: SpotifyArtistSummary;
  count: number;
}

// Tallies every artist credited on any track in the list (not just each
// track's primary artist) — a feature counts toward that artist's total
// same as a track they lead, since the question asks how many songs are
// "by" them.
function tallyArtists(tracks: SpotifyTrackSummary[]): ArtistTally[] {
  const tallies = new Map<string, ArtistTally>();

  for (const track of tracks) {
    for (const artist of track.artists) {
      const existing = tallies.get(artist.id);
      if (existing) {
        existing.count += 1;
      } else {
        tallies.set(artist.id, { artist, count: 1 });
      }
    }
  }

  return [...tallies.values()];
}

// This generator's answer history is scoped per-player (contrast with
// e.g. artistRank, where one bucket covers every player) — the same
// artist being asked about for one player shouldn't stop it from coming
// up for a different player. See offTheChart.ts for the same pattern.
function historyKeyFor(spotifyUserId: string, artistId: string): string {
  return `${spotifyUserId}::${artistId}`;
}

export const artistSongCountGenerator: QuestionGenerator<ArtistSongCountQuestion> = {
  type: 'artist-song-count',
  async generate({ accounts, history }) {
    // Fetched in parallel — see whoseTopTrack.ts for why sequential
    // per-account fetching isn't needed. Cache-backed per account.
    const players = await Promise.all(accounts.map((account) => fetchTopTracksForAccount(account)));

    const eligiblePlayers = players
      .map((player) => {
        const topCandidates = tallyArtists(player.topHundred)
          .sort((a, b) => b.count - a.count)
          .slice(0, TOP_ARTIST_CANDIDATE_COUNT);

        const unusedCandidates = topCandidates.filter(
          (candidate) => !history.has(historyKeyFor(player.spotifyUserId, candidate.artist.id)),
        );

        return { player, unusedCandidates };
      })
      .filter((entry) => entry.unusedCandidates.length > 0);

    if (eligiblePlayers.length === 0) {
      return null;
    }

    const { player, unusedCandidates } = pickRandom(eligiblePlayers);
    const { artist, count: correctCount } = pickRandom(unusedCandidates);

    // Distribution between 1 and NLMS that skews low
    const multiplier = (Math.random() * Math.random() * (NUMBER_LINE_MULTIPLIER_SCALE - 1)) + 1;
    const numberLineMax = Math.min(Math.round(multiplier * correctCount), NUMBER_LINE_MAX_CAP);

    history.add(historyKeyFor(player.spotifyUserId, artist.id));

    return {
      id: randomUUID(),
      type: 'artist-song-count',
      spotifyUserId: player.spotifyUserId,
      displayName: player.displayName,
      artist,
      correctCount,
      numberLineMax,
    };
  },
};

function pickRandom<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}
