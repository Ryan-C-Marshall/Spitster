import { randomUUID } from 'node:crypto';

import type { QuizPlayerInput, QuizSessionSnapshot, SpotifyQuizCollectionResult } from '@spitster/shared';

import type { SpotifySessionState } from '@spitster/shared';

import { collectQuizSourceData } from './quizDataCollector.service.js';

export async function generateQuizSnapshot(input: {
  quizKind: QuizSessionSnapshot['quizKind'];
  selectedSpotifyUserId: string | null;
  players: QuizPlayerInput[];
  spotifySession: SpotifySessionState;
}): Promise<QuizSessionSnapshot> {
  const collectionResult = await collectQuizSourceData({
    accounts: Object.values(input.spotifySession.connectedAccounts),
  });

  return {
    quizKind: input.quizKind,
    selectedSpotifyUserId: input.selectedSpotifyUserId,
    players: mergePlayers(input.players, collectionResult),
    rounds: [
      {
        id: randomUUID(),
        prompt: 'Which track is the most recent release?',
        answer: 'Placeholder answer',
        distractors: ['Choice A', 'Choice B', 'Choice C'],
        questionType: 'release-year',
        sourceKind: input.quizKind,
      },
    ],
    score: 0,
    currentRoundIndex: 0,
  };
}

function mergePlayers(players: QuizPlayerInput[], collectionResult: SpotifyQuizCollectionResult): QuizPlayerInput[] {
  return players.map((player) => {
    const collectedPlayer = collectionResult.players.find((item) => item.spotifyUserId === player.spotifyUserId);

    if (!collectedPlayer) {
      return player;
    }

    return {
      ...player,
      displayName: collectedPlayer.displayName ?? player.displayName,
    };
  });
}
