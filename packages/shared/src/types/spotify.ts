export interface SpotifyUserProfile {
  id: string;
  display_name: string | null;
  uri: string;
  href: string;
}

export interface SpotifyTokenBundle {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
  scope: string;
  tokenType: string;
}

export interface SpotifyConnectedAccount {
  spotifyUserId: string;
  displayName: string | null;
  username: string | null;
  topTrack: SpotifyTrackSummary | null;
  tokens: SpotifyTokenBundle;
}

export interface SpotifyConnectedAccountSummary {
  spotifyUserId: string;
  displayName: string | null;
  username: string | null;
  topTrack: SpotifyTrackSummary | null;
  isHost: boolean;
}

export interface SpotifyPendingAuth {
  codeVerifier: string;
  state: string;
}

export interface SpotifyArtistSummary {
  id: string;
  name: string;
  uri: string;
}

export interface SpotifyTrackSummary {
  id: string;
  name: string;
  uri: string;
  artists: SpotifyArtistSummary[];
}

export interface SpotifyPlayerCollectedData {
  spotifyUserId: string;
  displayName: string | null;
  topTracks: SpotifyTrackSummary[];
}

export interface SpotifyQuizPreparationState {
  status: 'idle' | 'collecting' | 'ready' | 'failed';
  players: SpotifyPlayerCollectedData[];
  errorMessage: string | null;
}

export interface SpotifySessionState {
  pendingAuths: Record<string, SpotifyPendingAuth>;
  connectedAccounts: Record<string, SpotifyConnectedAccount>;
  hostSpotifyUserId: string | null;
  quizPreparation: SpotifyQuizPreparationState | null;
}

export interface SpotifySessionSummary {
  authenticated: boolean;
  connectedAccounts: SpotifyConnectedAccountSummary[];
  hostSpotifyUserId: string | null;
  quizPreparation: SpotifyQuizPreparationState | null;
}

export interface SpotifyTokenResponse {
  access_token: string;
  token_type: string;
  scope: string;
  expires_in: number;
  refresh_token?: string;
}

export interface SpotifyQuizCollectionResult {
  players: SpotifyPlayerCollectedData[];
}
