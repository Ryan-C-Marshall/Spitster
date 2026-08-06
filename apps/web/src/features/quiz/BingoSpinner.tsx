import { useCallback, useEffect, useRef, useState } from 'react';
import type { QuestionType } from '@spitster/shared';

import { BINGO_SPINNER_SECTIONS } from './bingoSpinnerSections.js';

type SpinnerPhase = 'idle' | 'charging' | 'spinning' | 'landed';

// Tuning knobs — all in one place so the feel is easy to adjust.
const CHARGE_MAX_MS = 2_500; // time holding space to reach full charge
const MIN_RELEASE_VELOCITY_DEG_S = 500; // spin speed from a bare tap
const MAX_RELEASE_VELOCITY_DEG_S = 2500; // spin speed from a full charge
const SPIN_DECELERATION_DEG_S2 = 500; // friction; higher = stops sooner
const STOP_VELOCITY_THRESHOLD_DEG_S = 4;

const SIZE = 340;
const CENTER = SIZE / 2;
const RING_OUTER_RADIUS = 162;
const RING_INNER_RADIUS = 70;
const BALL_RADIUS = 60;
const NEEDLE_TIP_RADIUS = RING_INNER_RADIUS - 15;
const NEEDLE_BASE_RADIUS = BALL_RADIUS - 25; // tucks under the ball's edge so the needle reads as attached to it
const NEEDLE_BASE_HALF_WIDTH = 8;

function polarToCartesian(radius: number, angleDeg: number) {
  // angleDeg is measured clockwise from straight up (12 o'clock), matching
  // how CSS rotate() sweeps positive degrees — so a section's [start, end)
  // degree range lines up directly with where the needle will point.
  const angleRad = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: CENTER + radius * Math.cos(angleRad),
    y: CENTER + radius * Math.sin(angleRad),
  };
}

function annulusWedgePath(innerR: number, outerR: number, startDeg: number, endDeg: number) {
  const startOuter = polarToCartesian(outerR, startDeg);
  const endOuter = polarToCartesian(outerR, endDeg);
  const startInner = polarToCartesian(innerR, endDeg);
  const endInner = polarToCartesian(innerR, startDeg);
  const largeArc = endDeg - startDeg > 180 ? 1 : 0;

  return [
    `M ${startOuter.x} ${startOuter.y}`,
    `A ${outerR} ${outerR} 0 ${largeArc} 1 ${endOuter.x} ${endOuter.y}`,
    `L ${startInner.x} ${startInner.y}`,
    `A ${innerR} ${innerR} 0 ${largeArc} 0 ${endInner.x} ${endInner.y}`,
    'Z',
  ].join(' ');
}

interface BingoSpinnerProps {
  onLanded: (type: QuestionType) => void;
  isFetching: boolean;
}

