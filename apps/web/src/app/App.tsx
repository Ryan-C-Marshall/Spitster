import { Link, Route, Routes } from 'react-router-dom';

import { AuthCallbackPage } from '../features/auth/AuthCallbackPage.js';
import { QuizPage } from '../features/quiz/QuizPage.js';
import { SpotifyPlayer } from '../features/player/SpotifyPlayer.js';

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
        <Routes>
          <Route path="/" element={<QuizPage />} />
          <Route path="/auth/callback" element={<AuthCallbackPage />} />
        </Routes>
      </main>

      <SpotifyPlayer />
    </div>
  );
}
