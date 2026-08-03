import { useEffect } from 'react';
import type { CrowdFavoriteQuestion } from '@spitster/shared';

const musicPlayingGifUrl = new URL('../../../resources/images/music-playing.gif', import.meta.url).href;

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

// Now owned by QuizPage (which doesn't unmount across "Next question"),
// rather than living as local state in this component (which does).
export interface CrowdFavoriteDot {
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
  dots,
  onDotRevealed,
}: {
  question: CrowdFavoriteQuestion;
  revealed: boolean;
  dots: CrowdFavoriteDot[];
  onDotRevealed: (dot: CrowdFavoriteDot) => void;
}) {
  useEffect(() => {
    if (!revealed) return;
    // Dedup against the dots the parent already has, rather than a local
    // ref — this stays correct even if this component itself remounts.
    if (dots.some((dot) => dot.questionId === question.id)) return;

    onDotRevealed({
      questionId: question.id,
      trackName: question.track.name,
      artistNames: question.track.artists.map((artist) => artist.name).join(', '),
      userNames: getCorrectUserNames(question),
    });
  }, [revealed, question.id, dots, onDotRevealed]);

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