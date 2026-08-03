import type { Question } from '@spitster/shared';

import { WhoseTopTrackQuestionView } from './questionTypes/WhoseTopTrackQuestion.js';
import { GuessThePlaylistQuestionView } from './questionTypes/GuessThePlaylistQuestion.js';
import { ArtistRankQuestionView } from './questionTypes/ArtistRankQuestion.js';
import { NameTheSongQuestionView } from './questionTypes/NameTheSongQuestion.js';
import { CrowdFavoriteQuestionView } from './questionTypes/CrowdFavouriteQuestion.js';

// Adding a question type: implement its display component in ./questionTypes
// and add a case below. If a Question variant is left unhandled, the
// `_exhaustive` assignment in default will fail to compile.
export function QuestionView({ question, revealed }: { question: Question; revealed: boolean }) {
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
      return <CrowdFavoriteQuestionView question={question} revealed={revealed} />;
    default: {
      // @ts-ignore
      const _exhaustive: never = question;
      return _exhaustive;
    }
  }
}