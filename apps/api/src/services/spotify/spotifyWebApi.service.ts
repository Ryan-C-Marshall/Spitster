import type { SpotifyArtistSummary, SpotifyConnectedAccount, SpotifyTrackSummary } from '@spitster/shared';

type SpotifyTrackItemResponse = {
  id: string;
  name: string;
  uri: string;
  artists: Array<{
    id: string;
    name: string;
    uri: string;
  }>;
};

type SpotifyTopTracksResponse = {
  items: SpotifyTrackItemResponse[];
};

async function fetchJson<T>(url: string, accessToken: string): Promise<T> {
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Spotify request failed: ${response.status}`);
  }

  return (await response.json()) as T;
}

// Spotify caps this endpoint at 50 items per request, but supports paging
// further via `offset` — so a caller-requested `limit` beyond 50 is served
// by making enough successive requests (bumping offset by 50 each time)
// until we've collected enough tracks or Spotify runs out of ranked tracks
// for this user (a page returning fewer items than requested means we've
// hit the end of their list).
const SPOTIFY_TOP_TRACKS_PAGE_SIZE = 50;

export async function fetchUsersTopTracks(input: {
  account: SpotifyConnectedAccount;
  apiBaseUrl: string;
  timeRange: 'short_term' | 'medium_term' | 'long_term' | null;
  limit?: number;
}): Promise<SpotifyTrackSummary[]> {
  const timeRange = input.timeRange ?? 'medium_term';
  const totalLimit = input.limit ?? SPOTIFY_TOP_TRACKS_PAGE_SIZE;

  const tracks: SpotifyTrackSummary[] = [];
  let offset = 0;

  while (tracks.length < totalLimit) {
    const pageLimit = Math.min(SPOTIFY_TOP_TRACKS_PAGE_SIZE, totalLimit - tracks.length);

    const page = await fetchJson<SpotifyTopTracksResponse>(
      `${input.apiBaseUrl}/me/top/tracks?limit=${pageLimit}&offset=${offset}&time_range=${timeRange}`,
      input.account.tokens.accessToken,
    );

    tracks.push(
      ...page.items.map((track): SpotifyTrackSummary => ({
        id: track.id,
        name: track.name,
        uri: track.uri,
        artists: track.artists.map((artist): SpotifyArtistSummary => ({
          id: artist.id,
          name: artist.name,
          uri: artist.uri,
        })),
      })),
    );

    offset += pageLimit;

    // Fewer items than we asked for means we've reached the end of this
    // user's ranked list — no point paging further.
    if (page.items.length < pageLimit) {
      break;
    }
  }

  console.log(`Fetched ${tracks.length} top tracks for Spotify user ${input.account.spotifyUserId} (limit requested: ${totalLimit})`);

  return tracks;
}

type SpotifyArtistItemResponse = {
  id: string;
  name: string;
  uri: string;
};

type SpotifyTopArtistsResponse = {
  items: SpotifyArtistItemResponse[];
};

const SPOTIFY_TOP_ARTISTS_PAGE_SIZE = 50;

export async function fetchUsersTopArtists(input: {
  account: SpotifyConnectedAccount;
  apiBaseUrl: string;
  timeRange: 'short_term' | 'medium_term' | 'long_term' | null;
  limit?: number;
}): Promise<SpotifyArtistSummary[]> {
  const timeRange = input.timeRange ?? 'medium_term';
  const totalLimit = input.limit ?? SPOTIFY_TOP_ARTISTS_PAGE_SIZE;

  const artists: SpotifyArtistSummary[] = [];
  let offset = 0;

  while (artists.length < totalLimit) {
    const pageLimit = Math.min(SPOTIFY_TOP_ARTISTS_PAGE_SIZE, totalLimit - artists.length);

    const page = await fetchJson<SpotifyTopArtistsResponse>(
      `${input.apiBaseUrl}/me/top/artists?limit=${pageLimit}&offset=${offset}&time_range=${timeRange}`,
      input.account.tokens.accessToken,
    );

    artists.push(
      ...page.items.map((artist): SpotifyArtistSummary => ({
        id: artist.id,
        name: artist.name,
        uri: artist.uri,
      })),
    );

    offset += pageLimit;

    if (page.items.length < pageLimit) {
      break;
    }
  }

  console.log(`Fetched ${artists.length} top artists for Spotify user ${input.account.spotifyUserId} (limit requested: ${totalLimit})`);

  return artists;
}

type SpotifyPlaylistItemResponse = {
  id: string;
  name: string;
  owner: {
    id: string;
    display_name: string | null;
  };
  // Spotify's Feb 2026 API update renamed this field from `tracks` to
  // `items` (https://developer.spotify.com/documentation/web-api/references/changes/february-2026).
  items?: {
    total: number;
  } | null;
};

type SpotifyPlaylistsResponse = {
  items: SpotifyPlaylistItemResponse[];
};

export interface SpotifyPlaylistSummary {
  id: string;
  name: string;
  ownerId: string;
  ownerDisplayName: string | null;
  trackCount: number;
}

const SPOTIFY_PLAYLISTS_PAGE_SIZE = 50;

// Returns only playlists this account actually owns (not ones they merely
// follow or collaborate on) — callers shouldn't need to re-check ownership.
export async function fetchOwnedPlaylists(input: {
  account: SpotifyConnectedAccount;
  apiBaseUrl: string;
  limit?: number;
}): Promise<SpotifyPlaylistSummary[]> {
  const totalLimit = input.limit ?? SPOTIFY_PLAYLISTS_PAGE_SIZE;
  const playlists: SpotifyPlaylistSummary[] = [];
  let offset = 0;

  while (playlists.length < totalLimit) {
    const pageLimit = Math.min(SPOTIFY_PLAYLISTS_PAGE_SIZE, totalLimit - playlists.length);

    const page = await fetchJson<SpotifyPlaylistsResponse>(
      `${input.apiBaseUrl}/me/playlists?limit=${pageLimit}&offset=${offset}`,
      input.account.tokens.accessToken,
    );

    for (const item of page.items) {
      if (!item || !item.owner) continue; // guard against null/malformed entries
      if (item.owner.id !== input.account.spotifyUserId) continue;

      playlists.push({
        id: item.id,
        name: item.name,
        ownerId: item.owner.id,
        ownerDisplayName: item.owner.display_name,
        trackCount: item.items?.total ?? 0,
      });
    }

    offset += pageLimit;

    if (page.items.length < pageLimit) {
      break;
    }
  }

  return playlists;
}

type SpotifyPlaylistTrackItemResponse = {
  is_local: boolean;
  // Renamed from `track` to `item` in Spotify's Feb 2026 API update; `track`
  // is still sent for back-compat but is deprecated, so we read `item`.
  item: SpotifyTrackItemResponse | null;
};

type SpotifyPlaylistTracksResponse = {
  items: SpotifyPlaylistTrackItemResponse[];
};

const SPOTIFY_PLAYLIST_TRACKS_PAGE_SIZE = 100;
// Trimmed via `fields` since playlists can be large and we only need enough
// tracks to sample three from.
const PLAYLIST_TRACKS_FIELDS = 'items(is_local,item(id,name,uri,artists(id,name,uri)))';

export async function fetchPlaylistTracks(input: {
  account: SpotifyConnectedAccount;
  apiBaseUrl: string;
  playlistId: string;
  limit?: number;
}): Promise<SpotifyTrackSummary[]> {
  const totalLimit = input.limit ?? SPOTIFY_PLAYLIST_TRACKS_PAGE_SIZE;
  const tracks: SpotifyTrackSummary[] = [];
  let offset = 0;

  while (tracks.length < totalLimit) {
    const pageLimit = Math.min(SPOTIFY_PLAYLIST_TRACKS_PAGE_SIZE, totalLimit - tracks.length);

    // `/playlists/{id}/tracks` was removed in Spotify's Feb 2026 API update;
    // `/playlists/{id}/items` is the replacement. Note it's also now only
    // accessible for playlists the account owns or collaborates on (403
    // otherwise) — fine here since callers only pass owned playlist IDs.
    const page = await fetchJson<SpotifyPlaylistTracksResponse>(
      `${input.apiBaseUrl}/playlists/${input.playlistId}/items?fields=${encodeURIComponent(
        PLAYLIST_TRACKS_FIELDS,
      )}&limit=${pageLimit}&offset=${offset}`,
      input.account.tokens.accessToken,
    );

    for (const playlistItem of page.items) {
      // Local files can't be streamed via the Web Playback SDK, and removed
      // tracks leave a null `item` behind rather than being omitted — both
      // get filtered here so nothing downstream has to check for them.
      if (playlistItem.is_local || !playlistItem.item) continue;

      tracks.push({
        id: playlistItem.item.id,
        name: playlistItem.item.name,
        uri: playlistItem.item.uri,
        artists: playlistItem.item.artists.map((artist): SpotifyArtistSummary => ({
          id: artist.id,
          name: artist.name,
          uri: artist.uri,
        })),
      });
    }

    offset += pageLimit;

    if (page.items.length < pageLimit) {
      break;
    }
  }

  return tracks;
}

type SpotifySearchPlaylistItemResponse = {
  id: string;
  name: string;
  owner: {
    id: string;
    display_name: string | null;
  };
} | null; // Spotify's search response pads with `null` entries in some cases.

type SpotifySearchPlaylistsResponse = {
  // `playlists` itself can be entirely absent/null for a query with no
  // playlist matches, distinct from `items: []`.
  playlists: {
    items: SpotifySearchPlaylistItemResponse[];
  } | null;
};

export interface SpotifyPlaylistSearchResult {
  id: string;
  name: string;
  ownerId: string;
  ownerDisplayName: string | null;
}

// Searches the catalog for playlists by name (e.g. to locate a user's
// Spotify-generated "Your Top Songs [year]" playlist, which — being
// Spotify-owned rather than user-owned — never shows up in
// `fetchOwnedPlaylists`). This is the general Search endpoint, not the
// Nov 2024-restricted "Featured Playlists" / "Category Playlists" browse
// endpoints, so it remains available in development-mode apps. However,
// actually reading an algorithmic/Spotify-owned playlist's tracks
// afterwards (via `fetchPlaylistTracks`) is subject to that restriction —
// see the comment on `fetchTopSongsPlaylistTracks` in crowdFavourite.ts.
export async function searchPlaylists(input: {
  account: SpotifyConnectedAccount;
  apiBaseUrl: string;
  query: string;
  limit?: number;
}): Promise<SpotifyPlaylistSearchResult[]> {
  const limit = input.limit ?? 10;

  const page = await fetchJson<SpotifySearchPlaylistsResponse>(
    `${input.apiBaseUrl}/search?q=${encodeURIComponent(input.query)}&type=playlist&limit=${limit}`,
    input.account.tokens.accessToken,
  );

  const items = page.playlists?.items ?? [];

  return items
    .filter((item): item is NonNullable<SpotifySearchPlaylistItemResponse> => item !== null && !!item.owner)
    .map((item) => ({
      id: item.id,
      name: item.name,
      ownerId: item.owner.id,
      ownerDisplayName: item.owner.display_name,
    }));
}

// Playback API
export async function playTrack(input: {
  account: SpotifyConnectedAccount;
  trackUri: string;
  deviceId?: string;
}): Promise<void> {
  const url = new URL('https://api.spotify.com/v1/me/player/play');
  if (input.deviceId) {
    url.searchParams.set('device_id', input.deviceId);
  }

  const response = await fetch(url.toString(), {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${input.account.tokens.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ uris: [input.trackUri] }),
  });

  if (response.status === 204) {
    return; // success — no body
  }
  if (response.status === 404) {
    throw new Error('No active Spotify device found. Open Spotify on a device to play.');
  }
  if (response.status === 403) {
    throw new Error('Playback control requires Spotify Premium.');
  }
  if (!response.ok) {
    throw new Error(`Failed to start playback: ${response.status} ${response.statusText}`);
  }
}