import type { ClassicInputSourceOptions } from '@spitster/shared';

/**
 * Options offered in the settings panel for classic mode's sampling source
 * — see ClassicInputSourceOptions. `subtitleLabel` is the phrasing used in
 * the classic-mode question subtitle (CrowdFavouriteQuestion.tsx), kept
 * alongside the dropdown `label` so the two stay in sync.
 */
export const CLASSIC_TIME_RANGE_OPTIONS: Array<{
  value: ClassicInputSourceOptions['timeRange'];
  label: string;
  subtitleLabel: string;
}> = [
  { value: 'short_term', label: 'Last 4 weeks', subtitleLabel: 'the last 4 weeks' },
  { value: 'medium_term', label: 'Last 6 months', subtitleLabel: 'the last 6 months' },
  { value: 'long_term', label: 'Last year', subtitleLabel: 'last year' },
];

export const CLASSIC_TRACK_COUNT_OPTIONS: number[] = [100, 200, 500, 1000, 2000];

export const DEFAULT_CLASSIC_INPUT_SOURCE: ClassicInputSourceOptions = {
  timeRange: 'medium_term',
  limit: 1000,
};

export function getClassicTimeRangeSubtitleLabel(timeRange: ClassicInputSourceOptions['timeRange']): string {
  return (
    CLASSIC_TIME_RANGE_OPTIONS.find((option) => option.value === timeRange)?.subtitleLabel ?? 'the last 6 months'
  );
}
