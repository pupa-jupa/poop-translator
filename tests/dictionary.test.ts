import { describe, expect, it, vi } from 'vitest';
import { LocalDictionary, selectAlternativeVariants } from '../src/core/dictionary';
import { lookupAlternativeVariants } from '../src/core/dictionary-client';

describe('LocalDictionary', () => {
  it('normalizes a selected word, loads its shard once and returns distinct meanings', async () => {
    const fetcher = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        bank: [['берег', 'n'], ['банк', 'n'], ['отмель', 'n'], ['накреняться', 'v']],
      }),
    } as Response));
    const dictionary = new LocalDictionary((path) => `chrome-extension://test/${path}`, fetcher);

    await expect(dictionary.lookup('  BANK! ')).resolves.toEqual([
      { translation: 'берег', partOfSpeech: 'n' },
      { translation: 'банк', partOfSpeech: 'n' },
      { translation: 'отмель', partOfSpeech: 'n' },
      { translation: 'накреняться', partOfSpeech: 'v' },
    ]);
    await dictionary.lookup('bank');

    expect(fetcher).toHaveBeenCalledOnce();
    expect(fetcher).toHaveBeenCalledWith('chrome-extension://test/dictionary/eng-rus/b.json');
  });

  it('does not load a shard for long prose or non-English text', async () => {
    const fetcher = vi.fn();
    const dictionary = new LocalDictionary((path) => path, fetcher);

    await expect(dictionary.lookup('This is a complete sentence with too many separate words.')).resolves.toEqual([]);
    await expect(dictionary.lookup('привет')).resolves.toEqual([]);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('loads the reverse shard for a Russian word', async () => {
    const fetcher = vi.fn(async () => ({
      ok: true,
      json: async () => ({ банк: [['bank', 'n'], ['banking institution', 'n']] }),
    } as Response));
    const dictionary = new LocalDictionary((path) => path, fetcher);

    await expect(dictionary.lookup('Банк', 'ru')).resolves.toHaveLength(2);
    expect(fetcher).toHaveBeenCalledWith('dictionary/rus-eng/б.json');
  });

  it('evicts the least recently used shard when the cache limit is reached', async () => {
    const fetcher = vi.fn(async () => ({ ok: true, json: async () => ({}) } as Response));
    const dictionary = new LocalDictionary((path) => path, fetcher, 2);

    await dictionary.lookup('apple');
    await dictionary.lookup('bank');
    await dictionary.lookup('cat');
    await dictionary.lookup('apple');

    expect(fetcher).toHaveBeenCalledTimes(4);
  });
});

describe('selectAlternativeVariants', () => {
  it('removes the primary translation, stress-mark duplicates and repeated meanings', () => {
    const variants = [
      { translation: 'ба́нк', partOfSpeech: 'n' },
      { translation: 'банк', partOfSpeech: 'n' },
      { translation: 'берег', partOfSpeech: 'n' },
      { translation: 'Берег', partOfSpeech: 'n' },
      { translation: 'класть в банк', partOfSpeech: 'v' },
    ];

    expect(selectAlternativeVariants(variants, 'банк')).toEqual([
      { translation: 'берег', partOfSpeech: 'n' },
      { translation: 'класть в банк', partOfSpeech: 'v' },
    ]);
  });
});

describe('lookupAlternativeVariants', () => {
  it('returns multiple local meanings only for EN ↔ RU', async () => {
    const sendMessage = vi.fn(async () => ({ ok: true, data: [
      { translation: 'банк', partOfSpeech: 'n' },
      { translation: 'берег', partOfSpeech: 'n' },
      { translation: 'наклонять', partOfSpeech: 'v' },
    ] }));
    vi.stubGlobal('chrome', { runtime: { sendMessage } });
    try {
      await expect(lookupAlternativeVariants('bank', 'банк', 'en', 'ru')).resolves.toEqual([
        { translation: 'берег', partOfSpeech: 'n' },
        { translation: 'наклонять', partOfSpeech: 'v' },
      ]);
      await expect(lookupAlternativeVariants('bank', '銀行', 'en', 'ja')).resolves.toEqual([]);
      expect(sendMessage).toHaveBeenCalledOnce();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
