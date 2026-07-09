import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

export function AuthCallbackPage() {
  const navigate = useNavigate();
  const [message, setMessage] = useState('Completing Spotify connection...');

  useEffect(() => {
    const finishAuth = async () => {
      const params = new URLSearchParams(window.location.search);
      const auth = params.get('auth');

      if (auth === 'success') {
        setMessage('Spotify connected. Returning to the lobby...');
        navigate(`/${window.location.search}`, { replace: true });
        return;
      }

      if (auth === 'failed') {
        const failedMessage = params.get('message') ?? 'Failed to retrieve that player\'s Spotify account.';
        setMessage(failedMessage);
        navigate(`/${window.location.search}`, { replace: true });
      } else {
        setMessage('Waiting for Spotify callback...');
      }
    };

    finishAuth();
  }, [navigate]);

  return <section className="panel">{message}</section>;
}
