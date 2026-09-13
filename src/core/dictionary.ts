import type { DictionaryVariant } from '../shared/types';

type CompactVariant = [translation: string, partOfSpeech?: string];
type DictionaryShard = Record<string, CompactVariant[]>;
type FetchLike = (url: string) => Promise<Pick<Response, 'ok' | 'json'>>;

function comparable(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .trim()
    .toLocaleLowerCase('ru-RU');
}

export function normalizeLookupTerm(value: string, sourceLanguage: 'en' | 'ru' = 'en'): string | undefined {
  const alphabet = sourceLanguage === 'ru' ? 'а-яё' : 'a-z';
  const normalized = value
    .normalize('NFKC')
    .replace(/[’‘]/g, "'")
    .trim()
    .toLocaleLowerCase(sourceLanguage === 'ru' ? 'ru-RU' : 'en-US')
    .replace(new RegExp(`^[^${alphabet}]+|[^${alphabet}]+$`, 'g'), '')
    .replace(/\s+/g, ' ');
  if (!normalized || normalized.length > 80 || !new RegExp(`^[${alphabet}]`).test(normalized)) return undefined;
  if (normalized.split(' ').length > 5) return undefined;
  return normalized;
}

export function selectAlternativeVariants(
  variants: DictionaryVariant[],
  primaryTranslation: string,
  limit = 8,
): DictionaryVariant[] {
  const primary = comparable(primaryTranslation);
  const seen = new Set<string>([primary]);
  const selected: DictionaryVariant[] = [];
  for (const variant of variants) {
    const key = comparable(variant.translation);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    selected.push(variant);
    if (selected.length >= limit) break;
  }
  return selected;
}

export class LocalDictionary {
  private readonly shards = new Map<string, Promise<DictionaryShard>>();

  constructor(
    private readonly getResourceUrl: (path: string) => string = (path) => chrome.runtime.getURL(path),
    private readonly fetcher: FetchLike = (url) => fetch(url),
    private readonly maxCachedShards = 8,
  ) {}

  private loadShard(shardId: string): Promise<DictionaryShard> {
    const cached = this.shards.get(shardId);
    if (cached) {
      this.shards.delete(shardId);
      this.shards.set(shardId, cached);
      return cached;
    }
    const loading = this.fetcher(this.getResourceUrl(`dictionary/${shardId}.json`))
      .then(async (response) => {
        if (!response.ok) throw new Error('Dictionary shard unavailable');
        return await response.json() as DictionaryShard;
      })
      .catch((error) => {
        this.shards.delete(shardId);
        throw error;
      });
    this.shards.set(shardId, loading);
    while (this.shards.size > this.maxCachedShards) {
      const oldest = this.shards.keys().next().value as string | undefined;
      if (!oldest) break;
      this.shards.delete(oldest);
    }
    return loading;
  }

  async lookup(value: string, sourceLanguage: 'en' | 'ru' = 'en'): Promise<DictionaryVariant[]> {
    const term = normalizeLookupTerm(value, sourceLanguage);
    if (!term) return [];
    try {
      const direction = sourceLanguage === 'ru' ? 'rus-eng' : 'eng-rus';
      const shard = await this.loadShard(`${direction}/${term[0]!}`);
      return (shard[term] ?? []).map(([translation, partOfSpeech]) => ({
        translation,
        ...(partOfSpeech ? { partOfSpeech } : {}),
      }));
    } catch {
      return [];
    }
  }
}
