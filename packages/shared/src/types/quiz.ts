export type QuizKind = 'top-tracks' | 'playlists' | 'library' | 'friends';

export type QuizQuestionType =
  | 'track-name'
  | 'track-artist'
  | 'playlist-owner'
  | 'artist-genres'
  | 'release-year';

export interface QuizPlayerInput {
  displayName: string;
  spotifyAccountId?: string;
  spotifyUserId?: string;
  spotifyUsername?: string;
  accessTokenSource: 'session' | 'public';
}

export interface QuizRound {
  id: string;
  prompt: string;
  answer: string;
  distractors: string[];
  questionType: QuizQuestionType;
  sourceKind: QuizKind;
}

export interface QuizSessionSnapshot {
  quizKind: QuizKind;
  selectedSpotifyUserId: string | null;
  players: QuizPlayerInput[];
  rounds: QuizRound[];
  score: number;
  currentRoundIndex: number;
}
