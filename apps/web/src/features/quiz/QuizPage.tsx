import { Link } from 'react-router-dom';

// This page is responsible for rendering a single question, running the
// reveal timer, and showing the answer once time is up. It intentionally
// does not implement answer-selection UI, since players share one screen.
//
// Once the Question type + /quiz/question endpoint exist, this will:
//   1. Fetch a Question on mount (or on "next question")
//   2. Render it via a per-question-type display component
//   3. Start a countdown, then reveal the answer bundled with the question

export function QuizPage() {
  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <h1>Quiz</h1>
          <p>Question display coming soon.</p>
        </div>
      </div>

      <p className="muted">No question loaded yet.</p>

      <Link to="/" className="secondary-button">
        Back to lobby
      </Link>
    </section>
  );
}