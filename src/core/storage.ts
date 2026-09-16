import type {
  DictionaryEntry,
  DictionaryInput,
  ExtensionBackup,
  ExtensionState,
  HistoryEntry,
  HistoryInput,
  ReviewProgress,
  ReviewRating,
  Settings,
  StorageAreaLike,
  TextScale,
} from '../shared/types';
import { scheduleReview } from './review';

export const STORAGE_KEY = 'poopTranslatorState';
const HISTORY_LIMIT = 500;
const DEFAULT_TEXT_SCALE: TextScale = 115;

export const DEFAULT_STATE: ExtensionState = {
  schemaVersion: 2,
  settings: {
    sourceMode: 'en',
    saveHistory: true,
    showSelectionButton: true,
    textScale: DEFAULT_TEXT_SCALE,
  },
  history: [],
  dictionary: [],
  review: [],
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function validTimestamp(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
    && Number.isFinite(new Date(value).getTime());
}

function normalizedSettings(value: unknown): Settings {
  if (!isRecord(value)) return { ...DEFAULT_STATE.settings };
  return {
    sourceMode: value.sourceMode === 'auto' || value.sourceMode === 'ru' ? value.sourceMode : 'en',
    saveHistory: typeof value.saveHistory === 'boolean'
      ? value.saveHistory
      : DEFAULT_STATE.settings.saveHistory,
    showSelectionButton: typeof value.showSelectionButton === 'boolean'
      ? value.showSelectionButton
      : DEFAULT_STATE.settings.showSelectionButton,
    textScale: value.textScale === 100 || value.textScale === 130
      ? value.textScale
      : DEFAULT_TEXT_SCALE,
  };
}

function normalizedHistory(value: unknown): HistoryEntry[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is HistoryEntry => {
    if (!isRecord(entry)) return false;
    return nonEmptyString(entry.id)
      && nonEmptyString(entry.requestId)
      && nonEmptyString(entry.original)
      && nonEmptyString(entry.translation)
      && nonEmptyString(entry.sourceLanguage)
      && (entry.targetLanguage === 'ru' || entry.targetLanguage === 'en')
      && ['manual', 'selection', 'context-menu', 'ocr-region'].includes(String(entry.source))
      && typeof entry.createdAt === 'number';
  }).slice(0, HISTORY_LIMIT);
}

function normalizedDictionary(value: unknown): DictionaryEntry[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is DictionaryEntry => {
    if (!isRecord(entry)) return false;
    return nonEmptyString(entry.id)
      && nonEmptyString(entry.original)
      && nonEmptyString(entry.translation)
      && typeof entry.note === 'string'
      && typeof entry.createdAt === 'number'
      && typeof entry.updatedAt === 'number';
  });
}

function normalizedReview(value: unknown, dictionary: DictionaryEntry[]): ReviewProgress[] {
  if (!Array.isArray(value)) return [];
  const ids = new Set(dictionary.map((entry) => entry.id));
  const valid = new Map<string, ReviewProgress>();
  for (const item of value) {
    if (!isRecord(item) || !nonEmptyString(item.dictionaryId) || !ids.has(item.dictionaryId)
      || !validTimestamp(item.dueAt)
      || !validTimestamp(item.lastReviewedAt)
      || typeof item.streak !== 'number' || !Number.isInteger(item.streak)
      || item.streak < 0 || item.streak > 10_000) continue;
    const candidate: ReviewProgress = {
      dictionaryId: item.dictionaryId,
      dueAt: item.dueAt,
      lastReviewedAt: item.lastReviewedAt,
      streak: item.streak,
    };
    const old = valid.get(candidate.dictionaryId);
    if (!old || old.lastReviewedAt < candidate.lastReviewedAt) valid.set(candidate.dictionaryId, candidate);
  }
  return [...valid.values()];
}

export function normalizeState(value: unknown): ExtensionState {
  const record = isRecord(value) ? value : {};
  const dictionary = normalizedDictionary(record.dictionary);
  return {
    schemaVersion: 2,
    settings: normalizedSettings(record.settings),
    history: normalizedHistory(record.history),
    dictionary,
    review: record.schemaVersion === 2 ? normalizedReview(record.review, dictionary) : [],
  };
}

