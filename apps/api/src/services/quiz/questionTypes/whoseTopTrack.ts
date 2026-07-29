import { randomUUID } from 'node:crypto';

import type { WhoseTopTrackQuestion } from '@spitster/shared';

import type { QuestionGenerator } from '../quizGenerator.service.js';

// Need at least two players so there's more than one possible answer.
const MIN_PLAYERS = 2;

export const whoseTopTrackGenerator: QuestionGenerator<WhoseTopTrackQuestion> = {
  type: 'whose-top-track',
  generate({ players }) {
    const eligiblePlayers = players.filter((player) => player.topTracks.length > 0);

    if (eligiblePlayers.length < MIN_PLAYERS) {
      return null;
    }

    const correctPlayer = pickRandom(eligiblePlayers);
    const track = pickRandom(correctPlayer.topTracks);

    // The same track can appear in more than one player's top tracks (e.g.
    // a couple who both have a favorite song in their top 50) — anyone who
    // has it should count as correct, not just whichever player it was
    // originally drawn from.
    const correctSpotifyUserIds = eligiblePlayers
      .filter((player) => player.topTracks.some((topTrack) => topTrack.id === track.id))
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