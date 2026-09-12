import { normalizeState, STORAGE_KEY } from './storage';
import { createRequestId } from '../shared/messages';
import type {
  DictionaryEntry,
  DictionaryInput,
  ExtensionState,
  HistoryInput,
  Settings,
} from '../shared/types';

export type StorageMutationOperation =
  | 'updateSettings'
  | 'addHistory'
  | 'removeHistoryEntry'
  | 'clearHistory'
  | 'addDictionaryEntry'
  | 'updateDictionaryEntry'
  | 'removeDictionaryEntry'
  | 'clearDictionary'
  | 'clearUserData';

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
  'updateDictionaryEntry', 'removeDictionaryEntry', 'clearDictionary', 'clearUserData',
]);

export function isStorageMutationMessage(value: unknown): value is StorageMutationMessage {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return record.type === 'STORAGE_MUTATION'
    && typeof record.requestId === 'string'
    && record.requestId.startsWith('pt-')
    && typeof record.operation === 'string'
    && operations.has(record.operation as StorageMutationOperation);
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
}

let defaultClient: StorageClient | undefined;

export function getStorageClient(): StorageClient {
  defaultClient ??= new StorageClient((message) => chrome.runtime.sendMessage(message));
  return defaultClient;
}
