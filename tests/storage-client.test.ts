import { describe, expect, it, vi } from 'vitest';
import { StorageClient } from '../src/core/storage-client';

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
});
