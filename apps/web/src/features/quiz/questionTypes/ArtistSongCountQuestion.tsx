import { useEffect, useRef, useState } from 'react';
import type { ArtistSongCountQuestion } from '@spitster/shared';

// Full back-and-forth period of the sinusoidal oscillation, in ms. Tuned to
// feel roughly as lively as the old linear bounce without being distracting
// or hard to track by eye.
const OSCILLATION_PERIOD_MS = 5_000;
const ANGULAR_SPEED_RADIANS_PER_MS = (2 * Math.PI) / OSCILLATION_PERIOD_MS;

// Base of the "within N guesses" hint below — see computeGuessBudget.
const GUESS_BUDGET_LOG_BASE = 1.9;

// Converts a 1..max value into a 0..1 fraction of the line's width. The
// line visually starts at 1, so a value of 1 sits at fraction 0.
function valueToFraction(value: number, max: number): number {
  if (max <= 1) return 0;
  return (value - 1) / (max - 1);
}

// How many guesses it'd take to narrow the number line down if each guess
// only eliminated a factor of GUESS_BUDGET_LOG_BASE of the remaining range
// (rather than a full binary search's factor of 2) — a gentler hint than
// log2 that still scales down as the line gets shorter. Floored, and
// clamped to at least 1 so the hint never reads as "Within 0".
function computeGuessBudget(numberLineMax: number): number {
  if (numberLineMax <= 1) return 1;
  const raw = (Math.log(numberLineMax) / Math.log(GUESS_BUDGET_LOG_BASE)) - 2;
  return Math.max(0, Math.floor(raw));
}

export function ArtistSongCountQuestionView({
  question,
  revealed,
}: {
  question: ArtistSongCountQuestion;
  revealed: boolean;
}) {
  // 0..1 fraction along the line, driven by requestAnimationFrame while
  // unrevealed. A ref (rather than only state) holds the authoritative
  // position so the animation loop can read the latest value without
  // re-subscribing on every frame; state exists purely to trigger renders.
  const [fraction, setFraction] = useState(0);
  const fractionRef = useRef(0);
  // Starting angle (radians) and direction of travel around the sine wave,
  // randomized per-question so the dot doesn't always begin at the same
  // spot or sweep the same way.
  const phaseRef = useRef(0);
  const directionRef = useRef<1 | -1>(1);
  const rafIdRef = useRef<number | null>(null);
  // Timestamp of the first animation frame for the current question, used
  // as the origin for elapsed-time-based angle computation rather than
  // accumulating per-frame deltas (which would drift with frame jitter).
  const startTimestampRef = useRef<number | null>(null);

  function fractionFromAngle(angle: number): number {
    return (Math.sin(angle) + 1) / 2;
  }

  useEffect(() => {
    // Reset the oscillation to a fresh, randomized start each time a new
    // question comes in, so the dot doesn't always begin at the same spot.
    phaseRef.current = Math.random() * Math.PI * 2;
    directionRef.current = Math.random() < 0.5 ? 1 : -1;
    startTimestampRef.current = null;
    fractionRef.current = fractionFromAngle(phaseRef.current);
    setFraction(fractionRef.current);
  }, [question.id]);

  useEffect(() => {
    if (revealed) {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      return;
    }

    function step(timestamp: number) {
      if (startTimestampRef.current === null) {
        startTimestampRef.current = timestamp;
      }
      const elapsedMs = timestamp - startTimestampRef.current;

      const angle = phaseRef.current + directionRef.current * ANGULAR_SPEED_RADIANS_PER_MS * elapsedMs;
      const next = fractionFromAngle(angle);

      fractionRef.current = next;
      setFraction(next);
      rafIdRef.current = requestAnimationFrame(step);
    }

    rafIdRef.current = requestAnimationFrame(step);
    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
  }, [revealed, question.id]);

  const displayFraction = revealed ? valueToFraction(question.correctCount, question.numberLineMax) : fraction;
  const guessBudget = computeGuessBudget(question.numberLineMax);

  return (
    <div className="question-card">
      <div className="question-header">
        <div style={{ flex: 1, minWidth: 200 }}>
          <h2>How many songs?</h2>
          <p className="track-reveal-artist">
            <span className="bingo-important-highlight">Within {guessBudget}</span>, how many of{' '}
            <span className="bingo-important-highlight">{question.displayName ?? question.spotifyUserId}&rsquo;s </span>
            top 100 songs over the last 4 weeks are by {question.artist.name}?
          </p>
        </div>
      </div>

      <div className="number-line-container">
        <div className="number-line-track">
          <div
            className={`number-line-dot${revealed ? ' number-line-dot--revealed' : ''}`}
            style={{ left: `${displayFraction * 100}%` }}
          >
            {revealed ? <span className="number-line-dot-label">{question.correctCount}</span> : null}
          </div>
        </div>
        <div className="number-line-endpoints">
          <span>1</span>
          <span>{question.numberLineMax}</span>
        </div>
      </div>
    </div>
  );
}
