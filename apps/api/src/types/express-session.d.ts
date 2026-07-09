import 'express-session';

import type { SpotifySessionState } from '@spitster/shared';

declare module 'express-session' {
  interface SessionData {
    spotify?: SpotifySessionState;
  }
}