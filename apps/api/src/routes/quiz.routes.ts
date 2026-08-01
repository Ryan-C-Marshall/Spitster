import { Router } from 'express';

import { requireSession } from '../middleware/requireSession.js';
import { generateQuestion } from '../services/quiz/quizGenerator.service.js';
import type { QuestionType } from '@spitster/shared';
import { ensureFreshTokens, SpotifyReauthRequiredError } from '../services/spotify/tokenRefresh.service.js';

export const quizRoutes = Router();

const MIN_PLAYERS = 2;

quizRoutes.post('/question', requireSession, async (request, response) => {
  const spotifySession = request.session.spotify;
  const accounts = Object.values(spotifySession?.connectedAccounts ?? {});

  if (accounts.length < MIN_PLAYERS) {
    response.status(400).json({ error: 'Connect at least two players before starting the quiz' });
    return;
  }

  console.log("Generating ", request.body?.type ? `a ${request.body.type} question` : 'a random question', `for ${accounts.length} players`);

  try {
    await ensureFreshTokens(accounts);

    // Each candidate generator fetches only the Spotify data it needs (via
    // an in-memory per-user cache — see spotifyDataCache.service.ts), and
    // only once it's actually being attempted.
    const requestedType = request.body?.type as QuestionType | undefined;
    const question = await generateQuestion({ accounts, type: requestedType });

    if (!question) {
      response.status(422).json({ error: 'Not enough player data to build a question yet' });
      return;
    }

    response.json({ question });
  } catch (error) {
    if (error instanceof SpotifyReauthRequiredError) {
      response.status(409).json({ error: 'One or more players need to reconnect their Spotify account' });
      return;
    }

    console.error('Failed to generate question:', error);
    response.status(502).json({ error: 'Failed to fetch data from Spotify' });
  }
});