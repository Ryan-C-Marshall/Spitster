import { useEffect } from 'react';
import type { CrowdFavoriteQuestion } from '@spitster/shared';
import { VENN_REGION_CENTROIDS } from './vennRegionCentroids.js';

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
  // Persisted Venn overlay position for this dot (values are relative 0..1).
  vennPosition?: VennPoint;
}

type VennPoint = {
  x: number;
  y: number;
};

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
  random: boolean = false,
): VennPoint {
  const regionKey = getDotRegionKey(question, dot);
  const regionData = VENN_REGION_CENTROIDS[question.options.length]?.[regionKey] as any;

  if (!regionData) {
    // Defensive fallback if options.length is outside expected range.
    return { x: 0.5, y: 0.5 };
  }

  // If the generator emitted a precomputed list of sample points for this
  // region, use it. Sample sequentially from the pre-generated list so
  // dots occupy the true region shape rather than a circular centroid
  // neighborhood. This is deterministic and stable across renders.

  if (random) {
    const pts = regionData.samplePoints as VennPoint[];
    const chosen = pts[Math.floor(Math.random() * pts.length)];
    return { x: chosen.x, y: chosen.y };
  } else {
    if (Array.isArray(regionData.samplePoints) && regionData.samplePoints.length > 0) {
      const pts = regionData.samplePoints as VennPoint[];
      const chosen = pts[indexWithinRegion % pts.length];
      return { x: chosen.x, y: chosen.y };
    }
  }

  // Backwards compatible: if no samplePoints were emitted yet, fall back
  // to the previous centroid + polar jitter approach.
  const centroid = { x: regionData.x as number, y: regionData.y as number };
  const offsetSeed = hashString(`${dot.questionId}:${regionKey}`);
  const angle = (offsetSeed % 360) * (Math.PI / 180);
  const radius = 0.012 + Math.min(indexWithinRegion, 4) * 0.05;

  return {
    x: centroid.x + Math.cos(angle) * radius,
    y: centroid.y + Math.sin(angle) * radius,
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

    // Build the base dot payload.
    const newDotBase: CrowdFavoriteDot = {
      questionId: question.id,
      trackName: question.track.name,
      artistNames: question.track.artists.map((artist) => artist.name).join(', '),
      userNames: getCorrectUserNames(question),
      correctSpotifyUserIds: question.correctSpotifyUserIds,
      isFresh: true,
    };

    // Compute how many existing dots are already in the same Venn region so
    // the fallback deterministic algorithm remains sensible.
    const regionKey = getDotRegionKey(question, newDotBase);
    const indexWithinRegion = dots.filter((existingDot) => getDotRegionKey(question, existingDot) === regionKey).length;

    // Sample a position for this dot now and persist it on the dot object so
    // it doesn't shuffle on every render. Prefer samplePoints when available.
    const chosenPosition = getCrowdFavoriteDotPosition(question, newDotBase, indexWithinRegion, true);

    onDotRevealed({
      ...newDotBase,
      vennPosition: chosenPosition,
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
              // Use a persisted position if the parent stored one when the dot
              // was first revealed; otherwise fall back to sampling (this
              // path should only happen for older dots without stored positions).
              const position = dot.vennPosition ?? getCrowdFavoriteDotPosition(question, dot, indexWithinRegion, true);

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