export function createBackup(
  state: ExtensionState,
  exportedAt = new Date(),
): ExtensionBackup {
  return {
    format: 'poop-translator-backup',
    version: 2,
    exportedAt: exportedAt.toISOString(),
    data: normalizeState(state),
  };
}

function parseBackup(value: unknown): ExtensionState {
  if (!isRecord(value)
    || value.format !== 'poop-translator-backup'
    || (value.version !== 1 && value.version !== 2)
    || !isRecord(value.data)
    || value.data.schemaVersion !== value.version) {
    throw new Error('Файл не похож на резервную копию poop translator');
  }
  return normalizeState(value.data);
}

function makeId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function dictionaryKey(original: string, translation: string): string {
  return `${original.trim().toLocaleLowerCase()}\u0000${translation.trim().toLocaleLowerCase()}`;
}

export class StorageRepository {
  private writeQueue: Promise<void> = Promise.resolve();

  constructor(private readonly area: StorageAreaLike) {}

  async loadState(): Promise<ExtensionState> {
    const stored = await this.area.get(STORAGE_KEY);
    return normalizeState(stored[STORAGE_KEY]);
  }

  private async mutate<T>(operation: (state: ExtensionState) => T | Promise<T>): Promise<T> {
    const result = this.writeQueue.then(async () => {
      const state = await this.loadState();
      const output = await operation(state);
      await this.area.set({ [STORAGE_KEY]: state });
      return output;
    });
    // A failed individual operation must not poison the queue tail.
    this.writeQueue = result.then(() => undefined, () => undefined);
    return result;
  }

  async updateSettings(patch: Partial<Settings>): Promise<Settings> {
    return this.mutate((state) => {
      state.settings = normalizedSettings({ ...state.settings, ...patch });
      return { ...state.settings };
    });
  }

  async addHistory(input: HistoryInput): Promise<boolean> {
    return this.mutate((state) => {
      if (!state.settings.saveHistory) return false;
      if (state.history.some((entry) => entry.requestId === input.requestId)) return false;
      const entry: HistoryEntry = {
        ...input,
        original: input.original.trim(),
        translation: input.translation.trim(),
        id: makeId(),
        createdAt: Date.now(),
      };
      state.history.unshift(entry);
      state.history = state.history.slice(0, HISTORY_LIMIT);
      return true;
    });
  }

  async removeHistoryEntry(id: string): Promise<void> {
    await this.mutate((state) => {
      state.history = state.history.filter((entry) => entry.id !== id);
    });
  }

  async clearHistory(): Promise<void> {
    await this.mutate((state) => {
      state.history = [];
    });
  }

  async addDictionaryEntry(input: DictionaryInput): Promise<{ added: boolean; entry: DictionaryEntry }> {
    const original = input.original.trim();
    const translation = input.translation.trim();
    if (!original || !translation) throw new Error('Заполните слово и перевод');

    return this.mutate((state) => {
      const key = dictionaryKey(original, translation);
      const duplicate = state.dictionary.find(
        (entry) => dictionaryKey(entry.original, entry.translation) === key,
      );
      if (duplicate) return { added: false, entry: duplicate };

      const now = Date.now();
      const entry: DictionaryEntry = {
        id: makeId(),
        original,
        translation,
        note: input.note?.trim() ?? '',
        createdAt: now,
        updatedAt: now,
      };
      state.dictionary.unshift(entry);
      return { added: true, entry };
    });
  }

  async updateDictionaryEntry(id: string, input: DictionaryInput): Promise<DictionaryEntry> {
    const original = input.original.trim();
    const translation = input.translation.trim();
    if (!original || !translation) throw new Error('Заполните слово и перевод');

    return this.mutate((state) => {
      const index = state.dictionary.findIndex((entry) => entry.id === id);
      if (index < 0) throw new Error('Запись не найдена');
      const key = dictionaryKey(original, translation);
      const duplicate = state.dictionary.find(
        (entry) => entry.id !== id && dictionaryKey(entry.original, entry.translation) === key,
      );
      if (duplicate) throw new Error('Такая пара уже есть в словаре');

      const previous = state.dictionary[index]!;
      const entry: DictionaryEntry = {
        ...previous,
        original,
        translation,
        note: input.note?.trim() ?? '',
        updatedAt: Date.now(),
      };
      state.dictionary[index] = entry;
      if (dictionaryKey(previous.original, previous.translation) !== key) {
        state.review = state.review.filter((item) => item.dictionaryId !== id);
      }
      return entry;
    });
  }

