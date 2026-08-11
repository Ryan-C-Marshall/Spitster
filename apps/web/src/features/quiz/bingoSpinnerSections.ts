import type { QuestionType } from '@spitster/shared';

/**
 * One entry per bingo question type that *could* appear on the spinner.
 * Order determines both its default position on the ring (starting at 12
 * o'clock, going clockwise) and, more importantly, its priority when
 * assigning colors — see getBingoSpinnerSections below.
 *
 * To add a new bingo question type: add one entry here and everything else
 * (ring geometry, section sizing, landing detection, settings panel
 * checkbox list) adapts automatically.
 *
 * `iconUrl` is per-type artwork drawn centered in the wedge by BingoSpinner;
 * leave it unset and the section just renders as a solid color.
 */
export interface BingoQuestionCatalogEntry {
  type: QuestionType;
  label: string;
  iconUrl?: string;
}

const whoseTopTrackIconUrl = new URL('../../resources/images/person-listening.png', import.meta.url).href;
const guessThePlaylistIconUrl = new URL('../../resources/images/playlist.png', import.meta.url).href;
const artistRankIconUrl = new URL('../../resources/images/artists.png', import.meta.url).href;
const nameTheTitleIconUrl = new URL('../../resources/images/waveform.png', import.meta.url).href;
const nameTheArtistIconUrl = new URL('../../resources/images/singer-solo.png', import.meta.url).href;

export const BINGO_QUESTION_CATALOG: BingoQuestionCatalogEntry[] = [
  { type: 'whose-top-track', label: 'Whose Top Track', iconUrl: whoseTopTrackIconUrl },
  { type: 'guess-the-playlist', label: 'Guess the Playlist', iconUrl: guessThePlaylistIconUrl },
  { type: 'artist-rank', label: 'Artist Rank', iconUrl: artistRankIconUrl },
  { type: 'name-the-title', label: 'Name the Title', iconUrl: nameTheTitleIconUrl },
  { type: 'name-the-artist', label: 'Name the Artist', iconUrl: nameTheArtistIconUrl },
];

/** Every bingo question type, active by default (settings default / first
 * mount before the person has touched the settings panel). */
export const DEFAULT_ACTIVE_BINGO_TYPES: QuestionType[] = BINGO_QUESTION_CATALOG.map((entry) => entry.type);

// Colors are assigned to *active* questions in catalog order, cycling back
// to the start of the palette once there are more active questions than
// colors — e.g. with 8 active question types, the 6th, 7th, and 8th reuse
// the palette's 1st, 2nd, and 3rd colors.
export const BINGO_COLOR_PALETTE: string[] = ['#fefc92', '#fcc7fb', '#6abbdf', '#7ccb7f', '#c295d7'];

export interface BingoSpinnerSection extends BingoQuestionCatalogEntry {
  color: string;
}

/**
 * Builds the spinner's sections from the set of currently-active bingo
 * question types (see SettingsContext), preserving catalog order and
 * assigning colors from BINGO_COLOR_PALETTE in that same order (wrapping
 * around once the palette is exhausted). Falls back to the full catalog if
 * nothing is active, so the spinner never ends up with zero sections —
 * the settings panel itself also guards against deactivating everything.
 */
export function getBingoSpinnerSections(
  activeTypes: ReadonlySet<QuestionType> | readonly QuestionType[],
): BingoSpinnerSection[] {
  const activeSet = activeTypes instanceof Set ? activeTypes : new Set(activeTypes);
  const active = BINGO_QUESTION_CATALOG.filter((entry) => activeSet.has(entry.type));
  const effective = active.length > 0 ? active : BINGO_QUESTION_CATALOG;

  return effective.map((entry, index) => ({
    ...entry,
    color: BINGO_COLOR_PALETTE[index % BINGO_COLOR_PALETTE.length],
  }));
}
