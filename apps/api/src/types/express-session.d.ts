import 'express-session';

import type { SpotifySessionState } from '@spitster/shared';
import type { AnswerHistoryStore } from '../services/quiz/answerHistory.service.js';

declare module 'express-session' {
  interface SessionData {
    spotify?: SpotifySessionState;
    quizHistory?: AnswerHistoryStore;
  }
}