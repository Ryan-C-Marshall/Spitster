import type { ArtistRankQuestion } from '@spitster/shared';

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
          One artist, ranked in everyone's top 200 (medium term). Who is it?
        </p>
      </div>

      <ul className="option-list">
        {question.playerRanks.map((playerRank) => (
          <li key={playerRank.spotifyUserId} className="option">
            <p className="option-title">{playerRank.displayName ?? playerRank.spotifyUserId}</p>
            <p className="option-subtitle">
              {playerRank.rank !== null ? `#${playerRank.rank}` : 'Unranked'}
            </p>
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