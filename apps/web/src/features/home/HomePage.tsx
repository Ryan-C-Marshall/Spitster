import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { fetchSession, prepareQuiz } from '../../lib/apiClient.js';
import type { SpotifySessionSummary, SpotifyConnectedAccountSummary } from '@spitster/shared';
import { usePlayer } from '../player/PlayerContext.js';

export function HomePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [session, setSession] = useState<SpotifySessionSummary | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [pendingAutoPlayAccountId, setPendingAutoPlayAccountId] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const { play, isReady, currentTrackUri } = usePlayer();

  useEffect(() => {
    fetchSession().then((data) => {
      setSession(data.session ?? null);
    });
  }, []);

  useEffect(() => {
    const auth = searchParams.get('auth');
    const accountId = searchParams.get('accountId');
    const message = searchParams.get('message');

    if (auth === 'success') {
      setStatusMessage('Player added to the lobby.');
      setPendingAutoPlayAccountId(accountId);
      navigate('/', { replace: true });
    }

    if (auth === 'failed') {
      setStatusMessage(message ?? 'Failed to retrieve that player\'s Spotify account.');
      navigate('/', { replace: true });
    }
  }, [navigate, searchParams]);

  async function handleConnectNextPlayer() {
    console.log('Connecting next player...');
    setIsBusy(true);

    try {
      window.location.assign('/auth/login');
    } catch (error) {
      console.error('Error occurred while connecting next player:', error);
    }
    finally {
      setIsBusy(false);
    }
  }

  // Once the just-connected account shows up in the session with a top
  // track, and the player has a device to send it to, start playback.
  useEffect(() => {
    if (!pendingAutoPlayAccountId || !isReady || !session) return;

    console.log('Attempting to auto-play top track for account:', pendingAutoPlayAccountId, 'on device:', isReady ? 'ready' : 'not ready');

    const account = session.connectedAccounts.find(
      (candidate) => candidate.spotifyUserId === pendingAutoPlayAccountId,
    );
    if (!account) return;

    setPendingAutoPlayAccountId(null);

    if (account.topTrack) {
      handlePlayTrack(account, account.topTrack.uri);
    }
  }, [pendingAutoPlayAccountId, isReady, session]);

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

  async function handlePlayTrack(account: SpotifyConnectedAccountSummary, trackUri: string | null) {
    if (account.topTrack?.uri === currentTrackUri) {
      console.log("Track is already playing."); return;
    }

    try {
      await play(trackUri);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Unable to play track.');
    }
  }

  function handleStartQuiz() {
    navigate('/quiz');
  }

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <h1>Lobby</h1>
          <p>Connect each player’s Spotify account before starting the quiz.</p>
        </div>
        <div className="panel-actions">
          <button type="button" className="secondary-button" onClick={handleConnectNextPlayer} disabled={isBusy}>
            Connect next player
          </button>
          <button type="button" className="primary-button" onClick={handlePrepareQuiz} disabled={isBusy || !session?.authenticated}>
            Prepare quiz
          </button>
          <button
            type="button"
            className="primary-button"
            onClick={handleStartQuiz}
            disabled={isBusy || session?.quizPreparation?.status !== 'ready'}
          >
            Start quiz
          </button>
        </div>
      </div>

      {statusMessage ? <div className="banner">{statusMessage}</div> : null}

      {!session?.authenticated ? (
        <p className="muted">No players are connected yet.</p>
      ) : (
        <div className="lobby-grid">
          {session.connectedAccounts.map((account) => {
            const isPlaying = account.topTrack?.uri != null && account.topTrack.uri === currentTrackUri;

            return (
              <article
                className={`lobby-card${account.isHost ? ' host' : ''}${isPlaying ? ' playing' : ''}`}
                key={account.spotifyUserId}
                role="button"
                tabIndex={0}
                aria-pressed={isPlaying}
                onClick={() => handlePlayTrack(account, account.topTrack?.uri ?? null)}
              >
                <div>
                  <h2>{account.displayName ?? account.spotifyUserId}</h2>
                  {account.isHost ? <span className="host-badge">Host</span> : null}
                  <p>{account.username ?? account.spotifyUserId}</p>
                  <p>{account.topTrack?.name ?? 'No top track'}</p>
                </div>
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