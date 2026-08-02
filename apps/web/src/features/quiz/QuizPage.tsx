import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

import { fetchQuestion } from '../../lib/apiClient.js';
import type { Question } from '@spitster/shared';
import { usePlayer } from '../player/PlayerContext.js';
import { QuestionView } from './QuestionView.js';

const DEFAULT_REVEAL_DELAY_MS = 20_000;

// Override the reveal delay for specific question types here; anything not
// listed falls back to DEFAULT_REVEAL_DELAY_MS.
const REVEAL_DELAY_MS_BY_TYPE: Partial<Record<Question['type'], number>> = {
  'whose-top-track': 7_000,
  'guess-the-playlist': 12_000,
  'artist-rank': 10_000,
  'name-the-title': 20_000,
  'name-the-artist': 20_000,
};

function getRevealDelayMs(question: Question | null): number {
  if (!question) return DEFAULT_REVEAL_DELAY_MS;
  return REVEAL_DELAY_MS_BY_TYPE[question.type] ?? DEFAULT_REVEAL_DELAY_MS;
}

export function QuizPage() {
  const [question, setQuestion] = useState<Question | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [timerStarted, setTimerStarted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const { play } = usePlayer();

  const requestIdRef = useRef(0);
  const hasLoadedRef = useRef(false);

  async function loadQuestion() {
    const requestId = ++requestIdRef.current;
    setIsLoading(true);
    setRevealed(false);
    setTimerStarted(false);
    setStatusMessage(null);

    try {
      const nextQuestion = await fetchQuestion();
      if (requestId !== requestIdRef.current) {
        // A newer request has been made, so ignore this one.
        return;
      }
      setQuestion(nextQuestion);
    } catch (error) {
      setQuestion(null);
      setStatusMessage(error instanceof Error ? error.message : 'Unable to load a question.');
    } finally {
      if (requestId === requestIdRef.current) {
        setIsLoading(false);
      }
    }
  }

  useEffect(() => {
    if (hasLoadedRef.current) return;
    hasLoadedRef.current = true;
    loadQuestion();
  }, []);

  // Start playback for whatever track the current question carries.
  useEffect(() => {
    if (!question) return;

    if (question.type === 'whose-top-track') {
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

  // The timer doesn't start automatically — the first player to know the
  // answer presses space, which gives everyone else a fixed window to
  // answer before it's revealed.
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.code !== 'Space') return;
      if (!question || revealed || timerStarted) return;

      event.preventDefault();
      setTimerStarted(true);
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [question, revealed, timerStarted]);

  // Reveal the answer automatically once the timer runs out.
  useEffect(() => {
    if (!question || !timerStarted || revealed) return;

    const timer = setTimeout(() => setRevealed(true), getRevealDelayMs(question));
    return () => clearTimeout(timer);
  }, [question, timerStarted, revealed]);

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <h1>Quiz</h1>
        </div>
        <div className="panel-actions">
          <Link to="/" className="secondary-button">
            Back to lobby
          </Link>
          <button type="button" className="primary-button" onClick={loadQuestion} disabled={isLoading}>
            Next question
          </button>
        </div>
      </div>

      {statusMessage ? <div className="banner">{statusMessage}</div> : null}

      {isLoading ? <p className="muted">Loading question...</p> : null}

      {!isLoading && question ? <QuestionView question={question} revealed={revealed} /> : null}

      {!isLoading && question ? (
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
  );
}