export type LanguageCode = 'en' | 'ru' | 'uk' | 'de' | 'fr' | 'es';
export type SourceMode = LanguageCode | 'auto';
export type TargetLanguage = 'en' | 'ru';
export type PageTargetLanguage = TargetLanguage;
export type TextScale = 100 | 115 | 130;
export type TranslationSource = 'manual' | 'selection' | 'context-menu' | 'ocr-region';
export type OcrLanguage = 'eng' | 'rus' | 'ukr' | 'deu' | 'fra' | 'spa';

export interface Point {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface RegionRect {
  left: number;
  top: number;
  width: number;
  height: number;
  viewportWidth: number;
  viewportHeight: number;
}

export interface BitmapRegion {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface OcrRecognitionResult {
  text: string;
  confidence: number;
}

export interface Settings {
  sourceMode: SourceMode;
  targetLanguage: TargetLanguage;
  pageTargetLanguage: PageTargetLanguage;
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
  targetLanguage: TargetLanguage;
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

export type ReviewRating = 'again' | 'hard' | 'good';

export interface ReviewProgress {
  dictionaryId: string;
  dueAt: number;
  lastReviewedAt: number;
  streak: number;
}

export interface ExtensionState {
  schemaVersion: 3;
  settings: Settings;
  history: HistoryEntry[];
  dictionary: DictionaryEntry[];
  review: ReviewProgress[];
}

export interface ExtensionBackup {
  format: 'poop-translator-backup';
  version: 3;
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
  targetLanguage: TargetLanguage;
  alreadyTarget: boolean;
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
