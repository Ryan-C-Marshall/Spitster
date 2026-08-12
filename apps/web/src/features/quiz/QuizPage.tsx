import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Link, useParams } from 'react-router-dom';

import { fetchQuestion } from '../../lib/apiClient.js';
import type { Question, QuestionType } from '@spitster/shared';
import { usePlayer } from '../player/PlayerContext.js';
import { useSettings } from '../settings/SettingsContext.js';
import { BingoSpinner } from './BingoSpinner.js';
import { getBingoSpinnerSections } from './bingoSpinnerSections.js';
import { QuestionView } from './QuestionView.js';
import type { CrowdFavoriteDot } from './questionTypes/CrowdFavouriteQuestion.js';
import { parseGameMode as parseQuizMode } from './quizMode.js';

const homeIconUrl = new URL('../../resources/images/home-symbol.svg', import.meta.url).href;
const forwardIconUrl = new URL('../../resources/images/forward-arrow-symbol.svg', import.meta.url).href;

const DEFAULT_REVEAL_DELAY_MS = 10_000;
const CROWD_FAVORITE_DOT_ANIMATION_MS = 1_000;

// Override the reveal delay for specific question types here; anything not
// listed falls back to DEFAULT_REVEAL_DELAY_MS.
const REVEAL_DELAY_MS_BY_TYPE: Partial<Record<Question['type'], number>> = {
  'whose-top-track': 7_000,
  'guess-the-playlist': 12_000,
  'artist-rank': 10_000,
  'name-the-title': 10_000,
  'name-the-artist': 10_000,
  'crowd-favorite': 7_000,
  'off-the-chart': 12_000,
  'artist-song-count': 10_000,
};

function getRevealDelayMs(question: Question | null): number {
  if (!question) return DEFAULT_REVEAL_DELAY_MS;
  return REVEAL_DELAY_MS_BY_TYPE[question.type] ?? DEFAULT_REVEAL_DELAY_MS;
}

// Question types that don't play a track. Playback volume drops to
// lobby-level while one of these is showing, so a track left over from the
// previous question doesn't keep blaring under a silent question type.
// 'off-the-chart' joins this list too even though it does have playable
// songs — nothing autoplays for it, so it should start quiet just like a
// fully silent type; OffTheChartQuestion.tsx un-mutes as soon as a card is
// actually clicked. 'artist-song-count' has no playable songs at all — it's
// just a number-line guess.
const SILENT_QUESTION_TYPES: Set<Question['type']> = new Set(['artist-rank', 'off-the-chart', 'artist-song-count']);

