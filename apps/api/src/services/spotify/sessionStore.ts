import type { SpotifySessionState } from '@spitster/shared';

export function createEmptySpotifySessionState(): SpotifySessionState {
  return {
    pendingAuths: {},
    connectedAccounts: {},
    hostSpotifyUserId: null,
    quizPreparation: null,
  };
}
