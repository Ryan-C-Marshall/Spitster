import { randomUUID } from 'node:crypto';

import type { SpotifyTrackSummary, WhoseTopTrackQuestion } from '@spitster/shared';

import type { QuestionGenerator } from '../quizGenerator.service.js';

// Need at least two players so there's more than one possible answer.
const MIN_PLAYERS = 2;

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
  generate({ players }) {
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