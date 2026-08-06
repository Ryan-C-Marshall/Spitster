import type { QuestionType } from '@spitster/shared';

/**
 * One entry per ring section on the bingo loading spinner. Order determines
 * position on the ring, starting at 12 o'clock and going clockwise.
 *
 * To add a new bingo question type to the spinner: add one entry here (plus
 * a new color — reuse or extend the palette as needed) and everything else
 * (ring geometry, section sizing, landing detection) adapts automatically.
 *
 * `iconUrl` is a placeholder for per-type artwork; leave it unset for now
 * and the section just renders as a solid color. Once real icons exist,
 * set the url here and BingoSpinner will draw it centered in the wedge.
 */
export interface BingoSpinnerSection {
  type: QuestionType;
  label: string;
  color: string;
  iconUrl?: string;
}

export const BINGO_SPINNER_SECTIONS: BingoSpinnerSection[] = [
  { type: 'whose-top-track', label: 'Whose Top Track', color: '#fefc92' },
  { type: 'guess-the-playlist', label: 'Guess the Playlist', color: '#fcc7fb' },
  { type: 'artist-rank', label: 'Artist Rank', color: '#6abbdf' },
  { type: 'name-the-title', label: 'Name the Title', color: '#7ccb7f' },
  { type: 'name-the-artist', label: 'Name the Artist', color: '#c295d7' },
];
