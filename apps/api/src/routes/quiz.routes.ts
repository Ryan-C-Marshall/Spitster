import { Router } from 'express';

import { requireSession } from '../middleware/requireSession.js';
import { generateQuestion } from '../services/quiz/quizGenerator.service.js';
import { collectQuizSourceData } from '../services/quiz/quizDataCollector.service.js';
import type { QuestionType } from '@spitster/shared';

export const quizRoutes = Router();

const MIN_PLAYERS = 2;

quizRoutes.post('/question', requireSession, async (request, response) => {
  const spotifySession = request.session.spotify;
  const accounts = Object.values(spotifySession?.connectedAccounts ?? {});

  if (accounts.length < MIN_PLAYERS) {
    response.status(400).json({ error: 'Connect at least two players before starting the quiz' });
    return;
  }

  try {
    // Player top-track data is served from an in-memory per-user cache
    // after the first fetch (see spotifyDataCache.service.ts).
    const collected = await collectQuizSourceData({ accounts });

    const requestedType = request.body?.type as QuestionType | undefined;
    const question = generateQuestion({ players: collected.players, type: requestedType });

    if (!question) {
      response.status(422).json({ error: 'Not enough player data to build a question yet' });
      return;
    }

    response.json({ question });
  } catch (error) {
    console.error('Failed to generate question:', error);
    response.status(502).json({ error: 'Failed to fetch data from Spotify' });
  }
});