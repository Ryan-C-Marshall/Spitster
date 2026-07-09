import type { SpotifySessionState } from '@spitster/shared';

export function createEmptySpotifySessionState(): SpotifySessionState {
  return {
    pendingAuths: {},
    connectedAccounts: {},
    selectedSpotifyUserId: null,
    quizPreparation: null,
  };
}
