export const SPOTIFY_AUTH_SCOPES = [
  'user-read-email',
  'user-read-private',
  'user-read-playback-state',
  'user-modify-playback-state',
  'user-read-currently-playing',
  'user-read-recently-played',
  'user-top-read',
  'user-library-read',
  'playlist-read-private',
  'playlist-read-collaborative',
  'streaming'
] as const;

export const SPOTIFY_SCOPE_STRING = SPOTIFY_AUTH_SCOPES.join(' ');
