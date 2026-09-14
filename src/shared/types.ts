export type SourceMode = 'en' | 'ru' | 'auto';
export type TextScale = 100 | 115 | 130;
export type TranslationSource = 'manual' | 'selection' | 'context-menu';

export interface Settings {
  sourceMode: SourceMode;
  saveHistory: boolean;
  showSelectionButton: boolean;
  textScale: TextScale;
}

export interface HistoryEntry {
  id: string;
  requestId: string;
  original: string;
  translation: string;
  sourceLanguage: string;
  targetLanguage: 'ru' | 'en';
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

export interface ExtensionBackup {
  format: 'poop-translator-backup';
  version: 1;
  exportedAt: string;
  data: ExtensionState;
}

export interface BackupImportResult {
  historyAdded: number;
  dictionaryAdded: number;
}

export interface StorageAreaLike {
  get(key: string): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
}

export interface TranslationResult {
  original: string;
  translation: string;
  sourceLanguage: string;
  targetLanguage: 'ru' | 'en';
  alreadyRussian: boolean;
}

export interface DictionaryVariant {
  translation: string;
  partOfSpeech?: string;
}

export type EngineAvailability = 'available' | 'downloadable' | 'downloading' | 'unavailable';

export interface PageProgress {
  completed: number;
  total: number;
}
