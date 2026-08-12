import { useEffect } from 'react';

import { BINGO_COLOR_PALETTE, BINGO_QUESTION_CATALOG, getBingoSpinnerSections } from '../quiz/bingoSpinnerSections.js';
import { CLASSIC_TIME_RANGE_OPTIONS, CLASSIC_TRACK_COUNT_OPTIONS } from './classicInputSourceOptions.js';
import { useSettings } from './SettingsContext.js';

export function SettingsPanel({ onClose }: { onClose: () => void }) {
  const {
    classicInputSource,
    setClassicInputSource,
    activeBingoTypes,
    setBingoTypeActive,
    bingoColorOverrides,
    setBingoTypeColor,
  } = useSettings();

  // Close on Escape, same as clicking the backdrop or the close button.
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Colors are previewed here exactly as the spinner will assign them —
  // a per-type override if one has been chosen, else catalog order cycling
  // through the palette — so picking a swatch or toggling a checkbox
  // updates every swatch on screen live.
  const previewSections = getBingoSpinnerSections(activeBingoTypes, bingoColorOverrides);
  const colorByType = new Map(previewSections.map((section) => [section.type, section.color]));

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-panel-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-panel-header">
          <h2 id="settings-panel-title">Settings</h2>
          <button type="button" className="text-button" onClick={onClose} aria-label="Close settings">
            Close
          </button>
        </div>

        <div className="settings-section">
          <h3>Classic mode source</h3>
          <p className="muted">Which of each player's top tracks the crowd-favorite question samples from.</p>

          <div className="settings-row">
            <label htmlFor="classic-time-range">Time range</label>
            <select
              id="classic-time-range"
              className="settings-select"
              value={classicInputSource.timeRange}
              onChange={(event) =>
                setClassicInputSource({
                  ...classicInputSource,
                  timeRange: event.target.value as typeof classicInputSource.timeRange,
                })
              }
            >
              {CLASSIC_TIME_RANGE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="settings-row">
            <label htmlFor="classic-track-count">Track count</label>
            <select
              id="classic-track-count"
              className="settings-select"
              value={classicInputSource.limit}
              onChange={(event) =>
                setClassicInputSource({ ...classicInputSource, limit: Number(event.target.value) })
              }
            >
              {CLASSIC_TRACK_COUNT_OPTIONS.map((count) => (
                <option key={count} value={count}>
                  Top {count}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="section-divider" />

        <div className="settings-section">
          <h3>Bingo questions</h3>
          <p className="muted">
            Choose which question types can come up, and pick which color each one uses on the spinner. A type
            with no color chosen falls back to the palette in the order above, wrapping around if there are more
            active questions than colors.
          </p>

          <div className="settings-checkbox-list">
            {BINGO_QUESTION_CATALOG.map((entry) => {
              const isActive = activeBingoTypes.has(entry.type);
              const isOnlyActive = isActive && activeBingoTypes.size <= 1;
              const currentColor = colorByType.get(entry.type);

              return (
                <div key={entry.type} className="settings-checkbox-row">
                  <label className="settings-checkbox-row-label">
                    <input
                      type="checkbox"
                      checked={isActive}
                      disabled={isOnlyActive}
                      onChange={(event) => setBingoTypeActive(entry.type, event.target.checked)}
                    />
                    <span>{entry.label}</span>
                  </label>

                  <div className="settings-color-picker" role="group" aria-label={`Color for ${entry.label}`}>
                    {BINGO_COLOR_PALETTE.map((paletteColor) => {
                      const isSelected = currentColor === paletteColor;

                      return (
                        <button
                          key={paletteColor}
                          type="button"
                          className={`settings-color-swatch settings-color-swatch--button${
                            isSelected ? ' settings-color-swatch--selected' : ''
                          }`}
                          style={{ backgroundColor: paletteColor }}
                          aria-pressed={isSelected}
                          aria-label={`Use this color for ${entry.label}`}
                          onClick={() => setBingoTypeColor(entry.type, paletteColor)}
                        />
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