export function BingoSpinner({ onLanded, isFetching }: BingoSpinnerProps) {
  const sections = BINGO_SPINNER_SECTIONS;
  const sectionAngle = 360 / sections.length;

  const [phase, setPhase] = useState<SpinnerPhase>('idle');
  const [angle, setAngle] = useState(0);
  const [charge, setCharge] = useState(0);
  const [landedIndex, setLandedIndex] = useState<number | null>(null);

  const phaseRef = useRef<SpinnerPhase>('idle');
  const angleRef = useRef(0);
  const velocityRef = useRef(0);
  const chargeStartRef = useRef<number | null>(null);
  const lastFrameRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const hasLandedRef = useRef(false);
  const onLandedRef = useRef(onLanded);

  useEffect(() => {
    onLandedRef.current = onLanded;
  }, [onLanded]);

  const stopLoop = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    lastFrameRef.current = null;
  }, []);

  const tick = useCallback((timestamp: number) => {
    if (phaseRef.current === 'charging') {
      const startedAt = chargeStartRef.current ?? timestamp;
      const nextCharge = Math.min(1, (timestamp - startedAt) / CHARGE_MAX_MS);
      setCharge(nextCharge);
      rafRef.current = requestAnimationFrame(tick);
      return;
    }

    if (phaseRef.current === 'spinning') {
      const lastFrame = lastFrameRef.current;
      lastFrameRef.current = timestamp;
      const dt = lastFrame === null ? 0 : (timestamp - lastFrame) / 1000;

      const nextVelocity = Math.max(0, velocityRef.current - SPIN_DECELERATION_DEG_S2 * dt);
      angleRef.current += velocityRef.current * dt;
      velocityRef.current = nextVelocity;
      setAngle(angleRef.current);

      if (nextVelocity <= STOP_VELOCITY_THRESHOLD_DEG_S) {
        phaseRef.current = 'landed';
        setPhase('landed');

        const normalized = ((angleRef.current % 360) + 360) % 360;
        const index = Math.floor(normalized / sectionAngle) % sections.length;
        setLandedIndex(index);

        if (!hasLandedRef.current) {
          hasLandedRef.current = true;
          onLandedRef.current(sections[index].type);
        }
        return;
      }

      rafRef.current = requestAnimationFrame(tick);
    }
  }, [sectionAngle, sections]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.code !== 'Space' || event.repeat) return;
      if (phaseRef.current !== 'idle') return;

      event.preventDefault();
      chargeStartRef.current = performance.now();
      phaseRef.current = 'charging';
      setPhase('charging');
      setCharge(0);
      rafRef.current = requestAnimationFrame(tick);
    }

    function handleKeyUp(event: KeyboardEvent) {
      if (event.code !== 'Space') return;
      if (phaseRef.current !== 'charging') return;

      event.preventDefault();
      const finalCharge =
        chargeStartRef.current === null
          ? 0
          : Math.min(1, (performance.now() - chargeStartRef.current) / CHARGE_MAX_MS);

      velocityRef.current =
        MIN_RELEASE_VELOCITY_DEG_S + finalCharge * (MAX_RELEASE_VELOCITY_DEG_S - MIN_RELEASE_VELOCITY_DEG_S);
      setCharge(finalCharge);
      phaseRef.current = 'spinning';
      setPhase('spinning');
      lastFrameRef.current = null;

      if (rafRef.current === null) {
        rafRef.current = requestAnimationFrame(tick);
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      stopLoop();
    };
  }, [tick, stopLoop]);

  const isCharging = phase === 'charging';
  const isMaxCharged = isCharging && charge >= 1;
  const glowRadius = 6 + charge * 26;
  const glowOpacity = 0.25 + charge * 0.55;

  const needleTip = polarToCartesian(NEEDLE_TIP_RADIUS, 0);
  const needleBaseLeft = { x: CENTER - NEEDLE_BASE_HALF_WIDTH, y: CENTER - NEEDLE_BASE_RADIUS };
  const needleBaseRight = { x: CENTER + NEEDLE_BASE_HALF_WIDTH, y: CENTER - NEEDLE_BASE_RADIUS };

  let statusText = 'Hold SPACE to wind up the spinner';
  if (phase === 'charging') statusText = '';
  if (phase === 'spinning') statusText = '';
  if (phase === 'landed') {
    const landedLabel = landedIndex !== null ? sections[landedIndex].label : '';
    statusText = isFetching ? `Landed on ${landedLabel} — loading...` : `Landed on ${landedLabel}!`;
  }

  return (
    <div className="bingo-spinner">
      <svg
        className="bingo-spinner-svg"
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        role="img"
        aria-label="Question type spinner"
      >
        <defs>
          <radialGradient id="bingo-spinner-ball-gradient" cx="38%" cy="32%" r="75%">
            <stop offset="0%" stopColor="#f4f6fb" />
            <stop offset="55%" stopColor="#c3c9d6" />
            <stop offset="100%" stopColor="#8a90a0" />
          </radialGradient>
        </defs>

        <g>
          {sections.map((section, index) => {
            const startDeg = index * sectionAngle;
            const endDeg = startDeg + sectionAngle;
            const isWinner = phase === 'landed' && landedIndex === index;

            return (
              <path
                key={section.type}
                d={annulusWedgePath(RING_INNER_RADIUS, RING_OUTER_RADIUS, startDeg, endDeg)}
                fill={section.color}
                className={isWinner ? 'bingo-spinner-wedge bingo-spinner-wedge--won' : 'bingo-spinner-wedge'}
              />
            );
          })}
        </g>

        <g style={{ transform: `rotate(${angle}deg)`, transformOrigin: `${CENTER}px ${CENTER}px` }}>
          <g className={isMaxCharged ? 'bingo-spinner-charged bingo-spinner-charged--vibrating' : 'bingo-spinner-charged'}>
            <circle
              cx={CENTER}
              cy={CENTER}
              r={BALL_RADIUS}
              fill="url(#bingo-spinner-ball-gradient)"
              style={{
                filter: `drop-shadow(0 0 ${glowRadius}px rgba(255, 255, 255, ${glowOpacity}))`,
              }}
            />
            <polygon
              className="bingo-spinner-needle"
              points={`${needleBaseLeft.x},${needleBaseLeft.y} ${needleBaseRight.x},${needleBaseRight.y} ${needleTip.x},${needleTip.y}`}
            />
          </g>
        </g>
      </svg>

      <p className="bingo-spinner-status">{statusText}</p>
    </div>
  );
}
