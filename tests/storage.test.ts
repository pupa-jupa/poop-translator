import { describe, expect, it } from 'vitest';
import { createBackup, DEFAULT_STATE, STORAGE_KEY, StorageRepository } from '../src/core/storage';
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
  it('migrates existing v1 history and dictionary into review cards without changing entries', async () => {
    const storage = new MemoryStorage();
    storage.data[STORAGE_KEY] = {
      schemaVersion: 1, settings: { ...DEFAULT_STATE.settings },
      history: [{ id: 'h', ...historyInput('r'), createdAt: 42 }],
      dictionary: [{ id: 'd', original: 'cat', translation: 'кот', note: '', createdAt: 4, updatedAt: 5 }],
    };
    const state = await new StorageRepository(storage).loadState();
    expect(state.schemaVersion).toBe(4);
    expect(state.history[0]?.requestId).toBe('r');
    expect(state.dictionary[0]?.id).toBe('d');
    expect(state.review).toEqual([]);
  });

  it('rates only dictionary entries, saves progress and discards it on deletion', async () => {
    const storage = new MemoryStorage();
    const repository = new StorageRepository(storage);
    const { entry } = await repository.addDictionaryEntry({ original: 'cat', translation: 'кот' });
    await expect(repository.rateReview('unknown', 'good', 1_000)).rejects.toThrow('Запись не найдена');
    expect(await repository.rateReview(entry.id, 'good', 1_000)).toMatchObject({
      dictionaryId: entry.id, dueAt: 86_401_000, streak: 1,
    });
    await repository.removeDictionaryEntry(entry.id);
    expect((await repository.loadState()).review).toEqual([]);
  });

  it('makes an edited dictionary pair new again but retains progress for a note edit', async () => {
    const repository = new StorageRepository(new MemoryStorage());
    const { entry } = await repository.addDictionaryEntry({ original: 'cat', translation: 'кот' });
    await repository.rateReview(entry.id, 'good', 1_000);
    await repository.updateDictionaryEntry(entry.id, { original: 'cat', translation: 'кот', note: 'животное' });
    expect((await repository.loadState()).review).toHaveLength(1);
    await repository.updateDictionaryEntry(entry.id, { original: 'dog', translation: 'собака', note: '' });
    expect((await repository.loadState()).review).toEqual([]);
  });

  it('does not claim a card was rated when writing fails', async () => {
    class FailingStorage extends MemoryStorage {
      failNext = false;
      override async set(items: Record<string, unknown>): Promise<void> {
        if (this.failNext) { this.failNext = false; throw new Error('Квота исчерпана'); }
        await super.set(items);
      }
    }
    const storage = new FailingStorage();
    const repository = new StorageRepository(storage);
    const { entry } = await repository.addDictionaryEntry({ original: 'cat', translation: 'кот' });
    storage.failNext = true;
    await expect(repository.rateReview(entry.id, 'good', 1_000)).rejects.toThrow('Квота исчерпана');
    expect((await repository.loadState()).review).toEqual([]);
    await repository.rateReview(entry.id, 'good', 1_000);
    expect((await repository.loadState()).review).toHaveLength(1);
  });

  it('serializes competing ratings of the same due card as one review', async () => {
    const repository = new StorageRepository(new MemoryStorage());
    const { entry } = await repository.addDictionaryEntry({ original: 'cat', translation: 'кот' });
    const results = await Promise.allSettled([
      repository.rateReview(entry.id, 'good', 1_000),
      repository.rateReview(entry.id, 'good', 1_000),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    expect((await repository.loadState()).review[0]?.streak).toBe(1);
  });

  it('rejects orphaned or malformed review progress on loading', async () => {
    const storage = new MemoryStorage();
    storage.data[STORAGE_KEY] = { ...DEFAULT_STATE,
      dictionary: [{ id: 'cat', original: 'cat', translation: 'кот', note: '', createdAt: 1, updatedAt: 1 }],
      review: [
        { dictionaryId: 'cat', dueAt: 100, lastReviewedAt: 10, streak: 2 },
        { dictionaryId: 'absent', dueAt: 100, lastReviewedAt: 10, streak: 2 },
        { dictionaryId: 'cat', dueAt: Infinity, lastReviewedAt: 10, streak: 2 },
        { dictionaryId: 'cat', dueAt: 1e308, lastReviewedAt: 20, streak: 2 },
      ],
    };
    expect((await new StorageRepository(storage).loadState()).review).toEqual([
      { dictionaryId: 'cat', dueAt: 100, lastReviewedAt: 10, streak: 2 },
    ]);
  });

  it('imports a v1 backup and maps v2 review by pair without overwriting newer progress', async () => {
    const storage = new MemoryStorage();
    const repository = new StorageRepository(storage);
    const { entry } = await repository.addDictionaryEntry({ original: 'cat', translation: 'кот' });
    await repository.rateReview(entry.id, 'good', 2_000);
    const importedEntry = { ...entry, id: 'backup-cat', original: ' CAT ' };
    const dog = { ...entry, id: 'backup-dog', original: 'dog', translation: 'собака' };
    const v1 = { format: 'poop-translator-backup', version: 1,
      data: { schemaVersion: 1, settings: DEFAULT_STATE.settings, history: [], dictionary: [dog] } };
    await repository.importBackup(v1);
    const v2 = { format: 'poop-translator-backup', version: 2,
      data: { schemaVersion: 2, settings: DEFAULT_STATE.settings, history: [],
        dictionary: [importedEntry, dog], review: [
          { dictionaryId: 'backup-cat', dueAt: 300, lastReviewedAt: 1_000, streak: 3 },
          { dictionaryId: 'backup-dog', dueAt: 900, lastReviewedAt: 3_000, streak: 2 },
        ] } };
    await repository.importBackup(v2);
    const state = await repository.loadState();
    expect(state.dictionary).toHaveLength(2);
    expect(state.review.find((item) => item.dictionaryId === entry.id)?.lastReviewedAt).toBe(2_000);
    expect(state.review.find((item) => item.dictionaryId === 'backup-dog')?.dueAt).toBe(900);
    expect(createBackup(state).version).toBe(4);
  });

  it('remaps imported dictionary IDs that conflict with a different local pair', async () => {
    const storage = new MemoryStorage();
    const repository = new StorageRepository(storage);
    const { entry } = await repository.addDictionaryEntry({ original: 'cat', translation: 'кот' });
    const backup = { format: 'poop-translator-backup', version: 3, data: {
      ...DEFAULT_STATE,
      schemaVersion: 3,
      dictionary: [{ ...entry, original: 'dog', translation: 'собака' }],
      review: [{ dictionaryId: entry.id, dueAt: 900, lastReviewedAt: 100, streak: 1 }],
    } };
    await repository.importBackup(backup);
    const state = await repository.loadState();
    const dog = state.dictionary.find((item) => item.original === 'dog');
    expect(dog?.id).not.toBe(entry.id);
    expect(state.review.find((item) => item.dictionaryId === dog?.id)?.dueAt).toBe(900);
  });
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

  it('defaults older page settings to Russian and persists an English target in a backup', async () => {
    const storage = new MemoryStorage();
    storage.data[STORAGE_KEY] = {
      ...DEFAULT_STATE,
      schemaVersion: 1,
      settings: { sourceMode: 'auto', saveHistory: true, showSelectionButton: true, textScale: 115 },
    };
    const repository = new StorageRepository(storage);
    expect((await repository.loadState()).settings.pageTargetLanguage).toBe('ru');
    await repository.updateSettings({ pageTargetLanguage: 'en' });
    expect((await repository.loadState()).settings.pageTargetLanguage).toBe('en');
    expect(createBackup(await repository.loadState()).data.settings.pageTargetLanguage).toBe('en');
  });

  it('migrates the old direction into a target and preserves multilingual choices', async () => {
    const storage = new MemoryStorage();
    storage.data[STORAGE_KEY] = {
      schemaVersion: 2,
      settings: { sourceMode: 'ru', pageTargetLanguage: 'ru', saveHistory: true, showSelectionButton: true, textScale: 115 },
      history: [], dictionary: [], review: [],
    };
    const repository = new StorageRepository(storage);
    expect((await repository.loadState()).settings.targetLanguage).toBe('en');
    await repository.updateSettings({ sourceMode: 'de', targetLanguage: 'ru' });
    expect((await repository.loadState()).settings).toMatchObject({ sourceMode: 'de', targetLanguage: 'ru' });
    await repository.updateSettings({ sourceMode: 'ru', targetLanguage: 'ru' });
    expect((await repository.loadState()).settings).toMatchObject({ sourceMode: 'ru', targetLanguage: 'en' });
  });

  it('migrates v3 to v4 with a separate OCR mode and preserves expanded targets', async () => {
    const storage = new MemoryStorage();
    storage.data[STORAGE_KEY] = {
      schemaVersion: 3,
      settings: {
        sourceMode: 'ja', targetLanguage: 'ko', pageTargetLanguage: 'zh-Hant',
        saveHistory: true, showSelectionButton: true, textScale: 115,
      },
      history: [], dictionary: [], review: [],
    };

    const state = await new StorageRepository(storage).loadState();

    expect(state).toMatchObject({
      schemaVersion: 4,
      settings: {
        sourceMode: 'ja', targetLanguage: 'ko', pageTargetLanguage: 'zh-Hant', ocrMode: 'auto',
      },
    });
    expect(createBackup(state)).toMatchObject({ version: 4, data: { schemaVersion: 4 } });
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

  it('normalizes the text scale to one of the supported values', async () => {
    const storage = new MemoryStorage();
    storage.data[STORAGE_KEY] = {
      ...DEFAULT_STATE,
      settings: { ...DEFAULT_STATE.settings, textScale: 130 },
    };

    expect((await new StorageRepository(storage).loadState()).settings.textScale).toBe(130);

    (storage.data[STORAGE_KEY] as ExtensionState).settings.textScale = 999 as 130;
    expect((await new StorageRepository(storage).loadState()).settings.textScale).toBe(115);
  });

  it('imports a versioned backup by merging unique history and dictionary entries', async () => {
    const storage = new MemoryStorage();
    const repository = new StorageRepository(storage);
    await repository.addHistory(historyInput('current-request'));
    await repository.addDictionaryEntry({ original: 'cat', translation: 'кот', note: 'current' });

    const importedStorage = new MemoryStorage();
    const importedRepository = new StorageRepository(importedStorage);
    await importedRepository.updateSettings({ sourceMode: 'ru', textScale: 130 });
    await importedRepository.addHistory(historyInput('imported-request'));
    await importedRepository.addDictionaryEntry({ original: 'cat', translation: 'кот', note: 'backup' });
    await importedRepository.addDictionaryEntry({ original: 'dog', translation: 'собака', note: '' });
    const backup = createBackup(await importedRepository.loadState(), new Date('2026-09-13T10:00:00.000Z'));
    backup.data.history.push({ ...backup.data.history[0]! });
    backup.data.dictionary.push({ ...backup.data.dictionary.find((entry) => entry.original === 'dog')! });

    const result = await repository.importBackup(backup);
    const state = await repository.loadState();

    expect(result).toEqual({ historyAdded: 1, dictionaryAdded: 1 });
    expect(state.settings).toMatchObject({ sourceMode: 'ru', textScale: 130 });
    expect(state.history.map((entry) => entry.requestId).sort()).toEqual(['current-request', 'imported-request']);
    expect(state.dictionary.map((entry) => entry.original).sort()).toEqual(['cat', 'dog']);
  });

  it('rejects files that are not poop translator backups without changing data', async () => {
    const storage = new MemoryStorage();
    const repository = new StorageRepository(storage);
    await repository.addDictionaryEntry({ original: 'cat', translation: 'кот', note: '' });

    await expect(repository.importBackup({ format: 'unknown', version: 1, data: {} }))
      .rejects.toThrow('Файл не похож на резервную копию poop translator');

    expect((await repository.loadState()).dictionary.map((entry) => entry.original)).toEqual(['cat']);
  });
});
