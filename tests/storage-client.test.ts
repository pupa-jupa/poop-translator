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
  });
});
