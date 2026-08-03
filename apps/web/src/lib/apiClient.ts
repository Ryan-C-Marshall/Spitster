import type { GameMode, Question, QuestionType, SpotifySessionSummary } from '@spitster/shared';

export async function fetchSession() {
  const response = await fetch('/auth/session', {
    credentials: 'include',
  });

  if (!response.ok) {
    return { session: null as SpotifySessionSummary | null };
  }

  const payload = (await response.json()) as SpotifySessionSummary;

  return {
    session: payload.authenticated ? payload : null,
  };
}

export async function fetchQuestion(mode: GameMode, type?: QuestionType): Promise<Question> {
  const response = await fetch('/quiz/question', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode, type }),
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error ?? 'Unable to fetch a question');
  }

  const payload = (await response.json()) as { question: Question };
  return payload.question;
}