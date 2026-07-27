import { Router } from 'express';

import { requireSession } from '../middleware/requireSession.js';
import { generateQuizSnapshot } from '../services/quiz/quizGenerator.service.js';
import { collectQuizSourceData } from '../services/quiz/quizDataCollector.service.js';
import type { QuizPlayerInput } from '@spitster/shared';

export const quizRoutes = Router();

quizRoutes.post('/prepare', requireSession, async (request, response) => {
  const spotifySession = request.session.spotify;

  if (!spotifySession || Object.keys(spotifySession.connectedAccounts).length === 0) {
    response.status(400).json({ error: 'No connected Spotify accounts to prepare' });
    return;
  }

  spotifySession.quizPreparation = {
    status: 'collecting',
    players: [],
    errorMessage: null,
  };

  const collected = await collectQuizSourceData({
    accounts: Object.values(spotifySession.connectedAccounts),
  });

  const players: QuizPlayerInput[] = collected.players.map((player) => ({
    displayName: player.displayName ?? player.spotifyUserId,
    spotifyAccountId: player.spotifyUserId,
    spotifyUserId: player.spotifyUserId,
    spotifyUsername: spotifySession.connectedAccounts[player.spotifyUserId]?.username ?? player.spotifyUserId,
    accessTokenSource: 'session',
  }));

  spotifySession.quizPreparation = {
    status: 'ready',
    players: collected.players,
    errorMessage: null,
  };

  response.json({
    status: 'ready',
    players,
  });
});

quizRoutes.post('/generate', requireSession, async (request, response) => {
  const spotifySession = request.session.spotify;

  if (!spotifySession || Object.keys(spotifySession.connectedAccounts).length === 0) {
    response.status(400).json({ error: 'Connect Spotify accounts before generating a quiz' });
    return;
  }

  const players: QuizPlayerInput[] = Object.values(spotifySession.connectedAccounts).map((account) => ({
    displayName: account.displayName ?? account.spotifyUserId,
    spotifyAccountId: account.spotifyUserId,
    spotifyUserId: account.spotifyUserId,
    spotifyUsername: account.username ?? account.spotifyUserId,
    accessTokenSource: 'session',
  }));

  const snapshot = await generateQuizSnapshot({
    quizKind: 'friends',
    players,
    spotifySession,
  });

  response.json(snapshot);
});
