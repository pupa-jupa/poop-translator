import { describe, expect, it } from 'vitest';
import { DEFAULT_STATE, STORAGE_KEY, StorageRepository } from '../src/core/storage';
import type { ExtensionState, StorageAreaLike } from '../src/shared/types';

class MemoryStorage implements StorageAreaLike {
  data: Record<string, unknown> = {};

  async get(key: string): Promise<Record<string, unknown>> {
    return { [key]: this.data[key] };
  }

  async set(items: Record<string, unknown>): Promise<void> {
    await Promise.resolve();
    Object.assign(this.data, structuredClone(items));
  }
}

function historyInput(requestId: string) {
  return {
    requestId,
    original: 'Hello',
    translation: 'Привет',
    sourceLanguage: 'en',
    targetLanguage: 'ru' as const,
    source: 'manual' as const,
  };
}

describe('StorageRepository', () => {
  it('repairs malformed persisted values without losing valid settings', async () => {
    const storage = new MemoryStorage();
    storage.data[STORAGE_KEY] = {
      schemaVersion: 999,
      settings: { sourceMode: 'auto', saveHistory: 'yes' },
      history: [{ nope: true }],
      dictionary: null,
    };

    const state = await new StorageRepository(storage).loadState();

    expect(state).toEqual({
      ...DEFAULT_STATE,
      settings: { ...DEFAULT_STATE.settings, sourceMode: 'auto' },
    });
  });

  it('does not persist translations when history is disabled', async () => {
    const storage = new MemoryStorage();
    const repository = new StorageRepository(storage);
    await repository.updateSettings({ saveHistory: false });

    const added = await repository.addHistory(historyInput('request-1'));
    const state = await repository.loadState();

    expect(added).toBe(false);
    expect(state.history).toEqual([]);
  });

  it('deduplicates history by request id during concurrent writes', async () => {
    const storage = new MemoryStorage();
    const repository = new StorageRepository(storage);

    await Promise.all([
      repository.addHistory(historyInput('request-1')),
      repository.addHistory(historyInput('request-1')),
    ]);

    const state = await repository.loadState();
    expect(state.history).toHaveLength(1);
    expect(state.history[0]?.requestId).toBe('request-1');
  });

  it('deduplicates dictionary pairs ignoring case and surrounding spaces', async () => {
    const storage = new MemoryStorage();
    const repository = new StorageRepository(storage);

    const first = await repository.addDictionaryEntry({
      original: '  Hello ',
      translation: ' Привет ',
      note: '',
    });
    const second = await repository.addDictionaryEntry({
      original: 'hello',
      translation: 'привет',
      note: 'повтор',
    });

    const state = await repository.loadState();
    expect(first.added).toBe(true);
    expect(second).toEqual({ added: false, entry: first.entry });
    expect(state.dictionary).toHaveLength(1);
  });

  it('keeps all independent concurrent dictionary additions', async () => {
    const storage = new MemoryStorage();
    const repository = new StorageRepository(storage);

    await Promise.all([
      repository.addDictionaryEntry({ original: 'cat', translation: 'кот', note: '' }),
      repository.addDictionaryEntry({ original: 'dog', translation: 'собака', note: '' }),
    ]);

    const state = (storage.data[STORAGE_KEY] as ExtensionState);
    expect(state.dictionary.map((entry) => entry.original).sort()).toEqual(['cat', 'dog']);
  });

  it('accepts later writes after a mutation rejects', async () => {
    const storage = new MemoryStorage();
    const repository = new StorageRepository(storage);

    await expect(repository.updateDictionaryEntry('missing', {
      original: 'cat', translation: 'кот', note: '',
    })).rejects.toThrow('Запись не найдена');
    await repository.addDictionaryEntry({ original: 'dog', translation: 'собака', note: '' });

    expect((await repository.loadState()).dictionary[0]?.original).toBe('dog');
  });
});
