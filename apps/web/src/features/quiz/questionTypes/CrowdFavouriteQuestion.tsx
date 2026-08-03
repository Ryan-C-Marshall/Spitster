import { useEffect, useRef, useState } from 'react';
import type { CrowdFavoriteQuestion } from '@spitster/shared';

const musicPlayingGifUrl = new URL('../../../resources/images/music-playing.gif', import.meta.url).href;

// One diagram per supported player count. If a classic-mode game ever has
// more eligible players than we have diagrams for, clamp to the biggest we
// have — revisit if games regularly run bigger than 5.
const VENN_DIAGRAM_URLS: Record<number, string> = {
  2: new URL('../../../resources/images/venn-diagram-2.svg', import.meta.url).href,
  3: new URL('../../../resources/images/venn-diagram-3.svg', import.meta.url).href,
  4: new URL('../../../resources/images/venn-diagram-4.svg', import.meta.url).href,
  5: new URL('../../../resources/images/venn-diagram-5.svg', import.meta.url).href,
};
const MIN_VENN_PLAYERS = 2;
const MAX_VENN_PLAYERS = 5;

function getVennDiagramUrl(playerCount: number): string {
  const clamped = Math.min(Math.max(playerCount, MIN_VENN_PLAYERS), MAX_VENN_PLAYERS);
  return VENN_DIAGRAM_URLS[clamped];
}

interface RevealedDot {
  questionId: string;
  trackName: string;
  artistNames: string;
  userNames: string[];
}

function getCorrectUserNames(question: CrowdFavoriteQuestion): string[] {
  const correctIds = new Set(question.correctSpotifyUserIds);
  return question.options
    .filter((option) => correctIds.has(option.spotifyUserId))
    .map((option) => option.displayName ?? option.spotifyUserId);
}

export function CrowdFavoriteQuestionView({
  question,
  revealed,
}: {
  question: CrowdFavoriteQuestion;
  revealed: boolean;
}) {
  // Dots accumulate for as long as this component stays mounted — i.e. for
  // the whole classic-mode session, since QuizPage keeps the same
  // CrowdFavoriteQuestionView instance across "Next question".
  const [dots, setDots] = useState<RevealedDot[]>([]);
  const lastDottedQuestionId = useRef<string | null>(null);

  useEffect(() => {
    if (!revealed) return;
    if (lastDottedQuestionId.current === question.id) return; // already added for this question
    lastDottedQuestionId.current = question.id;

    setDots((prev) => [
      ...prev,
      {
        questionId: question.id,
        trackName: question.track.name,
        artistNames: question.track.artists.map((artist) => artist.name).join(', '),
        userNames: getCorrectUserNames(question),
      },
    ]);
  }, [revealed, question.id]);

  const revealedUserNames = revealed ? getCorrectUserNames(question) : [];

  return (
    <div className="question-card">
      <div className="question-header">
        <div style={{ flex: 1, minWidth: 200 }}>
          <h2>Whose song is this?</h2>
        </div>

        <div className={`lobby-card playing track-reveal-card${revealed ? ' revealed' : ''}`}>
          {revealed ? (
            <div className="track-reveal-content">
              <h3 className="track-reveal-title">{question.track.name}</h3>
              <p className="track-reveal-artist">
                {question.track.artists.map((artist) => artist.name).join(', ')}
              </p>
              <p className="track-reveal-users">{revealedUserNames.join(', ')}</p>
            </div>
          ) : (
            <img className="track-reveal-gif" src={musicPlayingGifUrl} alt="" aria-hidden="true" />
          )}
        </div>
      </div>

      <div className="venn-container">
        <img
          className="venn-image"
          src={getVennDiagramUrl(question.options.length)}
          alt={`Venn diagram for ${question.options.length} players`}
        />

        <div className="venn-dots-overlay">
          {dots.map((dot) => (
            <div key={dot.questionId} className="venn-dot" tabIndex={0}>
              <div className="venn-dot-card">
                <p className="venn-dot-card-title">{dot.trackName}</p>
                <p className="venn-dot-card-artist">{dot.artistNames}</p>
                <p className="venn-dot-card-users">{dot.userNames.join(', ')}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}