import type { SpotifySessionSummary } from '@spitster/shared';

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

export async function prepareQuiz() {
  const response = await fetch('/quiz/prepare', {
    method: 'POST',
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error('Unable to prepare quiz');
  }

  return response.json() as Promise<unknown>;
}
