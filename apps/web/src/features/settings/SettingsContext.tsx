import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import type { ClassicInputSourceOptions, QuestionType } from '@spitster/shared';

import { DEFAULT_CLASSIC_INPUT_SOURCE } from './classicInputSourceOptions.js';
import { DEFAULT_ACTIVE_BINGO_TYPES } from '../quiz/bingoSpinnerSections.js';

/**
 * Game settings edited from the home page's settings panel and read from
 * the quiz page (for the actual question fetch / spinner). Deliberately
 * in-memory only — resets on page reload rather than persisting to
 * localStorage — so it lives in a plain React context at the app root
 * rather than anything backed by storage.
 */
interface SettingsContextValue {
  classicInputSource: ClassicInputSourceOptions;
  setClassicInputSource: (options: ClassicInputSourceOptions) => void;
  activeBingoTypes: Set<QuestionType>;
  setBingoTypeActive: (type: QuestionType, active: boolean) => void;
  // Per-type spinner color chosen from the settings panel's swatch picker.
  // A type with no entry here falls back to the default palette-cycling
  // assignment — see getBingoSpinnerSections.
  bingoColorOverrides: Partial<Record<QuestionType, string>>;
  setBingoTypeColor: (type: QuestionType, color: string) => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [classicInputSource, setClassicInputSource] = useState<ClassicInputSourceOptions>(
    DEFAULT_CLASSIC_INPUT_SOURCE,
  );
  const [activeBingoTypes, setActiveBingoTypes] = useState<Set<QuestionType>>(
    () => new Set(DEFAULT_ACTIVE_BINGO_TYPES),
  );
  const [bingoColorOverrides, setBingoColorOverrides] = useState<Partial<Record<QuestionType, string>>>({});

  function setBingoTypeColor(type: QuestionType, color: string) {
    setBingoColorOverrides((current) => ({ ...current, [type]: color }));
  }

  function setBingoTypeActive(type: QuestionType, active: boolean) {
    setActiveBingoTypes((current) => {
      const next = new Set(current);
      if (active) {
        next.add(type);
      } else {
        // Never let the last active question type be turned off — the
        // spinner (and bingo mode generally) needs at least one.
        if (next.size <= 1) return current;
        next.delete(type);
      }
      return next;
    });
  }

  const value = useMemo(
    () => ({
      classicInputSource,
      setClassicInputSource,
      activeBingoTypes,
      setBingoTypeActive,
      bingoColorOverrides,
      setBingoTypeColor,
    }),
    [classicInputSource, activeBingoTypes, bingoColorOverrides],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsContextValue {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}
