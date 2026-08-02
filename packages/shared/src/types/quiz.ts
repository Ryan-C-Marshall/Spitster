import type { SpotifyTrackSummary } from './spotify.js';

/**
 * Every question type gets a literal here. Adding a new question type means:
 *   1. Add its string literal to this union
 *   2. Add its interface below, extending BaseQuestion
 *   3. Add it to the Question union
 *   4. Implement a generator (apps/api/src/services/quiz/questionTypes) and
 *      a display component (apps/web/src/features/quiz/questionTypes)
 */
export type QuestionType = 'whose-top-track' | 'guess-the-playlist' | 'artist-rank' | 'name-the-title' | 'name-the-artist';

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

export interface ArtistRankOption {
  artistId: string;
  name: string;
  uri: string;
}

export interface ArtistRankPlayerRank {
  spotifyUserId: string;
  displayName: string | null;
  /** 1-indexed rank in this player's top-200 (medium term); null = not present. */
  rank: number | null;
}

/**
 * "Artist rank reveal" — one artist is the correct answer; every connected
 * player's rank for that artist (or "unranked") is shown as a clue. Four
 * artist options are offered, pooled across every connected player's top
 * 200 artists, with the correct one placed at a random position.
 */
export interface ArtistRankQuestion extends BaseQuestion {
  type: 'artist-rank';
  playerRanks: ArtistRankPlayerRank[];
  options: ArtistRankOption[]; // exactly 4, shuffled
  correctArtistId: string;
}

/**
 * "Name the title" / "Name the artist" — plays a track that appears in at
 * least two connected players' long-term top 1000; no multiple choice, the
 * answer is just the track itself, revealed on demand. The two types share
 * this exact shape and only differ in prompt copy — kept as separate
 * QuestionType literals (rather than one type with a mode field) so they
 * plug into the existing generator-registry / QuestionView pattern the
 * same way every other question type does.
 */
export interface NameTheTitleQuestion extends BaseQuestion {
  type: 'name-the-title';
  track: SpotifyTrackSummary;
}

export interface NameTheArtistQuestion extends BaseQuestion {
  type: 'name-the-artist';
  track: SpotifyTrackSummary;
}

export type Question =
  | WhoseTopTrackQuestion
  | GuessThePlaylistQuestion
  | ArtistRankQuestion
  | NameTheTitleQuestion
  | NameTheArtistQuestion;