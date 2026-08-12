import type { OffTheChartQuestion } from '@spitster/shared';

import { usePlayer } from '../../player/PlayerContext.js';

export function OffTheChartQuestionView({
  question,
  revealed,
}: {
  question: OffTheChartQuestion;
  revealed: boolean;
}) {
  const { play, currentTrackUri, setQuietMode } = usePlayer();

  async function handlePlayTrack(trackUri: string) {
    try {
      // Nothing autoplays for this question type (see SILENT_QUESTION_TYPES
      // in QuizPage.tsx), so quiz volume stays at lobby level until someone
      // actually picks a card to listen to.
      setQuietMode(false);
      await play(trackUri);
    } catch (error) {
      console.error('Unable to play track:', error);
    }
  }

  return (
    <div className="question-card">
      <div className="question-header">
        <h2>Off the Chart</h2>
        <p></p>
        <p className="track-reveal-artist">
          Three of these are in {question.displayName ?? question.spotifyUserId}&rsquo;s top 100 songs over the
          last 4 weeks. Which one isn&rsquo;t?
        </p>
      </div>

      <div className="song-card-row four-options">
        {question.options.map((track) => {
          const isPlaying = track.uri === currentTrackUri;
          const isCorrect = revealed && track.id === question.correctTrackId;

          return (
            <article
              key={track.id}
              className={`lobby-card song-card${isPlaying ? ' playing' : ''}${isCorrect ? ' option-correct' : ''}`}
              role="button"
              tabIndex={0}
              aria-pressed={isPlaying}
              onClick={() => handlePlayTrack(track.uri)}
            >
              <div className="track-reveal-content">
                <h3 className="track-reveal-title">{track.name}</h3>
                <p className="track-reveal-artist">
                  {track.artists.map((artist) => artist.name).join(', ')}
                </p>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}