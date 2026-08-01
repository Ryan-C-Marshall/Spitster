import type { Question, QuestionType, SpotifyConnectedAccount } from '@spitster/shared';

import { whoseTopTrackGenerator } from './questionTypes/whoseTopTrack.js';

/**
 * The contract every question type's generator implements. `generate` is
 * responsible for fetching whatever Spotify data it needs (via the cache)
 * for the given accounts, and returns null when that data can't support
 * this question type (e.g. not enough players, no top tracks yet) — the
 * caller tries the next candidate rather than failing outright. Because
 * fetching only happens for the type currently being attempted, a type
 * never pays for data another type would have needed.
 */
export interface QuestionGenerator<T extends Question = Question> {
  type: T['type'];
  generate(input: { accounts: SpotifyConnectedAccount[] }): Promise<T | null>;
}

// Adding a question type: implement a generator in ./questionTypes and
// register it here. Nothing else in this file needs to change.
const generators: QuestionGenerator[] = [whoseTopTrackGenerator];

export async function generateQuestion(input: {
  accounts: SpotifyConnectedAccount[];
  type?: QuestionType;
}): Promise<Question | null> {
  const candidates = shuffle(
    input.type ? generators.filter((generator) => generator.type === input.type) : generators,
  );

  for (const generator of candidates) {
    const question = await generator.generate({ accounts: input.accounts });
    if (question) {
      return question;
    }
  }

  return null;
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}