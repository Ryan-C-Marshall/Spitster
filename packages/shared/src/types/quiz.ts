import type { SpotifyTrackSummary } from './spotify.js';

/**
 * Every question type gets a literal here. Adding a new question type means:
 *   1. Add its string literal to this union
 *   2. Add its interface below, extending BaseQuestion
 *   3. Add it to the Question union
 *   4. Implement a generator (apps/api/src/services/quiz/questionTypes) and
 *      a display component (apps/web/src/features/quiz/questionTypes)
 */
export type QuestionType = 'whose-top-track' | 'guess-the-playlist';

export interface BaseQuestion {
  id: string;
  type: QuestionType;
}

export interface QuestionPlayerOption {
  spotifyUserId: string;
  displayName: string | null;
}

/**
 * "Whose top track is this?" — plays a track pulled from one connected
 * player's top tracks; every connected player is shown as a possible answer.
 */
export interface WhoseTopTrackQuestion extends BaseQuestion {
  type: 'whose-top-track';
  track: SpotifyTrackSummary;
  options: QuestionPlayerOption[];
  correctSpotifyUserIds: string[];
}

export interface PlaylistOption {
  playlistId: string;
  name: string;
  ownerSpotifyUserId: string;
  ownerDisplayName: string | null;
}

/**
 * "Guess the playlist" — plays three tracks pulled from one connected
 * player's owned playlist; four playlists (pooled across every connected
 * player's own playlists) are shown as possible answers.
 */
export interface GuessThePlaylistQuestion extends BaseQuestion {
  type: 'guess-the-playlist';
  tracks: SpotifyTrackSummary[]; // exactly 3; tracks[0] autoplays
  options: PlaylistOption[]; // exactly 4, shuffled
  correctPlaylistId: string;
}

// | NextQuestionType, as more question types are added.
export type Question = WhoseTopTrackQuestion | GuessThePlaylistQuestion;