// features/player/PlayerContext.tsx
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
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

  const play = useCallback(async (trackUri: string | null) => {
    console.log("Playing track:", trackUri, "on device:", deviceId);
    
    if (!deviceId) {
      throw new Error('Player is not ready yet');
    }
    if (!trackUri) {
      console.warn('No track URI provided to play');
      return;
    }

    const response = await fetch('/spotify/me/player/play', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId, trackUri }),
    });
    if (!response.ok) {
      throw new Error('Failed to start playback');
    }
    setCurrentTrackUri(trackUri);
  }, [deviceId]);

  return (
  <PlayerContext.Provider value={{ deviceId, isReady: deviceId !== null, currentTrackUri, play }}>      {children}
      <SpotifyPlayer onDeviceReady={setDeviceId} />
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