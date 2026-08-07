import type { QuestionType } from '@spitster/shared';

/**
 * One entry per ring section on the bingo loading spinner. Order determines
 * position on the ring, starting at 12 o'clock and going clockwise.
 *
 * To add a new bingo question type to the spinner: add one entry here (plus
 * a new color — reuse or extend the palette as needed) and everything else
 * (ring geometry, section sizing, landing detection) adapts automatically.
 *
 * `iconUrl` is per-type artwork drawn centered in the wedge by BingoSpinner;
 * leave it unset and the section just renders as a solid color.
 */
export interface BingoSpinnerSection {
  type: QuestionType;
  label: string;
  color: string;
  iconUrl?: string;
}

const whoseTopTrackIconUrl = new URL('../../resources/images/person-listening.png', import.meta.url).href;
const guessThePlaylistIconUrl = new URL('../../resources/images/playlist.png', import.meta.url).href;
const artistRankIconUrl = new URL('../../resources/images/artists.png', import.meta.url).href;
const nameTheTitleIconUrl = new URL('../../resources/images/waveform.png', import.meta.url).href;
const nameTheArtistIconUrl = new URL('../../resources/images/singer-solo.png', import.meta.url).href;

export const BINGO_SPINNER_SECTIONS: BingoSpinnerSection[] = [
  { type: 'whose-top-track', label: 'Whose Top Track', color: '#fefc92', iconUrl: whoseTopTrackIconUrl },
  { type: 'guess-the-playlist', label: 'Guess the Playlist', color: '#fcc7fb', iconUrl: guessThePlaylistIconUrl },
  { type: 'artist-rank', label: 'Artist Rank', color: '#6abbdf', iconUrl: artistRankIconUrl },
  { type: 'name-the-title', label: 'Name the Title', color: '#7ccb7f', iconUrl: nameTheTitleIconUrl },
  { type: 'name-the-artist', label: 'Name the Artist', color: '#c295d7', iconUrl: nameTheArtistIconUrl },
];
