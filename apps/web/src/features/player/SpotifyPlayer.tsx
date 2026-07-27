import { useEffect, useRef, useState } from 'react';

declare global {
  interface Window {
    onSpotifyWebPlaybackSDKReady: () => void;
    Spotify: typeof Spotify;
  }
}

const SDK_SRC = 'https://sdk.scdn.co/spotify-player.js';

async function fetchPlayerAccessToken(): Promise<string> {
  const response = await fetch('/spotify/me/player-token', { credentials: 'include' });
  if (!response.ok) {
    throw new Error('Failed to fetch playback token');
  }
  const data = (await response.json()) as { accessToken: string };
  return data.accessToken;
}

interface SpotifyPlayerProps {
  onDeviceReady?: (deviceId: string) => void;
  onPlaybackError?: (message: string) => void;
}

export function SpotifyPlayer({ onDeviceReady, onPlaybackError }: SpotifyPlayerProps) {
  const playerRef = useRef<Spotify.Player | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    let cancelled = false;

    function initializePlayer() {
      const player = new window.Spotify.Player({
        name: 'Spitster Quiz Player',
        getOAuthToken: (callback) => {
          fetchPlayerAccessToken()
            .then(callback)
            .catch((error) => console.error('Failed to get Spotify access token', error));
        },
        volume: 0.5,
      });

      player.addListener('ready', ({ device_id }) => {
        if (cancelled) return;
        setStatus('ready');
        onDeviceReady?.(device_id);
      });
      player.addListener('not_ready', ({ device_id }) => {
        console.warn('Spotify player went offline:', device_id);
      });
      player.addListener('initialization_error', ({ message }) => {
        console.error('Spotify player init error:', message);
        setStatus('error');
      });
      player.addListener('authentication_error', ({ message }) => {
        console.error('Spotify player auth error:', message);
        setStatus('error');
      });
      player.addListener('account_error', ({ message }) => {
        console.error('Spotify player account error (Premium required?):', message);
        setStatus('error');
      });
      player.addListener('playback_error', ({ message }) => {
        console.error('Spotify playback error:', message);
        onPlaybackError?.(message);
      });

      player.connect();
      playerRef.current = player;
    }

    if (window.Spotify) {
      initializePlayer();
    } else {
      if (!document.querySelector(`script[src="${SDK_SRC}"]`)) {
        const script = document.createElement('script');
        script.src = SDK_SRC;
        script.async = true;
        document.body.appendChild(script);
      }
      window.onSpotifyWebPlaybackSDKReady = initializePlayer;
    }

    return () => {
      cancelled = true;
      playerRef.current?.disconnect();
      playerRef.current = null;
    };
  }, [onDeviceReady, onPlaybackError]);

  return <div id="spotify-player-anchor" aria-hidden="true" data-status={status} />;
}