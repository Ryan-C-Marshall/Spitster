import { z } from 'zod';

export const spotifyUserProfileSchema = z.object({
  id: z.string(),
  display_name: z.string().nullable(),
  uri: z.string(),
  href: z.string(),
});

export const quizKindSchema = z.enum(['top-tracks', 'playlists', 'library', 'friends']);

export const quizPlayerInputSchema = z.object({
  displayName: z.string().min(1),
  spotifyUserId: z.string().min(1).optional(),
  spotifyUsername: z.string().min(1).optional(),
  accessTokenSource: z.enum(['session', 'public']),
});
