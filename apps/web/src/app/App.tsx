import { Link, Route, Routes, useLocation } from 'react-router-dom';

import { AuthCallbackPage } from '../features/auth/AuthCallbackPage.js';
import { HomePage } from '../features/home/HomePage.js';
import { QuizPage } from '../features/quiz/QuizPage.js';
import { PlayerProvider } from '../features/player/PlayerContext.js';
import { GAME_MODE_LABELS, getGameModeFromPathname } from '../features/quiz/quizMode.js';

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
          {gameMode ? <span className="mode-pill">{GAME_MODE_LABELS[gameMode]}</span> : null}
        </div>

      </header>

      <main className="main">
        <PlayerProvider>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/quiz" element={<QuizPage />} />
            <Route path="/quiz/:mode" element={<QuizPage />} />
            <Route path="/auth/callback" element={<AuthCallbackPage />} />
          </Routes>
        </PlayerProvider>
      </main>

    </div>
  );
}