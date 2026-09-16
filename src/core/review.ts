import type { DictionaryEntry, ExtensionState, ReviewProgress, ReviewRating } from '../shared/types';

const DAY = 86_400_000;
const GOOD_DAYS = [1, 3, 7, 14, 30, 60];
const MAX_STREAK = 10_000;

export function scheduleReview(
  dictionaryId: string,
  previous: ReviewProgress | undefined,
  rating: ReviewRating,
  now: number,
): ReviewProgress {
  if (!Number.isFinite(now)) throw new Error('Некорректная дата повторения');
  const oldStreak = Math.max(0, Math.min(MAX_STREAK, previous?.streak ?? 0));
  const streak = rating === 'again' ? 0 : rating === 'hard'
    ? Math.max(0, oldStreak - 1) : Math.min(MAX_STREAK, oldStreak + 1);
  const delay = rating === 'again' ? 600_000 : rating === 'hard'
    ? DAY : GOOD_DAYS[Math.min(streak - 1, GOOD_DAYS.length - 1)]! * DAY;
  return { dictionaryId, streak, lastReviewedAt: now, dueAt: now + delay };
}

export function dueCards(state: Pick<ExtensionState, 'dictionary' | 'review'>, now: number): DictionaryEntry[] {
  const progress = new Map(state.review.map((item) => [item.dictionaryId, item]));
  return state.dictionary.filter((entry) => (progress.get(entry.id)?.dueAt ?? -Infinity) <= now)
    .sort((a, b) => (progress.get(a.id)?.dueAt ?? -Infinity)
      - (progress.get(b.id)?.dueAt ?? -Infinity) || a.createdAt - b.createdAt);
}
