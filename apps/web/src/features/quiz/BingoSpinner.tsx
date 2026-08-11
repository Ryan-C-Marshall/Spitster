import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import type { QuestionType } from '@spitster/shared';

import type { BingoSpinnerSection } from './bingoSpinnerSections.js';

const discoBallUrl = new URL('../../resources/images/disco-ball.svg', import.meta.url).href;

type SpinnerPhase = 'idle' | 'charging' | 'spinning' | 'landed';

// Tuning knobs — all in one place so the feel is easy to adjust.
const CHARGE_MAX_MS = 2_500; // time holding space to reach visual full charge
const MIN_RELEASE_VELOCITY_DEG_S = 500; // spin speed from a bare tap
const MAX_RELEASE_VELOCITY_DEG_S = 1500; // spin speed from a full (uncharged-past-max) charge
const SPIN_DECELERATION_DEG_S2 = 300; // friction; higher = stops sooner
const STOP_VELOCITY_THRESHOLD_DEG_S = 4;

// Holding past the visual max keeps nudging the eventual spin speed up, just
// slowly and invisibly, so nobody can reliably memorize "let go right when
// it starts shaking = this many degrees". Expressed as extra charge
// fractions on top of the normal 0–1 range, accrued per CHARGE_MAX_MS held
// beyond the max.
const OVERCHARGE_RATE = 0.12;
const OVERCHARGE_CAP = 0.3;

// How long the spinner sits on its landed result (showing the winning
// wedge/label) before handing off to the question fetch. Gives players a
// beat to actually see what it landed on before the view changes.
const LANDED_PAUSE_MS = 1_000;

// The disco ball fades through the wedge colors in sequence; the rate (in
// color-slots per second) ramps from a lazy pulse up to a near-flicker as
// charge/spin-speed approaches its max.
const FLASH_MIN_HZ = 0.5;
const FLASH_MAX_HZ = 5;

const SIZE = 340;
const CENTER = SIZE / 2;
const RING_OUTER_RADIUS = 162;
const RING_INNER_RADIUS = 70;
const WEDGE_ICON_RADIUS = (RING_INNER_RADIUS + RING_OUTER_RADIUS) / 2;
const WEDGE_ICON_SIZE = 46;
const BALL_RADIUS = 60;
const NEEDLE_TIP_RADIUS = RING_INNER_RADIUS - 2;
const NEEDLE_BASE_RADIUS = BALL_RADIUS - 15; // tucks under the ball's edge so the needle reads as attached to it
const NEEDLE_BASE_HALF_WIDTH = 10;

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

// Where in its fade-in/fade-out slot the ball currently sits, given a
// continuously-accumulated "phase" (in color-slots elapsed). Each color gets
// one slot; opacity ramps up then back down within that slot via a sine
// envelope, so colors read as pulsing in and out rather than hard-cutting.
function getHighlightVisual(phase: number, colors: string[], intensity: number) {
  const count = colors.length;
  const wrapped = ((phase % count) + count) % count;
  const colorIndex = Math.floor(wrapped);
  const localT = wrapped - colorIndex;
  const envelope = Math.sin(localT * Math.PI);
  const clampedIntensity = Math.max(0, Math.min(1, intensity));
  const maxOpacity = 0.2 + clampedIntensity * 0.6;
  return { color: colors[colorIndex], opacity: envelope * maxOpacity };
}

interface BingoSpinnerProps {
  onLanded: (type: QuestionType) => void;
  isFetching: boolean;
  // Which question types appear on the ring and in what order/colors —
  // computed from the active-bingo-types setting by the caller (see
  // getBingoSpinnerSections), so this component doesn't need to know
  // anything about settings itself.
  sections: BingoSpinnerSection[];
}

