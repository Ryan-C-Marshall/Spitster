import { Link, Route, Routes } from 'react-router-dom';

import { AuthCallbackPage } from '../features/auth/AuthCallbackPage.js';
import { QuizPage } from '../features/quiz/QuizPage.js';
import { PlayerProvider } from '../features/player/PlayerContext.js';

export function App() {
  return (
    <div className="shell">
      <header className="topbar">
        <Link to="/" className="brand">
          Spitster
        </Link>
        <nav className="nav">
          <a href="/auth/login">Connect player</a>
        </nav>
      </header>

      <main className="main">
        <PlayerProvider>
          <Routes>
            <Route path="/" element={<QuizPage />} />
            <Route path="/auth/callback" element={<AuthCallbackPage />} />
          </Routes>
        </PlayerProvider>
      </main>

    </div>
  );
}
