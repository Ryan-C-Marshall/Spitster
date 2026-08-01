import type { ArtistRankQuestion } from '@spitster/shared';

const MAX_RANK = 200;

function rankFillPercent(rank: number | null): number {
  if (rank === null) return 0;
  const clamped = Math.min(Math.max(rank, 1), MAX_RANK);
  return ((MAX_RANK - clamped + 1) / MAX_RANK) * 100;
}

export function ArtistRankQuestionView({
  question,
  revealed,
}: {
  question: ArtistRankQuestion;
  revealed: boolean;
}) {
  return (
    <div className="question-card">
      <div>
        <h2>Guess the artist</h2>
        <p className="track-reveal-artist">
          One artist is ranked in each player's top 200 artists from the last 6 months according to:
        </p>
      </div>

      <ul className="rank-list">
        {question.playerRanks.map((playerRank) => (
          <li key={playerRank.spotifyUserId} className="rank-row">
            <span className="rank-name">{playerRank.displayName ?? playerRank.spotifyUserId}</span>
            <span className="rank-value">
              {playerRank.rank !== null ? `#${playerRank.rank}` : 'Unranked'}
            </span>
            <span className="rank-bar-track">
              <span className="rank-bar-fill" style={{ width: `${rankFillPercent(playerRank.rank)}%` }} />
            </span>
          </li>
        ))}
      </ul>

      <div className="section-divider" aria-hidden="true" />

      <ul className="option-list four-options">
        {question.options.map((option) => {
          const isCorrect = revealed && option.artistId === question.correctArtistId;

          return (
            <li key={option.artistId} className={`option${isCorrect ? ' option-correct' : ''}`}>
              {option.name}
            </li>
          );
        })}
      </ul>
    </div>
  );
}