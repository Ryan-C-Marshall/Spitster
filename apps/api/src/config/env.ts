import { z } from 'zod';
import dotenv from 'dotenv';
import path from 'path';

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3001),
  FRONTEND_ORIGIN: z.string().url().default('http://127.0.0.1:5173'),
  SESSION_SECRET: z.string().min(1).default('replace-me'),
  SPOTIFY_CLIENT_ID: z.string().min(1).optional(),
  SPOTIFY_REDIRECT_URI: z.string().url().optional(),
  SPOTIFY_AUTHORIZE_URL: z.string().url().default('https://accounts.spotify.com/authorize'),
  SPOTIFY_TOKEN_URL: z.string().url().default('https://accounts.spotify.com/api/token'),
  SPOTIFY_API_BASE_URL: z.string().url().default('https://api.spotify.com/v1'),
});

let cachedEnv: z.infer<typeof envSchema> | null = null;

export function getEnv() {
  if (!cachedEnv) {
    dotenv.config({ 
      path: path.resolve(process.cwd(), '../../.env'),
      override: true 
    });

    cachedEnv = envSchema.parse(process.env);
  }

  return {
    port: cachedEnv.PORT,
    frontendOrigin: cachedEnv.FRONTEND_ORIGIN,
    sessionSecret: cachedEnv.SESSION_SECRET,
    spotifyClientId: cachedEnv.SPOTIFY_CLIENT_ID,
    spotifyRedirectUri: cachedEnv.SPOTIFY_REDIRECT_URI,
    spotifyAuthorizeUrl: cachedEnv.SPOTIFY_AUTHORIZE_URL,
    spotifyTokenUrl: cachedEnv.SPOTIFY_TOKEN_URL,
    spotifyApiBaseUrl: cachedEnv.SPOTIFY_API_BASE_URL,
  };
}
