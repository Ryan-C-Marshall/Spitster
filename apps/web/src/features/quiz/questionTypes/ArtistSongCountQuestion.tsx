import { useEffect, useRef, useState } from 'react';
import type { ArtistSongCountQuestion } from '@spitster/shared';

// Pixels-per-second the dot travels while bouncing. Tuned to feel lively
// without being distracting or hard to track by eye.
const BOUNCE_SPEED_FRACTION_PER_MS = 0.00045;

// Converts a 1..max value into a 0..1 fraction of the line's width. The
// line visually starts at 1, so a value of 1 sits at fraction 0.
function valueToFraction(value: number, max: number): number {
  if (max <= 1) return 0;
  return (value - 1) / (max - 1);
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
  const directionRef = useRef<1 | -1>(1);
  const rafIdRef = useRef<number | null>(null);
  const lastTimestampRef = useRef<number | null>(null);

  useEffect(() => {
    // Reset the bounce to a fresh, randomized start each time a new
    // question comes in, so the dot doesn't always begin at the same spot.
    fractionRef.current = Math.random();
    directionRef.current = Math.random() < 0.5 ? 1 : -1;
    lastTimestampRef.current = null;
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
      if (lastTimestampRef.current === null) {
        lastTimestampRef.current = timestamp;
      }
      const elapsedMs = timestamp - lastTimestampRef.current;
      lastTimestampRef.current = timestamp;

      let next = fractionRef.current + directionRef.current * elapsedMs * BOUNCE_SPEED_FRACTION_PER_MS;

      // Bounce off either end rather than wrapping — reflect the overshoot
      // back into range and flip direction.
      if (next > 1) {
        next = 2 - next;
        directionRef.current = -1;
      } else if (next < 0) {
        next = -next;
        directionRef.current = 1;
      }

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

  return (
    <div className="question-card">
      <div className="question-header">
        <div style={{ flex: 1, minWidth: 200 }}>
          <h2>How many songs?</h2>
          <p className="track-reveal-artist">
            Of {question.displayName ?? question.spotifyUserId}&rsquo;s top 100 songs over the last 4 weeks, how
            many are by {question.artist.name}?
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
