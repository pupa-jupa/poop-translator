import { selectAlternativeVariants } from './dictionary';
import { createRequestId, type RuntimeResponse } from '../shared/messages';
import type { DictionaryVariant } from '../shared/types';

export async function lookupAlternativeVariants(
  text: string,
  primaryTranslation: string,
  sourceLanguage: string,
): Promise<DictionaryVariant[]> {
  if (sourceLanguage !== 'en' && sourceLanguage !== 'ru') return [];
  try {
    const response = await chrome.runtime.sendMessage({
      type: 'LOOKUP_DICTIONARY',
      requestId: createRequestId(),
      text,
      sourceLanguage,
    }) as RuntimeResponse<DictionaryVariant[]>;
    if (!response.ok || !Array.isArray(response.data)) return [];
    return selectAlternativeVariants(response.data, primaryTranslation);
  } catch {
    return [];
  }
}
