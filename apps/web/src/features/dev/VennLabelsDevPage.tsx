// features/dev/VennLabelsDevPage.tsx
//
// Dev-only harness for testing the Crowd Favourite venn diagram's player
// name labels (and dot placement) with 2-5 simulated players, without
// having to actually authenticate that many Spotify accounts.
//
// Only reachable at all when import.meta.env.DEV is true — see the guard
// in App.tsx, which keeps this (and its route) out of production builds.
import { useCallback, useMemo, useState } from 'react';
import type { CrowdFavoriteQuestion, QuestionPlayerOption } from '@spitster/shared';

import {
  CrowdFavoriteQuestionView,
  type CrowdFavoriteDot,
} from '../quiz/questionTypes/CrowdFavouriteQuestion.js';

const PLAYER_COUNT_OPTIONS = [2, 3, 4, 5];

const SAMPLE_TRACK_NAMES = [
  'Midnight Static',
  'Paper Constellations',
  'Low Tide Radio',
  'Neon Weather',
  'Second-Hand Sunlight',
  'Slow Bloom',
  'Analog Ghosts',
  'Borrowed Gravity',
];

const SAMPLE_ARTISTS = ['The Understudies', 'Faint Signal', 'Marigold Static', 'Cassette Weather'];

function pickRandom<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function makeSimulatedPlayers(count: number): QuestionPlayerOption[] {
  return Array.from({ length: count }, (_, index) => ({
    spotifyUserId: `sim-user-${index}`,
    displayName: `Player ${index + 1}`,
  }));
}

// Picks a random non-empty subset of players to be "correct" for a round —
// mirrors how a real crowd-favorite track is shared by a subset of the
// connected accounts.
function pickRandomCorrectSubset(players: QuestionPlayerOption[]): QuestionPlayerOption[] {
  let subset: QuestionPlayerOption[] = [];
  while (subset.length === 0) {
    subset = players.filter(() => Math.random() < 0.5);
  }
  return subset;
}

function makeQuestion(
  id: string,
  players: QuestionPlayerOption[],
  correct: QuestionPlayerOption[],
): CrowdFavoriteQuestion {
  return {
    id,
    type: 'crowd-favorite',
    track: {
      id,
      name: pickRandom(SAMPLE_TRACK_NAMES),
      uri: `spotify:track:sim-${id}`,
      artists: [{ id: `artist-${id}`, name: pickRandom(SAMPLE_ARTISTS), uri: `spotify:artist:sim-${id}` }],
    },
    options: players,
    correctSpotifyUserIds: correct.map((player) => player.spotifyUserId),
  };
}

// Every non-empty subset of player indices, e.g. for 3 players:
// [0], [1], [2], [0,1], [0,2], [1,2], [0,1,2]
function everyNonEmptySubset(count: number): number[][] {
  const subsets: number[][] = [];
  for (let mask = 1; mask < 2 ** count; mask += 1) {
    const subset: number[] = [];
    for (let bit = 0; bit < count; bit += 1) {
      if (mask & (1 << bit)) subset.push(bit);
    }
    subsets.push(subset);
  }
  return subsets;
}

export function VennLabelsDevPage() {
  const [playerCount, setPlayerCount] = useState(3);
  const [roundSeq, setRoundSeq] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [dots, setDots] = useState<CrowdFavoriteDot[]>([]);

  const players = useMemo(() => makeSimulatedPlayers(playerCount), [playerCount]);

  const [question, setQuestion] = useState<CrowdFavoriteQuestion>(() =>
    makeQuestion('round-0', players, pickRandomCorrectSubset(players)),
  );

  const changePlayerCount = useCallback((count: number) => {
    setPlayerCount(count);
    const nextPlayers = makeSimulatedPlayers(count);
    setDots([]);
    setRevealed(false);
    setRoundSeq(0);
    setQuestion(makeQuestion('round-0', nextPlayers, pickRandomCorrectSubset(nextPlayers)));
  }, []);

  const startNextRound = useCallback(() => {
    const nextSeq = roundSeq + 1;
    setRoundSeq(nextSeq);
    setRevealed(false);
    setQuestion(makeQuestion(`round-${nextSeq}`, players, pickRandomCorrectSubset(players)));
  }, [players, roundSeq]);

  const handleReveal = useCallback(() => setRevealed(true), []);

  const handleDotRevealed = useCallback((dot: CrowdFavoriteDot) => {
    setDots((prev) => (prev.some((existing) => existing.questionId === dot.questionId) ? prev : [...prev, dot]));
  }, []);

  const clearDots = useCallback(() => {
    setDots([]);
    setRevealed(false);
  }, []);

  // Drops one dot into every possible player-subset region at once, so you
  // can eyeball every region + label placement for the current player
  // count in a single screen instead of stepping through rounds one at a
  // time. Reuses the fallback (undefined vennPosition) placement logic
  // already in CrowdFavoriteQuestionView, rather than duplicating it here.
  const fillAllRegions = useCallback(() => {
    const subsets = everyNonEmptySubset(playerCount);
    const filledDots: CrowdFavoriteDot[] = subsets.map((subset, index) => {
      const correctPlayers = subset.map((playerIndex) => players[playerIndex]);
      return {
        questionId: `fill-${index}`,
        trackName: `Region ${subset.map((i) => i + 1).join('+')}`,
        artistNames: 'Sample data',
        userNames: correctPlayers.map((player) => player.displayName ?? player.spotifyUserId),
        correctSpotifyUserIds: correctPlayers.map((player) => player.spotifyUserId),
        isFresh: false,
      };
    });

    setDots(filledDots);
    setRevealed(true);
    // Point the displayed question at the "everyone" region so
    // CrowdFavoriteQuestionView's own reveal effect sees it's already
    // covered by the fill above and doesn't add a duplicate dot.
    setQuestion(makeQuestion(`fill-${filledDots.length - 1}`, players, players));
  }, [playerCount, players]);

  return (
    <div className="quiz-stage">
      <section className="panel quiz-panel">
        <div className="question-header">
          <div style={{ flex: 1, minWidth: 200 }}>
            <h2>Venn labels dev harness</h2>
            <p className="muted">
              Simulates 2-5 players against the Crowd Favourite venn diagram, no Spotify auth required.
              Dev-only — not included in production builds.
            </p>
          </div>
        </div>

        <div className="quiz-actions" aria-label="Simulated player controls" style={{ marginBottom: '1rem' }}>
          {PLAYER_COUNT_OPTIONS.map((count) => (
            <button
              key={count}
              type="button"
              className="primary-button"
              disabled={count === playerCount}
              onClick={() => changePlayerCount(count)}
            >
              {count} players
            </button>
          ))}
        </div>

        <div className="quiz-actions" aria-label="Round controls" style={{ marginBottom: '1rem' }}>
          <button type="button" className="primary-button" onClick={startNextRound}>
            New round
          </button>
          <button type="button" className="primary-button" onClick={handleReveal} disabled={revealed}>
            Reveal
          </button>
          <button type="button" className="primary-button" onClick={fillAllRegions}>
            Fill all regions
          </button>
          <button type="button" className="primary-button" onClick={clearDots}>
            Clear dots
          </button>
        </div>

        <CrowdFavoriteQuestionView
          question={question}
          revealed={revealed}
          dots={dots}
          onDotRevealed={handleDotRevealed}
        />
      </section>
    </div>
  );
}
