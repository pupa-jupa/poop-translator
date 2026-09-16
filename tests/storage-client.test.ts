import { describe, expect, it, vi } from 'vitest';
import { isStorageMutationMessage, StorageClient } from '../src/core/storage-client';

describe('StorageClient', () => {
  it('routes mutations through the extension runtime coordinator', async () => {
    const sendMessage = vi.fn(async (message: unknown) => ({ ok: true, data: message }));
    const client = new StorageClient(sendMessage);

    const result = await client.addDictionaryEntry({ original: 'cat', translation: 'кот', note: '' });

    expect(sendMessage).toHaveBeenCalledWith(expect.objectContaining({
      type: 'STORAGE_MUTATION',
      operation: 'addDictionaryEntry',
      payload: { original: 'cat', translation: 'кот', note: '' },
    }));
    expect(result).toMatchObject({ operation: 'addDictionaryEntry' });
  });

  it('surfaces coordinator failures to the calling context', async () => {
    const client = new StorageClient(async () => ({ ok: false, error: 'Хранилище недоступно' }));

    await expect(client.clearHistory()).rejects.toThrow('Хранилище недоступно');
  });

  it('sends backup imports through the serialized storage coordinator', async () => {
    const sendMessage = vi.fn(async () => ({
      ok: true,
      data: { historyAdded: 2, dictionaryAdded: 3 },
    }));
    const client = new StorageClient(sendMessage);
    const backup = { format: 'poop-translator-backup', version: 1, data: {} };

    await expect(client.importBackup(backup)).resolves.toEqual({ historyAdded: 2, dictionaryAdded: 3 });
    expect(sendMessage).toHaveBeenCalledWith(expect.objectContaining({
      type: 'STORAGE_MUTATION', operation: 'importBackup', payload: backup,
    }));
  });

  it('rejects malformed mutation payloads at the background boundary', () => {
    const envelope = { type: 'STORAGE_MUTATION', requestId: 'pt-validation' };

    expect(isStorageMutationMessage({
      ...envelope,
      operation: 'addDictionaryEntry',
      payload: { original: '', translation: 'кот', note: '' },
    })).toBe(false);
    expect(isStorageMutationMessage({
      ...envelope,
      operation: 'updateSettings',
      payload: { textScale: 999 },
    })).toBe(false);
    expect(isStorageMutationMessage({
      ...envelope,
      operation: 'removeHistoryEntry',
      payload: 42,
    })).toBe(false);
    expect(isStorageMutationMessage({
      ...envelope,
      operation: 'addDictionaryEntry',
      payload: { original: 'cat', translation: 'кот', note: '' },
    })).toBe(true);
    expect(isStorageMutationMessage({
      ...envelope,
      operation: 'addHistory',
      payload: {
        requestId: 'pt-ocr', original: 'cat', translation: 'кот', sourceLanguage: 'en',
        targetLanguage: 'ru', source: 'ocr-region',
      },
    })).toBe(true);
    expect(isStorageMutationMessage({
      ...envelope, operation: 'rateReview', payload: { id: 'cat', rating: 'good' },
    })).toBe(true);
    expect(isStorageMutationMessage({
      ...envelope, operation: 'rateReview', payload: { id: 'cat', rating: 'guess' },
    })).toBe(false);
    expect(isStorageMutationMessage({
      ...envelope, operation: 'rateReview', payload: { id: '', rating: 'good' },
    })).toBe(false);
    expect(isStorageMutationMessage({
      ...envelope, operation: 'importBackup', payload: { format: 'poop-translator-backup', version: 2, data: {} },
    })).toBe(true);
  });

  it('reports a rated card only after the storage coordinator succeeds', async () => {
    const client = new StorageClient(async (message) => ({ ok: true, data: {
      dictionaryId: (message as { payload: { id: string } }).payload.id,
      streak: 1, dueAt: 86_401_000, lastReviewedAt: 1_000,
    } }));
    await expect(client.rateReview('cat', 'good')).resolves.toMatchObject({
      dictionaryId: 'cat', streak: 1,
    });
  });
});
