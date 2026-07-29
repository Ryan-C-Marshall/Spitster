import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { fetchQuestion } from '../../lib/apiClient.js';
import type { Question } from '@spitster/shared';
import { usePlayer } from '../player/PlayerContext.js';
import { QuestionView } from './QuestionView.js';

const REVEAL_DELAY_MS = 10_000;

export function QuizPage() {
  const [question, setQuestion] = useState<Question | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const { play } = usePlayer();

  async function loadQuestion() {
    setIsLoading(true);
    setRevealed(false);
    setStatusMessage(null);

    try {
      const nextQuestion = await fetchQuestion();
      setQuestion(nextQuestion);
    } catch (error) {
      setQuestion(null);
      setStatusMessage(error instanceof Error ? error.message : 'Unable to load a question.');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
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
  }, [question]);

  // Reveal the answer automatically after a fixed delay.
  useEffect(() => {
    if (!question) return;

    const timer = setTimeout(() => setRevealed(true), REVEAL_DELAY_MS);
    return () => clearTimeout(timer);
  }, [question]);

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <h1>Quiz</h1>
        </div>
        <div className="panel-actions">
          <button type="button" className="primary-button" onClick={loadQuestion} disabled={isLoading}>
            Next question
          </button>
        </div>
      </div>

      {statusMessage ? <div className="banner">{statusMessage}</div> : null}

      {isLoading ? <p className="muted">Loading question...</p> : null}

      {!isLoading && question ? <QuestionView question={question} revealed={revealed} /> : null}

      <Link to="/" className="secondary-button">
        Back to lobby
      </Link>
    </section>
  );
}