  async removeDictionaryEntry(id: string): Promise<void> {
    await this.mutate((state) => {
      state.dictionary = state.dictionary.filter((entry) => entry.id !== id);
      state.review = state.review.filter((item) => item.dictionaryId !== id);
    });
  }

  async clearDictionary(): Promise<void> {
    await this.mutate((state) => {
      state.dictionary = [];
      state.review = [];
    });
  }

  async clearUserData(): Promise<void> {
    await this.mutate((state) => {
      state.schemaVersion = 2;
      state.settings = { ...DEFAULT_STATE.settings };
      state.history = [];
      state.dictionary = [];
      state.review = [];
    });
  }

  async rateReview(id: string, rating: ReviewRating, now = Date.now()): Promise<ReviewProgress> {
    if (rating !== 'again' && rating !== 'hard' && rating !== 'good') {
      throw new Error('Некорректная оценка повторения');
    }
    return this.mutate((state) => {
      if (!state.dictionary.some((entry) => entry.id === id)) throw new Error('Запись не найдена');
      const old = state.review.find((item) => item.dictionaryId === id);
      if (old && old.dueAt > now) throw new Error('Карточка уже повторена. Обновите список.');
      const next = scheduleReview(id, old, rating, now);
      state.review = [...state.review.filter((item) => item.dictionaryId !== id), next];
      return next;
    });
  }

  async importBackup(value: unknown): Promise<{ historyAdded: number; dictionaryAdded: number }> {
    const imported = parseBackup(value);
    return this.mutate((state) => {
      const historyIds = new Set(state.history.map((entry) => entry.requestId));
      const importedHistory = imported.history.filter((entry) => {
        if (historyIds.has(entry.requestId)) return false;
        historyIds.add(entry.requestId);
        return true;
      });
      const byKey = new Map(state.dictionary.map((entry) => [dictionaryKey(entry.original, entry.translation), entry]));
      const usedIds = new Set(state.dictionary.map((entry) => entry.id));
      const remapped = new Map<string, string>();
      const importedDictionary: DictionaryEntry[] = [];
      for (const entry of imported.dictionary) {
        const key = dictionaryKey(entry.original, entry.translation);
        const existing = byKey.get(key);
        if (existing) { remapped.set(entry.id, existing.id); continue; }
        let id = entry.id;
        while (usedIds.has(id)) id = makeId();
        const added = { ...entry, id };
        importedDictionary.push(added);
        usedIds.add(id);
        byKey.set(key, added);
        remapped.set(entry.id, id);
      }

      const progress = new Map(state.review.map((item) => [item.dictionaryId, item]));
      for (const item of imported.review) {
        const id = remapped.get(item.dictionaryId);
        if (!id) continue;
        const existing = progress.get(id);
        if (!existing || existing.lastReviewedAt < item.lastReviewedAt) {
          progress.set(id, { ...item, dictionaryId: id });
        }
      }

      state.settings = imported.settings;
      state.history = [...importedHistory, ...state.history]
        .sort((left, right) => right.createdAt - left.createdAt)
        .slice(0, HISTORY_LIMIT);
      state.dictionary = [...importedDictionary, ...state.dictionary]
        .sort((left, right) => right.updatedAt - left.updatedAt);
      state.review = [...progress.values()];
      return { historyAdded: importedHistory.length, dictionaryAdded: importedDictionary.length };
    });
  }
}

function chromeStorageArea(): StorageAreaLike {
  return {
    get: (key) => chrome.storage.local.get(key) as Promise<Record<string, unknown>>,
    set: (items) => chrome.storage.local.set(items),
  };
}

let defaultRepository: StorageRepository | undefined;

export function getStorageRepository(): StorageRepository {
  defaultRepository ??= new StorageRepository(chromeStorageArea());
  return defaultRepository;
}
