import { Router } from 'express';

import { requireSession } from '../middleware/requireSession.js';
import { generateQuestion } from '../services/quiz/quizGenerator.service.js';
import type { ClassicInputSourceOptions, GameMode, QuestionType } from '@spitster/shared';
import { ensureFreshTokens, SpotifyReauthRequiredError } from '../services/spotify/tokenRefresh.service.js';

export const quizRoutes = Router();

const MIN_PLAYERS = 2;
const GAME_MODES: GameMode[] = ['bingo', 'classic'];
const CLASSIC_TIME_RANGES: ClassicInputSourceOptions['timeRange'][] = ['short_term', 'medium_term', 'long_term'];
// Guards against a malformed/malicious limit turning into an enormous
// number of paginated Spotify requests — see fetchUsersTopTracks.
const MAX_CLASSIC_INPUT_SOURCE_LIMIT = 5000;

// Validates the client-supplied sampling options for classic mode (see
// ClassicInputSourceOptions); returns undefined for anything malformed so
// the generator falls back to its own defaults rather than erroring out.
function parseClassicInputSource(body: unknown): ClassicInputSourceOptions | undefined {
  if (!body || typeof body !== 'object') return undefined;
  const candidate = (body as Record<string, unknown>).classicInputSource;
  if (!candidate || typeof candidate !== 'object') return undefined;

  const { timeRange, limit } = candidate as Record<string, unknown>;
  if (typeof timeRange !== 'string' || !CLASSIC_TIME_RANGES.includes(timeRange as ClassicInputSourceOptions['timeRange'])) {
    return undefined;
  }
  if (typeof limit !== 'number' || !Number.isFinite(limit) || limit <= 0) {
    return undefined;
  }

  return {
    timeRange: timeRange as ClassicInputSourceOptions['timeRange'],
    limit: Math.min(Math.floor(limit), MAX_CLASSIC_INPUT_SOURCE_LIMIT),
  };
}

quizRoutes.post('/question', requireSession, async (request, response) => {
  const spotifySession = request.session.spotify;
  const accounts = Object.values(spotifySession?.connectedAccounts ?? {});

  if (accounts.length < MIN_PLAYERS) {
    response.status(400).json({ error: 'Connect at least two players before starting the quiz' });
    return;
  }

  const requestedMode = request.body?.mode as GameMode | undefined;
  const mode: GameMode = GAME_MODES.includes(requestedMode as GameMode) ? (requestedMode as GameMode) : 'bingo';

  console.log("Generating ", request.body?.type ? `a ${request.body.type} question` : 'a random question', `in ${mode} mode for ${accounts.length} players`);

  try {
    await ensureFreshTokens(accounts);

    // Each candidate generator fetches only the Spotify data it needs (via
    // an in-memory per-user cache — see spotifyDataCache.service.ts), and
    // only once it's actually being attempted.
    const requestedType = request.body?.type as QuestionType | undefined;
    const classicInputSource = parseClassicInputSource(request.body);
    const answerHistoryStore = (request.session.quizHistory ??= {});
    const question = await generateQuestion({
      accounts,
      mode,
      type: requestedType,
      answerHistoryStore,
      classicInputSource,
    });

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