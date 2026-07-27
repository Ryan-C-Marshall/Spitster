// features/player/PlayerContext.tsx
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { SpotifyPlayer } from './SpotifyPlayer';

interface PlayerContextValue {
  deviceId: string | null;
  isReady: boolean;
  currentTrackUri: string | null;
  play: (trackUri: string | null) => Promise<void>;
}

const PlayerContext = createContext<PlayerContextValue | null>(null);

export function PlayerProvider({ children }: { children: ReactNode }) {
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [currentTrackUri, setCurrentTrackUri] = useState<string | null>(null);
  const playbackErrorTick = useRef(0);

  const handlePlaybackError = useCallback(() => {
    playbackErrorTick.current += 1;
  }, []);

  const play = useCallback(async (trackUri: string | null, attempt = 1): Promise<void> => {

    console.log("Playing track:", trackUri, "on device:", deviceId);
    
    if (!deviceId) {
      throw new Error('Player is not ready yet');
    }
    if (!trackUri) {
      console.warn('No track URI provided to play');
      return;
    }

    const markerBefore = playbackErrorTick.current;

    const response = await fetch('/spotify/me/player/play', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId, trackUri }),
    });
    if (!response.ok) {
      throw new Error('Failed to start playback');
    }

    // Spotify's backend needs a moment to fully activate a freshly-connected
    // device; the very first play attempt against it can silently fail deep
    // inside the SDK (storage-resolve 403) even though this request succeeds.
    // Give it a beat, then retry if a playback_error fired in that window.
    await new Promise((resolve) => setTimeout(resolve, 800));

    if (playbackErrorTick.current !== markerBefore && attempt < 3) {
      return play(trackUri, attempt + 1);
    }

    setCurrentTrackUri(trackUri);
  }, [deviceId]);

  return (
  <PlayerContext.Provider value={{ deviceId, isReady: deviceId !== null, currentTrackUri, play }}>      {children}
      <SpotifyPlayer onDeviceReady={setDeviceId} onPlaybackError={handlePlaybackError} />
    </PlayerContext.Provider>
  );
}

export function usePlayer() {
  const context = useContext(PlayerContext);
  if (!context) {
    throw new Error('usePlayer must be used within a PlayerProvider');
  }
  return context;
}