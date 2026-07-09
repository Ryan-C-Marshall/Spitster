import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { fetchSession, prepareQuiz, selectSpotifyAccount } from '../../lib/apiClient.js';
import type { SpotifySessionSummary } from '@spitster/shared';

export function QuizPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [session, setSession] = useState<SpotifySessionSummary | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    fetchSession().then((data) => {
      setSession(data.session ?? null);
    });
  }, []);

  useEffect(() => {
    const auth = searchParams.get('auth');
    const message = searchParams.get('message');

    if (auth === 'success') {
      setStatusMessage('Player added to the lobby.');
      navigate('/', { replace: true });
    }

    if (auth === 'failed') {
      setStatusMessage(message ?? 'Failed to retrieve that player\'s Spotify account.');
      navigate('/', { replace: true });
    }
  }, [navigate, searchParams]);

  async function handleConnectNextPlayer() {
    setIsBusy(true);
    try {
      window.location.assign('/auth/login');
    } finally {
      setIsBusy(false);
    }
  }

  async function handlePrepareQuiz() {
    setIsBusy(true);
    try {
      await prepareQuiz();
      const data = await fetchSession();
      setSession(data.session ?? null);
      setStatusMessage('Collected data from all connected players.');
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Unable to prepare quiz.');
    } finally {
      setIsBusy(false);
    }
  }

  async function handleSelectAccount(spotifyUserId: string) {
    setIsBusy(true);
    try {
      await selectSpotifyAccount(spotifyUserId);
      const data = await fetchSession();
      setSession(data.session ?? null);
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <h1>Lobby</h1>
          <p>Connect each player’s Spotify account before building the quiz.</p>
        </div>
        <div className="panel-actions">
          <button type="button" className="secondary-button" onClick={handleConnectNextPlayer} disabled={isBusy}>
            Connect next player
          </button>
          <button type="button" className="primary-button" onClick={handlePrepareQuiz} disabled={isBusy || !session?.authenticated}>
            Prepare quiz
          </button>
        </div>
      </div>

      {statusMessage ? <div className="banner">{statusMessage}</div> : null}

      {!session?.authenticated ? (
        <p className="muted">No players are connected yet.</p>
      ) : (
        <div className="lobby-grid">
          {session.connectedAccounts.map((account) => {
            const isSelected = session.selectedSpotifyUserId === account.spotifyUserId;

            return (
              <article className={`lobby-card${isSelected ? ' selected' : ''}`} key={account.spotifyUserId}>
                <div>
                  <h2>{account.displayName ?? account.spotifyUserId}</h2>
                  <p>{account.username ?? account.spotifyUserId}</p>
                </div>
                <button type="button" className="text-button" onClick={() => handleSelectAccount(account.spotifyUserId)} disabled={isBusy}>
                  {isSelected ? 'Selected' : 'Select'}
                </button>
              </article>
            );
          })}
        </div>
      )}

      {session?.quizPreparation ? (
        <div className="prep-state">
          <p className="muted">Quiz prep status: {session.quizPreparation.status}</p>
          <p className="muted">Collected player data: {session.quizPreparation.players.length}</p>
        </div>
      ) : null}
    </section>
  );
}
