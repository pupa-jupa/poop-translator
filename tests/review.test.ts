import { describe, expect, it } from 'vitest';
import { dueCards, scheduleReview } from '../src/core/review';
import type { DictionaryEntry, ExtensionState } from '../src/shared/types';

const day = 24 * 60 * 60 * 1000;
const now = Date.UTC(2026, 8, 15, 12);
const cat: DictionaryEntry = {
  id: 'cat-id', original: 'cat', translation: 'кот', note: '', createdAt: now, updatedAt: now,
};

describe('review schedule', () => {
  it('offers new dictionary entries immediately and waits until a rated card is due', () => {
    const state: Pick<ExtensionState, 'dictionary' | 'review'> = {
      dictionary: [cat], review: [],
    };
    expect(dueCards(state, now).map((entry) => entry.id)).toEqual(['cat-id']);
    state.review = [scheduleReview('cat-id', undefined, 'good', now)];
    expect(dueCards(state, now + day - 1)).toEqual([]);
    expect(dueCards(state, now + day).map((entry) => entry.id)).toEqual(['cat-id']);
  });

  it('schedules success in steps of one, three and seven days', () => {
    const first = scheduleReview('cat-id', undefined, 'good', now);
    const second = scheduleReview('cat-id', first, 'good', now + day);
    const third = scheduleReview('cat-id', second, 'good', now + 4 * day);
    expect([first, second, third].map(({ dueAt, streak }) => [dueAt, streak]))
      .toEqual([[now + day, 1], [now + 4 * day, 2], [now + 11 * day, 3]]);
  });

  it('resets a failed card for ten minutes and reduces a difficult streak', () => {
    const previous = { dictionaryId: 'cat-id', dueAt: now, lastReviewedAt: now - day, streak: 3 };
    expect(scheduleReview('cat-id', previous, 'again', now)).toEqual({
      dictionaryId: 'cat-id', dueAt: now + 600_000, lastReviewedAt: now, streak: 0,
    });
    expect(scheduleReview('cat-id', previous, 'hard', now)).toEqual({
      dictionaryId: 'cat-id', dueAt: now + day, lastReviewedAt: now, streak: 2,
    });
  });

  it('orders due cards by deadline then creation time', () => {
    const dog = { ...cat, id: 'dog-id', original: 'dog', createdAt: now - day };
    const state = { dictionary: [cat, dog], review: [
      { dictionaryId: 'cat-id', dueAt: now - 2, lastReviewedAt: now - day, streak: 1 },
      { dictionaryId: 'dog-id', dueAt: now - 1, lastReviewedAt: now - day, streak: 1 },
    ] } satisfies Pick<ExtensionState, 'dictionary' | 'review'>;
    expect(dueCards(state, now).map((entry) => entry.id)).toEqual(['cat-id', 'dog-id']);
  });
});
