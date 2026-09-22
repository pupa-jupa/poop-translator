import { normalizeState, STORAGE_KEY } from './storage';
import { createRequestId } from '../shared/messages';
import type {
  DictionaryEntry,
  DictionaryInput,
  BackupImportResult,
  ExtensionState,
  HistoryInput,
  ReviewProgress,
  ReviewRating,
  Settings,
} from '../shared/types';
import { isLanguageCode, isOcrMode, isSourceMode, isTargetLanguage } from './languages';

export type StorageMutationOperation =
  | 'updateSettings'
  | 'addHistory'
  | 'removeHistoryEntry'
  | 'clearHistory'
  | 'addDictionaryEntry'
  | 'updateDictionaryEntry'
  | 'removeDictionaryEntry'
  | 'clearDictionary'
  | 'clearUserData'
  | 'rateReview'
  | 'importBackup';

export interface StorageMutationMessage {
  type: 'STORAGE_MUTATION';
  requestId: string;
  operation: StorageMutationOperation;
  payload?: unknown;
}

interface MutationResponse<T> {
  ok: boolean;
  data?: T;
  error?: string;
}

type SendMessage = (message: unknown) => Promise<unknown>;
type ReadState = () => Promise<ExtensionState>;

const operations = new Set<StorageMutationOperation>([
  'updateSettings', 'addHistory', 'removeHistoryEntry', 'clearHistory', 'addDictionaryEntry',
  'updateDictionaryEntry', 'removeDictionaryEntry', 'clearDictionary', 'clearUserData', 'rateReview', 'importBackup',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isString(value: unknown, maxLength: number, allowEmpty = false): value is string {
  return typeof value === 'string'
    && value.length <= maxLength
    && (allowEmpty || value.trim().length > 0);
}

function isSettingsPatch(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return (value.sourceMode === undefined || isSourceMode(value.sourceMode))
    && (value.targetLanguage === undefined || isTargetLanguage(value.targetLanguage))
    && (value.pageTargetLanguage === undefined || isTargetLanguage(value.pageTargetLanguage))
    && (value.ocrMode === undefined || isOcrMode(value.ocrMode))
    && (value.saveHistory === undefined || typeof value.saveHistory === 'boolean')
    && (value.showSelectionButton === undefined || typeof value.showSelectionButton === 'boolean')
    && (value.textScale === undefined || value.textScale === 100 || value.textScale === 115 || value.textScale === 130);
}

function isDictionaryInput(value: unknown): boolean {
  return isRecord(value)
    && isString(value.original, 500)
    && isString(value.translation, 500)
    && (value.note === undefined || isString(value.note, 1_000, true));
}

function isHistoryInput(value: unknown): boolean {
  return isRecord(value)
    && isString(value.requestId, 200)
    && isString(value.original, 10_000)
    && isString(value.translation, 10_000)
    && isLanguageCode(value.sourceLanguage)
    && isTargetLanguage(value.targetLanguage)
    && (value.source === 'manual' || value.source === 'selection' || value.source === 'context-menu'
      || value.source === 'ocr-region');
}

function hasValidPayload(operation: StorageMutationOperation, payload: unknown): boolean {
  switch (operation) {
    case 'updateSettings': return isSettingsPatch(payload);
    case 'addHistory': return isHistoryInput(payload);
    case 'addDictionaryEntry': return isDictionaryInput(payload);
    case 'updateDictionaryEntry':
      return isRecord(payload) && isString(payload.id, 200) && isDictionaryInput(payload.input);
    case 'rateReview':
      return isRecord(payload) && isString(payload.id, 200)
        && (payload.rating === 'again' || payload.rating === 'hard' || payload.rating === 'good');
    case 'removeHistoryEntry':
    case 'removeDictionaryEntry':
      return isString(payload, 200);
    case 'importBackup':
      return isRecord(payload)
        && payload.format === 'poop-translator-backup'
        && (payload.version === 1 || payload.version === 2 || payload.version === 3 || payload.version === 4)
        && isRecord(payload.data);
    case 'clearHistory':
    case 'clearDictionary':
    case 'clearUserData':
      return payload === undefined;
  }
}

export function isStorageMutationMessage(value: unknown): value is StorageMutationMessage {
  if (!isRecord(value)) return false;
  const record = value;
  const operation = record.operation;
  return record.type === 'STORAGE_MUTATION'
    && typeof record.requestId === 'string'
    && record.requestId.startsWith('pt-')
    && typeof operation === 'string'
    && operations.has(operation as StorageMutationOperation)
    && hasValidPayload(operation as StorageMutationOperation, record.payload);
}

async function defaultReadState(): Promise<ExtensionState> {
  const stored = await chrome.storage.local.get(STORAGE_KEY);
  return normalizeState(stored[STORAGE_KEY]);
}

export class StorageClient {
  constructor(
    private readonly sendMessage: SendMessage,
    private readonly readState: ReadState = defaultReadState,
  ) {}

  loadState(): Promise<ExtensionState> {
    return this.readState();
  }

  private async mutate<T>(operation: StorageMutationOperation, payload?: unknown): Promise<T> {
    const response = await this.sendMessage({
      type: 'STORAGE_MUTATION', requestId: createRequestId(), operation, payload,
    }) as MutationResponse<T>;
    if (!response?.ok) throw new Error(response?.error ?? 'Не удалось сохранить данные.');
    return response.data as T;
  }

  updateSettings(patch: Partial<Settings>): Promise<Settings> {
    return this.mutate('updateSettings', patch);
  }

  addHistory(input: HistoryInput): Promise<boolean> {
    return this.mutate('addHistory', input);
  }

  removeHistoryEntry(id: string): Promise<void> {
    return this.mutate('removeHistoryEntry', id);
  }

  clearHistory(): Promise<void> {
    return this.mutate('clearHistory');
  }

  addDictionaryEntry(input: DictionaryInput): Promise<{ added: boolean; entry: DictionaryEntry }> {
    return this.mutate('addDictionaryEntry', input);
  }

  updateDictionaryEntry(id: string, input: DictionaryInput): Promise<DictionaryEntry> {
    return this.mutate('updateDictionaryEntry', { id, input });
  }

  removeDictionaryEntry(id: string): Promise<void> {
    return this.mutate('removeDictionaryEntry', id);
  }

  clearDictionary(): Promise<void> {
    return this.mutate('clearDictionary');
  }

  clearUserData(): Promise<void> {
    return this.mutate('clearUserData');
  }

  rateReview(id: string, rating: ReviewRating): Promise<ReviewProgress> {
    return this.mutate('rateReview', { id, rating });
  }

  importBackup(value: unknown): Promise<BackupImportResult> {
    return this.mutate('importBackup', value);
  }
}

let defaultClient: StorageClient | undefined;

export function getStorageClient(): StorageClient {
  defaultClient ??= new StorageClient((message) => chrome.runtime.sendMessage(message));
  return defaultClient;
}
