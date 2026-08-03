import type { Question } from '@spitster/shared';

import { WhoseTopTrackQuestionView } from './questionTypes/WhoseTopTrackQuestion.js';
import { GuessThePlaylistQuestionView } from './questionTypes/GuessThePlaylistQuestion.js';
import { ArtistRankQuestionView } from './questionTypes/ArtistRankQuestion.js';
import { NameTheSongQuestionView } from './questionTypes/NameTheSongQuestion.js';
import { CrowdFavoriteQuestionView, type CrowdFavoriteDot } from './questionTypes/CrowdFavouriteQuestion.js';

export function QuestionView({
  question,
  revealed,
  crowdFavoriteDots,
  onCrowdFavoriteDotRevealed,
}: {
  question: Question;
  revealed: boolean;
  crowdFavoriteDots: CrowdFavoriteDot[];
  onCrowdFavoriteDotRevealed: (dot: CrowdFavoriteDot) => void;
}) {
  switch (question.type) {
    case 'whose-top-track':
      return <WhoseTopTrackQuestionView question={question} revealed={revealed} />;
    case 'guess-the-playlist':
      return <GuessThePlaylistQuestionView question={question} revealed={revealed} />;
    case 'artist-rank':
      return <ArtistRankQuestionView question={question} revealed={revealed} />;
    case 'name-the-title':
    case 'name-the-artist':
      return <NameTheSongQuestionView question={question} revealed={revealed} />;
    case 'crowd-favorite':
      return (
        <CrowdFavoriteQuestionView
          question={question}
          revealed={revealed}
          dots={crowdFavoriteDots}
          onDotRevealed={onCrowdFavoriteDotRevealed}
        />
      );
    default: {
      // @ts-ignore
      const _exhaustive: never = question;
      return _exhaustive;
    }
  }
}