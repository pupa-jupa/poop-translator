import type {
  DictionaryEntry,
  DictionaryInput,
  ExtensionState,
  HistoryEntry,
  HistoryInput,
  Settings,
  StorageAreaLike,
} from '../shared/types';

export const STORAGE_KEY = 'poopTranslatorState';
const HISTORY_LIMIT = 500;

export const DEFAULT_STATE: ExtensionState = {
  schemaVersion: 1,
  settings: {
    sourceMode: 'en',
    saveHistory: true,
    showSelectionButton: true,
  },
  history: [],
  dictionary: [],
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
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
      && ['manual', 'selection', 'context-menu'].includes(String(entry.source))
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

export function normalizeState(value: unknown): ExtensionState {
  const record = isRecord(value) ? value : {};
  return {
    schemaVersion: 1,
    settings: normalizedSettings(record.settings),
    history: normalizedHistory(record.history),
    dictionary: normalizedDictionary(record.dictionary),
  };
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
      return entry;
    });
  }

  async removeDictionaryEntry(id: string): Promise<void> {
    await this.mutate((state) => {
      state.dictionary = state.dictionary.filter((entry) => entry.id !== id);
    });
  }

  async clearDictionary(): Promise<void> {
    await this.mutate((state) => {
      state.dictionary = [];
    });
  }

  async clearUserData(): Promise<void> {
    await this.mutate((state) => {
      state.schemaVersion = 1;
      state.settings = { ...DEFAULT_STATE.settings };
      state.history = [];
      state.dictionary = [];
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
