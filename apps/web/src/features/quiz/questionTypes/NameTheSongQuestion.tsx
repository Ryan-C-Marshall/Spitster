import type { NameTheArtistQuestion, NameTheTitleQuestion } from '@spitster/shared';

const musicPlayingGifUrl = new URL('../../../resources/images/music-playing.gif', import.meta.url).href;

type NameTheSongQuestion = NameTheTitleQuestion | NameTheArtistQuestion;

const HEADER_BY_TYPE: Record<NameTheSongQuestion['type'], string> = {
  'name-the-title': 'Name the Title',
  'name-the-artist': 'Name the Artist',
};

export function NameTheSongQuestionView({
  question,
  revealed,
}: {
  question: NameTheSongQuestion;
  revealed: boolean;
}) {
  return (
    <div className="question-card">
      <div className="question-header">
        <div style={{ flex: 1, minWidth: 200 }}>
          <h2>{HEADER_BY_TYPE[question.type]}</h2>
          <div style={{ height: '0.5rem' }} />
          <p className="track-reveal-artist">This is at least two players' top-1000 over the last year</p>
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
    </div>
  );
}