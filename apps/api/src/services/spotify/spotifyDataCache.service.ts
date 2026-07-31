type CacheKeyParams = Record<string, string | number | undefined>;

// Module-level, in-memory, process-lifetime cache. No TTL/eviction yet —
// intentionally deferred until we have a reason (e.g. data going stale
// mid-session, or memory growth from many users). When session state moves
// to Redis/a DB, this is a natural candidate to move alongside it.
const cache = new Map<string, unknown>();

function buildCacheKey(spotifyUserId: string, dataKind: string, params?: CacheKeyParams): string {
  const paramsPart = params
    ? Object.entries(params)
        .filter(([, value]) => value !== undefined)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, value]) => `${key}=${value}`)
        .join('&')
    : '';

  return paramsPart ? `${spotifyUserId}:${dataKind}:${paramsPart}` : `${spotifyUserId}:${dataKind}`;
}

/**
 * Lazy per-user cache for Spotify data. Generic over "data kind" so future
 * question types can cache whatever Spotify data they need (recently
 * played, saved albums, audio features, ...) without changes here — each
 * kind just needs a unique `dataKind` string and a `fetcher`.
 *
 * On first request for a given (spotifyUserId, dataKind, params)
 * combination, `fetcher` runs and its result is stored; subsequent calls
 * for the same key are served from memory without hitting Spotify again.
 */
export async function getOrFetchSpotifyData<T>(input: {
  spotifyUserId: string;
  dataKind: string;
  params?: CacheKeyParams;
  fetcher: () => Promise<T>;
}): Promise<T> {
  const key = buildCacheKey(input.spotifyUserId, input.dataKind, input.params);

  if (cache.has(key)) {
    return cache.get(key) as T;
  }

  const value = await input.fetcher();
  cache.set(key, value);
  return value;
}

/** Drops all cached data for a single user (e.g. on disconnect/reconnect). */
export function clearSpotifyDataCacheForUser(spotifyUserId: string): void {
  for (const key of cache.keys()) {
    if (key.startsWith(`${spotifyUserId}:`)) {
      cache.delete(key);
    }
  }
}

/** Escape hatch for tests. */
export function clearSpotifyDataCache(): void {
  cache.clear();
}