export function QuizPage() {
  const { mode: modeParam } = useParams<{ mode?: string }>();
  const gameMode = parseQuizMode(modeParam);
  const { activeBingoTypes, classicInputSource } = useSettings();

  // Recomputed whenever the active-bingo-types setting changes; drives both
  // the spinner's wedges and the color lookup used once it lands (below).
  const bingoSections = useMemo(() => getBingoSpinnerSections(activeBingoTypes), [activeBingoTypes]);
  const bingoColorByType = useMemo<Partial<Record<QuestionType, string>>>(
    () => Object.fromEntries(bingoSections.map((section) => [section.type, section.color])),
    [bingoSections],
  );

  const [question, setQuestion] = useState<Question | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [timerStarted, setTimerStarted] = useState(false);
  // Bingo mode doesn't fetch a question until the spinner has landed on a
  // type, so there's nothing to "load" yet on mount — classic mode fetches
  // immediately as before.
  const [isLoading, setIsLoading] = useState(gameMode !== 'bingo');
  // Bingo mode shows the spinner (instead of fetching immediately) on mount
  // and on every "next question" click; classic mode never shows it, since
  // it only has one question type.
  const [showSpinner, setShowSpinner] = useState(gameMode === 'bingo');
  const [spinnerRound, setSpinnerRound] = useState(0);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  // The landed spinner wedge's color, carried onto the question page as its
  // border/title color. Cleared whenever a fresh spinner is shown so the
  // glow doesn't linger from the previous question while the next one spins.
  const [bingoQuestionColor, setBingoQuestionColor] = useState<string | null>(null);
  // Lives here instead of inside CrowdFavoriteQuestionView because this
  // component doesn't unmount between questions in a classic session, even
  // though the loading-gated question view below does.
  const [crowdFavoriteDots, setCrowdFavoriteDots] = useState<CrowdFavoriteDot[]>([]);
  const { play, setQuietMode } = usePlayer();

  const requestIdRef = useRef(0);
  const hasLoadedRef = useRef(false);
  const settledDotTimersRef = useRef<number[]>([]);

  useEffect(() => {
    return () => {
      for (const timerId of settledDotTimersRef.current) {
        window.clearTimeout(timerId);
      }
      settledDotTimersRef.current = [];
    };
  }, []);

  const addCrowdFavoriteDot = useCallback((dot: CrowdFavoriteDot) => {
    setCrowdFavoriteDots((prev) => {
      if (prev.some((existing) => existing.questionId === dot.questionId)) {
        return prev;
      }

      const nextDot = { ...dot, isFresh: true };
      const timerId = window.setTimeout(() => {
        setCrowdFavoriteDots((current) =>
          current.map((existing) =>
            existing.questionId === nextDot.questionId ? { ...existing, isFresh: false } : existing,
          ),
        );
      }, CROWD_FAVORITE_DOT_ANIMATION_MS);

      settledDotTimersRef.current.push(timerId);
      return [...prev, nextDot];
    });
  }, []);

  // Fetches a question and, on success, reveals it; on failure, hides the
  // spinner (if it was showing) and surfaces the error banner so "next
  // question" is available to try again — see fetchQuestion for how `type`
  // is forwarded to the API.
  const fetchAndShowQuestion = useCallback(
    async (type?: QuestionType) => {
      const requestId = ++requestIdRef.current;
      setIsLoading(true);
      setRevealed(false);
      setTimerStarted(false);
      setStatusMessage(null);

      try {
        const nextQuestion = await fetchQuestion(
          gameMode,
          type,
          gameMode === 'classic' ? classicInputSource : undefined,
        );
        if (requestId !== requestIdRef.current) {
          // A newer request has been made, so ignore this one.
          return;
        }
        setQuestion(nextQuestion);
        setShowSpinner(false);
      } catch (error) {
        setQuestion(null);
        setShowSpinner(false);
        setStatusMessage(error instanceof Error ? error.message : 'Unable to load a question.');
      } finally {
        if (requestId === requestIdRef.current) {
          setIsLoading(false);
        }
      }
    },
    [gameMode, classicInputSource],
  );

  // Called by the button/nav action to move on to the next question. In
  // bingo mode this just shows a fresh spinner — the actual fetch happens
  // once the spinner lands (see handleSpinnerLanded). Classic mode has no
  // spinner, since it only has one question type, so it fetches directly.
  const startNextQuestion = useCallback(() => {
    if (gameMode === 'bingo') {
      setQuestion(null);
      setStatusMessage(null);
      setSpinnerRound((round) => round + 1);
      setShowSpinner(true);
      setBingoQuestionColor(null);
    } else {
      fetchAndShowQuestion();
    }
  }, [gameMode, fetchAndShowQuestion]);

  const handleSpinnerLanded = useCallback(
    (type: QuestionType) => {
      setBingoQuestionColor(bingoColorByType[type] ?? null);
      fetchAndShowQuestion(type);
    },
    [fetchAndShowQuestion, bingoColorByType],
  );

  useEffect(() => {
    if (hasLoadedRef.current) return;
    hasLoadedRef.current = true;
    if (gameMode !== 'bingo') {
      fetchAndShowQuestion();
    }
  }, [gameMode, fetchAndShowQuestion]);

  // Start playback for whatever track the current question carries.
  useEffect(() => {
    if (!question) return;

    if (question.type === 'whose-top-track' || question.type === 'crowd-favorite') {
      play(question.track.uri).catch((error) => {
        setStatusMessage(error instanceof Error ? error.message : 'Unable to play track.');
      });
    }

    if (question.type === 'guess-the-playlist') {
      play(question.tracks[0].uri).catch((error) => {
        setStatusMessage(error instanceof Error ? error.message : 'Unable to play track.');
      });
    }

    if (question.type === 'name-the-title' || question.type === 'name-the-artist') {
      play(question.track.uri).catch((error) => {
        setStatusMessage(error instanceof Error ? error.message : 'Unable to play track.');
      });
    }
  }, [question]);

  // Drop to lobby volume for question types that don't play a track (and
  // while there's no question on screen yet, e.g. during the bingo spinner)
  // so nothing from a prior question keeps playing loudly underneath.
  useEffect(() => {
    if (!question) {
      setQuietMode(true);
      return;
    }
    setQuietMode(SILENT_QUESTION_TYPES.has(question.type));
  }, [question, setQuietMode]);

  // Space bar drives most of the question flow: the first player to know
  // the answer presses it to start the timer (giving everyone else a fixed
  // window to answer before it's revealed); once the answer is already
  // revealed — whether the timer ran out or someone hit "Reveal answer" —
  // space instead acts as the "next question" button. While the bingo
  // spinner is showing it handles space bar input itself, so this handler
  // steps aside.
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.code !== 'Space' || event.repeat) return;
      if (showSpinner || !question) return;

      if (revealed) {
        if (isLoading) return;
        event.preventDefault();
        startNextQuestion();
        return;
      }

      if (timerStarted) return;

      event.preventDefault();
      setTimerStarted(true);
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [question, revealed, timerStarted, showSpinner, isLoading, startNextQuestion]);

  // Reveal the answer automatically once the timer runs out.
  useEffect(() => {
    if (!question || !timerStarted || revealed) return;

    const timer = setTimeout(() => setRevealed(true), getRevealDelayMs(question));
    return () => clearTimeout(timer);
  }, [question, timerStarted, revealed]);

  // Only glow once the spinner has landed and its question is actually on
  // screen — not while the spinner itself is spinning/charging.
  const showBingoGlow = Boolean(bingoQuestionColor) && !showSpinner && !isLoading && Boolean(question);

  return (
    <div className="quiz-stage">
      <section
        className={`panel quiz-panel${showBingoGlow ? ' bingo-question-glow' : ''}`}
        style={showBingoGlow ? ({ '--bingo-question-color': bingoQuestionColor } as CSSProperties) : undefined}
      >
        {statusMessage ? <div className="banner">{statusMessage}</div> : null}

        {showSpinner ? (
          <BingoSpinner
            key={spinnerRound}
            onLanded={handleSpinnerLanded}
            isFetching={isLoading}
            sections={bingoSections}
          />
        ) : null}

        {!showSpinner && isLoading ? <p className="muted">Loading question...</p> : null}

        {!showSpinner && !isLoading && question ? (
          <QuestionView
            question={question}
            revealed={revealed}
            crowdFavoriteDots={crowdFavoriteDots}
            onCrowdFavoriteDotRevealed={addCrowdFavoriteDot}
          />
        ) : null}

        {!showSpinner && !isLoading && question ? (
          <div className="timer-row">
            <div className="timer-track">
              {timerStarted && !revealed ? (
                <div
                  key={question.id}
                  className="timer-fill"
                  style={{ animationDuration: `${getRevealDelayMs(question)}ms` }}
                />
              ) : null}
            </div>
            <button
              type="button"
              className="primary-button"
              onClick={() => setRevealed(true)}
              disabled={revealed}
            >
              Reveal answer
            </button>
          </div>
        ) : null}
      </section>

      <div className="quiz-actions" aria-label="Question controls">
        <button
          type="button"
          className="icon-button icon-button--stacked icon-button--primary"
          aria-label="Next question"
          title="Next question"
          onClick={startNextQuestion}
          disabled={isLoading || showSpinner}
        >
          <img className="icon-button-image" src={forwardIconUrl} alt="" aria-hidden="true" />
        </button>
                <Link to="/" className="icon-button icon-button--stacked" aria-label="Back to lobby" title="Back to lobby">
          <img className="icon-button-image" src={homeIconUrl} alt="" aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}