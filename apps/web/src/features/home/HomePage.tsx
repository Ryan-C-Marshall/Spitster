import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { fetchSession } from '../../lib/apiClient.js';
import type { GameMode, SpotifySessionSummary, SpotifyConnectedAccountSummary } from '@spitster/shared';
import { usePlayer } from '../player/PlayerContext.js';
import { BingoWordmark } from '../quiz/BingoWordmark.js';

export function HomePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [session, setSession] = useState<SpotifySessionSummary | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [pendingAutoPlayAccountId, setPendingAutoPlayAccountId] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [gameMode, setGameMode] = useState<GameMode>('classic');
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

    const account = session.connectedAccounts.find(
      (candidate) => candidate.spotifyUserId === pendingAutoPlayAccountId,
    );
    if (!account) return;

    setPendingAutoPlayAccountId(null);

    if (account.topTrack) {
      handlePlayTrack(account, account.topTrack.uri);
    }
  }, [pendingAutoPlayAccountId, isReady, session]);

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
    navigate(`/quiz/${gameMode}`);
  }

  return (
    <section className={`panel${gameMode === 'bingo' ? ' bingo-mode-border' : ''}`}>
      <div className="panel-header">
        <div>
          <h1>Lobby</h1>
          <p>Connect each player’s Spotify account before starting the quiz.</p>
        </div>
        <div className="panel-actions">
          <div className="mode-toggle" role="radiogroup" aria-label="Game mode">
            <button
              type="button"
              className={`secondary-button${gameMode === 'bingo' ? ' selected' : ''}`}
              role="radio"
              aria-checked={gameMode === 'bingo'}
              onClick={() => setGameMode('bingo')}
            >
              <BingoWordmark />
            </button>
            <button
              type="button"
              className={`secondary-button${gameMode === 'classic' ? ' selected' : ''}`}
              role="radio"
              aria-checked={gameMode === 'classic'}
              onClick={() => setGameMode('classic')}
            >
              Classic
            </button>
          </div>
          <button type="button" className="secondary-button" onClick={handleConnectNextPlayer} disabled={isBusy}>
            Connect next player
          </button>
          <button
            type="button"
            className="primary-button"
            onClick={handleStartQuiz}
            disabled={isBusy || (session?.connectedAccounts.length ?? 0) < 2}
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
    </section>
  );
}