import type { GuessThePlaylistQuestion } from '@spitster/shared';

import { usePlayer } from '../../player/PlayerContext.js';

export function GuessThePlaylistQuestionView({
  question,
  revealed,
}: {
  question: GuessThePlaylistQuestion;
  revealed: boolean;
}) {
  const { play, currentTrackUri } = usePlayer();

  async function handlePlayTrack(trackUri: string) {
    try {
      await play(trackUri);
    } catch (error) {
      console.error('Unable to play track:', error);
    }
  }

  return (
    <div className="question-card">
      <div className="question-header">
        <h2>Which playlist is this?</h2>
        <p></p>
        <p className="track-reveal-artist">All three songs belong to one of these playlists.</p>
      </div>

      <div className="song-card-row">
        {question.tracks.map((track) => {
          const isPlaying = track.uri === currentTrackUri;

          return (
            <article
              key={track.id}
              className={`lobby-card song-card${isPlaying ? ' playing' : ''}`}
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

      <div className="section-divider" aria-hidden="true" />

      <ul className="option-list four-options">
        {question.options.map((option) => {
          const isCorrect = revealed && option.playlistId === question.correctPlaylistId;

          return (
            <li key={option.playlistId} className={`option${isCorrect ? ' option-correct' : ''}`}>
              <p className="option-title">{option.name}</p>
              <p className="option-subtitle">{option.ownerDisplayName ?? option.ownerSpotifyUserId}</p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}