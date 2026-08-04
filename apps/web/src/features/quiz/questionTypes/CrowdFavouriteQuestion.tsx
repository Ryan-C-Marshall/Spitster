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
  correctSpotifyUserIds: string[];
  isFresh: boolean;
}

type VennPoint = {
  x: number;
  y: number;
};

const VENN_LAYOUT_BY_PLAYER_COUNT: Record<number, VennPoint[]> = {
  2: [
    { x: 0.34, y: 0.52 },
    { x: 0.66, y: 0.52 },
  ],
  3: [
    { x: 0.34, y: 0.62 },
    { x: 0.66, y: 0.62 },
    { x: 0.5, y: 0.33 },
  ],
  4: [
    { x: 0.33, y: 0.34 },
    { x: 0.67, y: 0.34 },
    { x: 0.33, y: 0.67 },
    { x: 0.67, y: 0.67 },
  ],
  5: [
    { x: 0.28, y: 0.42 },
    { x: 0.63, y: 0.32 },
    { x: 0.74, y: 0.57 },
    { x: 0.43, y: 0.77 },
    { x: 0.18, y: 0.58 },
  ],
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function hashString(value: string): number {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) | 0;
  }

  return hash;
}

function getDotRegionKey(question: CrowdFavoriteQuestion, dot: CrowdFavoriteDot): string {
  const playerIndexById = new Map(question.options.map((option, index) => [option.spotifyUserId, index]));

  return dot.correctSpotifyUserIds
    .slice()
    .sort((left, right) => {
      const leftIndex = playerIndexById.get(left) ?? Number.MAX_SAFE_INTEGER;
      const rightIndex = playerIndexById.get(right) ?? Number.MAX_SAFE_INTEGER;
      return leftIndex - rightIndex;
    })
    .map((spotifyUserId) => playerIndexById.get(spotifyUserId) ?? -1)
    .join('-');
}

function getCrowdFavoriteDotPosition(
  question: CrowdFavoriteQuestion,
  dot: CrowdFavoriteDot,
  indexWithinRegion: number,
): VennPoint {
  const playerCount = Math.min(Math.max(question.options.length, 2), 5);
  const anchors = VENN_LAYOUT_BY_PLAYER_COUNT[playerCount] ?? VENN_LAYOUT_BY_PLAYER_COUNT[5];
  const playerIndexById = new Map(question.options.map((option, index) => [option.spotifyUserId, index]));
  const selectedIndices = dot.correctSpotifyUserIds
    .map((spotifyUserId) => playerIndexById.get(spotifyUserId))
    .filter((index): index is number => typeof index === 'number' && index >= 0);

  if (selectedIndices.length === 0) {
    return { x: 0.5, y: 0.5 };
  }

  let xTotal = 0;
  let yTotal = 0;

  for (const index of selectedIndices) {
    xTotal += anchors[index % anchors.length].x;
    yTotal += anchors[index % anchors.length].y;
  }

  const averageX = xTotal / selectedIndices.length;
  const averageY = yTotal / selectedIndices.length;
  const centerPull = selectedIndices.length === 1 ? 0.12 : clamp(0.18 + selectedIndices.length * 0.04, 0.18, 0.36);
  const pulledX = averageX + (0.5 - averageX) * centerPull;
  const pulledY = averageY + (0.48 - averageY) * centerPull;

  const offsetSeed = hashString(`${dot.questionId}:${getDotRegionKey(question, dot)}`);
  const angle = (offsetSeed % 360) * (Math.PI / 180);
  const radius = 0.012 + Math.min(indexWithinRegion, 4) * 0.01;

  return {
    x: clamp(pulledX + Math.cos(angle) * radius, 0.1, 0.9),
    y: clamp(pulledY + Math.sin(angle) * radius, 0.1, 0.9),
  };
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
      correctSpotifyUserIds: question.correctSpotifyUserIds,
      isFresh: true,
    });
  }, [revealed, question.id, dots, onDotRevealed]);

  const revealedUserNames = revealed ? getCorrectUserNames(question) : [];

  return (
    <div className="question-card">
      <div className="question-header">
        <div style={{ flex: 1, minWidth: 200 }}>
          <h2>Whose song is this?</h2>
        </div>

        <div className={`lobby-card playing track-reveal-card crowd-favorite-track-reveal-card${revealed ? ' revealed' : ''}`}>
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
        <div className="venn-stage">
          <img
            className="venn-image"
            src={getVennDiagramUrl(question.options.length)}
            alt={`Venn diagram for ${question.options.length} players`}
          />

          <div className="venn-dots-overlay">
            {dots.map((dot, index) => {
              const regionKey = getDotRegionKey(question, dot);
              const indexWithinRegion = dots
                .slice(0, index)
                .filter((existingDot) => getDotRegionKey(question, existingDot) === regionKey).length;
              const position = getCrowdFavoriteDotPosition(question, dot, indexWithinRegion);

              return (
                <div
                  key={dot.questionId}
                  className={`venn-dot${dot.isFresh ? ' venn-dot--new' : ''}`}
                  tabIndex={0}
                  style={{ left: `${position.x * 100}%`, top: `${position.y * 100}%` }}
                >
                  <div className="venn-dot-card">
                    <p className="venn-dot-card-title">{dot.trackName}</p>
                    <p className="venn-dot-card-artist">{dot.artistNames}</p>
                    <p className="venn-dot-card-users">{dot.userNames.join(', ')}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}