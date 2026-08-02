import type { WhoseTopTrackQuestion } from '@spitster/shared';

const musicPlayingGifUrl = new URL('../../../resources/images/music-playing.gif', import.meta.url).href;

export function WhoseTopTrackQuestionView({
  question,
  revealed,
}: {
  question: WhoseTopTrackQuestion;
  revealed: boolean;
}) {
  return (
    <div className="question-card">
      <div className="question-header">
        <div style={{ flex: 1, minWidth: 200 }}>
          <h2>Whose top track is this?</h2>
          <div style={{ height: '0.5rem' }} />
          <p className="track-reveal-artist">This is in someone's top-200 over the last 6 months</p>
        </div>

        <div className={`lobby-card playing track-reveal-card${revealed ? ' revealed' : ''}`}>
          {revealed ? (
            <div className="track-reveal-content">
              <h3 className="track-reveal-title">{question.track.name}</h3>
              <p className="track-reveal-artist">
                {question.track.artists.map((artist) => artist.name).join(', ')}
              </p>
            </div>
          ) : (
            <img className="track-reveal-gif" src={musicPlayingGifUrl} alt="" aria-hidden="true" />
          )}
        </div>
      </div>

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