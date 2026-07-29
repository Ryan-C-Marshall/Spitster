import type { Question } from '@spitster/shared';

import { WhoseTopTrackQuestionView } from './questionTypes/WhoseTopTrackQuestion.js';

// Adding a question type: implement its display component in ./questionTypes
// and add a case below. If a Question variant is left unhandled, the
// `_exhaustive` assignment in default will fail to compile.
export function QuestionView({ question, revealed }: { question: Question; revealed: boolean }) {
  switch (question.type) {
    case 'whose-top-track':
      return <WhoseTopTrackQuestionView question={question} revealed={revealed} />;
    default: {
      const _exhaustive: never = question;
      return _exhaustive;
    }
  }
}