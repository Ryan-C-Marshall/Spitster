import type { SpotifyTrackSummary } from '@spitster/shared';

// Spotify can relink the "same" song to a different track id per user
// (regional/market availability, remasters vs. original releases), so
// comparing by id under-counts matches. Track name + artist name is a much
// more reliable notion of "the same song" for quiz purposes.
export function trackSignature(track: Pick<SpotifyTrackSummary, 'name' | 'artists'>): string {
  const normalizedArtists = track.artists
    .map((artist) => artist.name.trim().toLowerCase())
    .sort()
    .join(',');

  return `${track.name.trim().toLowerCase()}::${normalizedArtists}`;
}