export function BingoSpinner({ onLanded, isFetching, sections }: BingoSpinnerProps) {
  const sectionAngle = 360 / sections.length;
  const sectionColors = useMemo(() => sections.map((section) => section.color), [sections]);

  // Randomize where the needle rests before the very first charge of this
  // spin — computed once per mount (each round remounts BingoSpinner with a
  // fresh `key`, so this re-rolls every spin).
  const initialAngleRef = useRef<number>(0);
  if (initialAngleRef.current === undefined || initialAngleRef.current === 0) {
    initialAngleRef.current = Math.random() * 360;
  }
  const initialAngle = initialAngleRef.current;

  const [phase, setPhase] = useState<SpinnerPhase>('idle');
  const [angle, setAngle] = useState(initialAngle);
  const [charge, setCharge] = useState(0);
  const [landedIndex, setLandedIndex] = useState<number | null>(null);
  const [highlightColor, setHighlightColor] = useState(sectionColors[0]);
  const [highlightOpacity, setHighlightOpacity] = useState(0);

  const phaseRef = useRef<SpinnerPhase>('idle');
  const angleRef = useRef(initialAngle);
  const velocityRef = useRef(0);
  const chargeStartRef = useRef<number | null>(null);
  const lastFrameRef = useRef<number | null>(null);
  const highlightPhaseRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const hasLandedRef = useRef(false);
  const onLandedRef = useRef(onLanded);
  const landedTimeoutRef = useRef<number | null>(null);

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
    const lastFrame = lastFrameRef.current;
    lastFrameRef.current = timestamp;
    const dt = lastFrame === null ? 0 : (timestamp - lastFrame) / 1000;

    if (phaseRef.current === 'charging') {
      const startedAt = chargeStartRef.current ?? timestamp;
      const normalizedCharge = Math.min(1, (timestamp - startedAt) / CHARGE_MAX_MS);
      setCharge(normalizedCharge);

      const hz = FLASH_MIN_HZ + normalizedCharge * (FLASH_MAX_HZ - FLASH_MIN_HZ);
      highlightPhaseRef.current += hz * dt;
      const highlight = getHighlightVisual(highlightPhaseRef.current, sectionColors, normalizedCharge);
      setHighlightColor(highlight.color);
      setHighlightOpacity(highlight.opacity);

      rafRef.current = requestAnimationFrame(tick);
      return;
    }

    if (phaseRef.current === 'spinning') {
      const nextVelocity = Math.max(0, velocityRef.current - SPIN_DECELERATION_DEG_S2 * dt);
      angleRef.current += velocityRef.current * dt;
      velocityRef.current = nextVelocity;
      setAngle(angleRef.current);

      // Flash speed stays proportional to how fast the spinner is currently
      // moving, so it naturally winds down alongside the spin and stops the
      // instant the spin does.
      const velocityFraction = Math.min(1, nextVelocity / MAX_RELEASE_VELOCITY_DEG_S);
      const hz = FLASH_MIN_HZ + velocityFraction * (FLASH_MAX_HZ - FLASH_MIN_HZ);
      highlightPhaseRef.current += hz * dt;
      const highlight = getHighlightVisual(highlightPhaseRef.current, sectionColors, velocityFraction);
      setHighlightColor(highlight.color);
      setHighlightOpacity(highlight.opacity);

      if (nextVelocity <= STOP_VELOCITY_THRESHOLD_DEG_S) {
        phaseRef.current = 'landed';
        setPhase('landed');
        setHighlightOpacity(0);

        const normalized = ((angleRef.current % 360) + 360) % 360;
        const index = Math.floor(normalized / sectionAngle) % sections.length;
        setLandedIndex(index);

        if (!hasLandedRef.current) {
          hasLandedRef.current = true;
          const landedType = sections[index].type;
          landedTimeoutRef.current = window.setTimeout(() => {
            landedTimeoutRef.current = null;
            onLandedRef.current(landedType);
          }, LANDED_PAUSE_MS);
        }
        return;
      }

      rafRef.current = requestAnimationFrame(tick);
    }
  }, [sectionAngle, sectionColors, sections]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.code !== 'Space' || event.repeat) return;
      if (phaseRef.current !== 'idle') return;

      event.preventDefault();
      chargeStartRef.current = performance.now();
      phaseRef.current = 'charging';
      setPhase('charging');
      setCharge(0);
      lastFrameRef.current = null;
      highlightPhaseRef.current = 0;
      rafRef.current = requestAnimationFrame(tick);
    }

    function handleKeyUp(event: KeyboardEvent) {
      if (event.code !== 'Space') return;
      if (phaseRef.current !== 'charging') return;

      event.preventDefault();
      const startedAt = chargeStartRef.current ?? performance.now();
      const rawCharge = (performance.now() - startedAt) / CHARGE_MAX_MS;
      const normalizedCharge = Math.min(1, rawCharge);
      // Extra, slow-growing charge for however long they held past the
      // visual max — invisible on the dial, but it does keep nudging the
      // release speed up the longer they wait.
      const overcharge = Math.min(OVERCHARGE_CAP, Math.max(0, rawCharge - 1) * OVERCHARGE_RATE);
      const effectiveCharge = normalizedCharge + overcharge;

      velocityRef.current =
        MIN_RELEASE_VELOCITY_DEG_S + effectiveCharge * (MAX_RELEASE_VELOCITY_DEG_S - MIN_RELEASE_VELOCITY_DEG_S);
      setCharge(normalizedCharge);
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
      if (landedTimeoutRef.current !== null) {
        window.clearTimeout(landedTimeoutRef.current);
        landedTimeoutRef.current = null;
      }
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
  // if (phase === 'charging') statusText = '';
  // if (phase === 'spinning') statusText = '';
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
          <clipPath id="bingo-spinner-ball-clip">
            <circle cx={CENTER} cy={CENTER} r={BALL_RADIUS} />
          </clipPath>
        </defs>

        <g className="bingo-spinner-wedge-glow-layer" aria-hidden="true">
          {sections.map((section, index) => {
            const startDeg = index * sectionAngle;
            const endDeg = startDeg + sectionAngle;
            return (
              <path
                key={section.type}
                d={annulusWedgePath(RING_INNER_RADIUS, RING_OUTER_RADIUS, startDeg, endDeg)}
                fill={section.color}
                className="bingo-spinner-wedge-glow"
              />
            );
          })}
        </g>

        <g>
          {sections.map((section, index) => {
            const startDeg = index * sectionAngle;
            const endDeg = startDeg + sectionAngle;
            const isWinner = phase === 'landed' && landedIndex === index;
            const midDeg = (startDeg + endDeg) / 2;
            const iconCenter = polarToCartesian(WEDGE_ICON_RADIUS, midDeg);

            return (
              <g key={section.type} className={isWinner ? 'bingo-spinner-wedge-group bingo-spinner-wedge-group--won' : 'bingo-spinner-wedge-group'}>
                <path
                  d={annulusWedgePath(RING_INNER_RADIUS, RING_OUTER_RADIUS, startDeg, endDeg)}
                  fill={section.color}
                  className="bingo-spinner-wedge"
                />
                {section.iconUrl ? (
                  <image
                    href={section.iconUrl}
                    x={iconCenter.x - WEDGE_ICON_SIZE / 2}
                    y={iconCenter.y - WEDGE_ICON_SIZE / 2}
                    width={WEDGE_ICON_SIZE}
                    height={WEDGE_ICON_SIZE}
                    className="bingo-spinner-wedge-icon"
                    preserveAspectRatio="xMidYMid meet"
                    pointerEvents="none"
                  />
                ) : null}
              </g>
            );
          })}
        </g>

        <g style={{ transform: `rotate(${angle}deg)`, transformOrigin: `${CENTER}px ${CENTER}px` }}>
          <g className={isMaxCharged ? 'bingo-spinner-charged bingo-spinner-charged--vibrating' : 'bingo-spinner-charged'}>
            <g
              className="bingo-spinner-ball"
              style={{
                filter: `drop-shadow(0 0 ${glowRadius}px rgba(255, 255, 255, ${glowOpacity}))`,
              }}
            >
              <g clipPath="url(#bingo-spinner-ball-clip)">
                <image
                  href={discoBallUrl}
                  x={CENTER - BALL_RADIUS}
                  y={CENTER - BALL_RADIUS}
                  width={BALL_RADIUS * 2}
                  height={BALL_RADIUS * 2}
                  preserveAspectRatio="xMidYMid slice"
                />
                <circle
                  className="bingo-spinner-ball-highlight"
                  cx={CENTER}
                  cy={CENTER}
                  r={BALL_RADIUS}
                  fill={highlightColor}
                  opacity={highlightOpacity}
                />
              </g>
            </g>
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