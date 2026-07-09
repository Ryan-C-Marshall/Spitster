import cors from 'cors';
import express from 'express';
import session from 'express-session';

import { authRoutes } from './routes/auth.routes.js';
import { healthRoutes } from './routes/health.routes.js';
import { quizRoutes } from './routes/quiz.routes.js';
import { spotifyRoutes } from './routes/spotify.routes.js';
import { getEnv } from './config/env.js';
import { errorHandler } from './middleware/errorHandler.js';

export function createApp() {
  const env = getEnv();
  const app = express();

  app.use(
    cors({
      origin: env.frontendOrigin,
      credentials: true,
    }),
  );
  app.use(express.json());
  app.use(
    session({
      secret: env.sessionSecret,
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        sameSite: 'lax',
        secure: false,
      },
    }),
  );

  app.use('/health', healthRoutes);
  app.use('/auth', authRoutes);
  app.use('/spotify', spotifyRoutes);
  app.use('/quiz', quizRoutes);

  app.use(errorHandler);

  return app;
}
