// features/player/PlayerContext.tsx
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { SpotifyPlayer } from './SpotifyPlayer';

const LOBBY_VOLUME = 0.25;
const QUIZ_VOLUME = 1;

interface PlayerContextValue {
  deviceId: string | null;
  isReady: boolean;
  currentTrackUri: string | null;
  play: (trackUri: string | null) => Promise<void>;
  // Lets a quiz screen drop playback down to lobby-level volume for question
  // types that don't play a track (e.g. artist-rank) — otherwise a track
  // from the previous question would keep blaring at full quiz volume.
  setQuietMode: (isQuiet: boolean) => void;
}

const PlayerContext = createContext<PlayerContextValue | null>(null);

export function PlayerProvider({ children }: { children: ReactNode }) {
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [currentTrackUri, setCurrentTrackUri] = useState<string | null>(null);
  const [isQuiet, setIsQuiet] = useState(false);
  const playbackErrorTick = useRef(0);
  const location = useLocation();
  const isQuizRoute = location.pathname.startsWith('/quiz');
  const volume = isQuizRoute && !isQuiet ? QUIZ_VOLUME : LOBBY_VOLUME;

  // Don't let a quiet flag from a previous quiz session linger once we've
  // left the quiz entirely.
  useEffect(() => {
    if (!isQuizRoute) setIsQuiet(false);
  }, [isQuizRoute]);

  const setQuietMode = useCallback((quiet: boolean) => {
    setIsQuiet(quiet);
  }, []);

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
  <PlayerContext.Provider value={{ deviceId, isReady: deviceId !== null, currentTrackUri, play, setQuietMode }}>      {children}
      <SpotifyPlayer volume={volume} onDeviceReady={setDeviceId} onPlaybackError={handlePlaybackError} />
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