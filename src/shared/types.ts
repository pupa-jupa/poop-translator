export type SourceMode = 'en' | 'auto';
export type TranslationSource = 'manual' | 'selection' | 'context-menu';

export interface Settings {
  sourceMode: SourceMode;
  saveHistory: boolean;
  showSelectionButton: boolean;
}

export interface HistoryEntry {
  id: string;
  requestId: string;
  original: string;
  translation: string;
  sourceLanguage: string;
  targetLanguage: 'ru';
  source: TranslationSource;
  createdAt: number;
}

export type HistoryInput = Omit<HistoryEntry, 'id' | 'createdAt'>;

export interface DictionaryEntry {
  id: string;
  original: string;
  translation: string;
  note: string;
  createdAt: number;
  updatedAt: number;
}

export interface DictionaryInput {
  original: string;
  translation: string;
  note?: string;
}

export interface ExtensionState {
  schemaVersion: 1;
  settings: Settings;
  history: HistoryEntry[];
  dictionary: DictionaryEntry[];
}

export interface StorageAreaLike {
  get(key: string): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
}

export interface TranslationResult {
  original: string;
  translation: string;
  sourceLanguage: string;
  targetLanguage: 'ru';
  alreadyRussian: boolean;
}

export type EngineAvailability = 'available' | 'downloadable' | 'downloading' | 'unavailable';

export interface PageProgress {
  completed: number;
  total: number;
}
