import type { GameMode } from '@spitster/shared';

export const GAME_MODES: GameMode[] = ['bingo', 'classic'];

export const GAME_MODE_LABELS: Record<GameMode, string> = {
  bingo: 'Bingo',
  classic: 'Classic',
};

export function parseGameMode(value: string | undefined): GameMode {
  return GAME_MODES.includes(value as GameMode) ? (value as GameMode) : 'bingo';
}

export function getGameModeFromPathname(pathname: string): GameMode | null {
  if (!pathname.startsWith('/quiz')) {
    return null;
  }

  const modeFromPath = pathname.split('/')[2];
  return parseGameMode(modeFromPath);
}