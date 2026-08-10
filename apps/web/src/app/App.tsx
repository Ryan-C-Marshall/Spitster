import { Link, Route, Routes, useLocation } from 'react-router-dom';

import { AuthCallbackPage } from '../features/auth/AuthCallbackPage.js';
import { HomePage } from '../features/home/HomePage.js';
import { QuizPage } from '../features/quiz/QuizPage.js';
import { PlayerProvider } from '../features/player/PlayerContext.js';
import { GAME_MODE_LABELS, getGameModeFromPathname } from '../features/quiz/quizMode.js';
import { BingoWordmark } from '../features/quiz/BingoWordmark.js';
// Dev-only harness for the venn player-name labels — see VennLabelsDevPage
// for details. The route below is guarded by import.meta.env.DEV, which
// Vite replaces with a constant at build time; that lets Rollup dead-code
// eliminate both the route and this import from production builds.
import { VennLabelsDevPage } from '../features/dev/VennLabelsDevPage.js';

export function App() {
  const location = useLocation();
  const gameMode = getGameModeFromPathname(location.pathname);

  return (
    <div className="shell">
      <header className="topbar">
        <div className="topbar-left">
          <Link to="/" className="brand">
            Spitster
          </Link>
          {gameMode ? (
            <span className="mode-pill">
              {gameMode === 'bingo' ? <BingoWordmark /> : GAME_MODE_LABELS[gameMode]}
            </span>
          ) : null}
        </div>

      </header>

      <main className="main">
        <PlayerProvider>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/quiz" element={<QuizPage />} />
            <Route path="/quiz/:mode" element={<QuizPage />} />
            <Route path="/auth/callback" element={<AuthCallbackPage />} />
            {import.meta.env.DEV ? (
              <Route path="/dev/venn-labels" element={<VennLabelsDevPage />} />
            ) : null}
          </Routes>
        </PlayerProvider>
      </main>

    </div>
  );
}