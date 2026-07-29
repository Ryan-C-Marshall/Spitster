import type { WhoseTopTrackQuestion } from '@spitster/shared';

export function WhoseTopTrackQuestionView({
  question,
  revealed,
}: {
  question: WhoseTopTrackQuestion;
  revealed: boolean;
}) {
  return (
    <div className="question-card">
      <h2>Whose top track is this?</h2>

      <ul className="option-list">
        {question.options.map((option) => {
          const isCorrect = revealed && question.correctSpotifyUserIds.includes(option.spotifyUserId);

          return (
            <li key={option.spotifyUserId} className={`option${isCorrect ? ' option-correct' : ''}`}>
              {option.displayName ?? option.spotifyUserId}
            </li>
          );
        })}
      </ul>
    </div>
  );
}