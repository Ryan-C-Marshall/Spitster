/**
 * Tracks which answers each question type has already served this session,
 * so generators can avoid repeating themselves. Stored on the session
 * (same lifetime as connectedAccounts — see express-session.d.ts). Keyed by
 * "bucket" rather than QuestionType directly, since some types may
 * intentionally share a bucket — see historyKey on QuestionGenerator.
 */
export type AnswerHistoryStore = Record<string, string[]>;

/** Scoped read/write view over a single bucket. Passed to a generator's
 * `generate()` so it can check and record used answers without knowing
 * anything about session storage. */
export interface AnswerHistory {
  has(key: string): boolean;
  add(key: string): void;
}

export function getAnswerHistoryBucket(store: AnswerHistoryStore, bucketKey: string): AnswerHistory {
  return {
    has(key) {
      return (store[bucketKey] ?? []).includes(key);
    },
    add(key) {
      const bucket = store[bucketKey];
      if (bucket) {
        if (!bucket.includes(key)) bucket.push(key);
      } else {
        store[bucketKey] = [key];
      }
    },
  };
}