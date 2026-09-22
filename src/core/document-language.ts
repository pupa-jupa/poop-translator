import type { LanguageCode, TargetLanguage } from '../shared/types';
import type { ChromeTranslator, TranslationCallbacks } from './translator';
import { TranslationEngineError } from './translator';
import { languageDefinition } from './languages';

type Detector = Pick<ChromeTranslator, 'detectSourceLanguage'>;
type PairEngine = Pick<ChromeTranslator, 'getAvailability' | 'prepare'>;

export interface DocumentPairActivation {
  sourceLanguage: LanguageCode;
  targetLanguage: TargetLanguage;
  activate: (callbacks?: TranslationCallbacks) => Promise<void>;
}

export const MIXED_DOCUMENT_MESSAGE = 'В документе обнаружены разные исходные языки. Выберите исходный язык явно и повторите перевод.';

export class MixedDocumentLanguageError extends Error {
  constructor() {
    super(MIXED_DOCUMENT_MESSAGE);
    this.name = 'MixedDocumentLanguageError';
  }
}

export function documentLanguageSamples(texts: string[]): string[] {
  const candidates = texts.map((text) => text.trim()).filter((text) => text.length >= 40);
  if (!candidates.length) {
    const fallback = texts.join(' ').trim().slice(0, 3_000);
    return fallback ? [fallback] : [];
  }
  const count = Math.min(candidates.length, 12);
  return Array.from({ length: count }, (_value, index) => {
    const position = count === 1 ? 0 : Math.round(index * (candidates.length - 1) / (count - 1));
    return candidates[position]!.slice(0, 500);
  });
}

export async function detectDocumentSource(
  engine: Detector,
  texts: string[],
  targetLanguage: TargetLanguage,
): Promise<{ sourceLanguage: LanguageCode; sample: string }> {
  const samples = documentLanguageSamples(texts);
  if (!samples.length) throw new Error('В документе нет текста для перевода.');
  const sample = samples.join(' ').slice(0, 3_000);
  const sourceLanguage = await engine.detectSourceLanguage(sample);
  for (const part of samples) {
    if (part.length < 40) continue;
    const detected = await engine.detectSourceLanguage(part);
    if (detected !== sourceLanguage && detected !== targetLanguage) throw new MixedDocumentLanguageError();
  }
  return { sourceLanguage, sample };
}

export async function shouldTranslateDocumentPart(
  engine: Detector,
  text: string,
  sourceLanguage: LanguageCode,
  targetLanguage: TargetLanguage,
  autoSource: boolean,
): Promise<boolean> {
  if (sourceLanguage === targetLanguage) return false;
  const detected = await engine.detectSourceLanguage(text);
  if (detected === targetLanguage) return false;
  if (autoSource && text.length >= 40 && detected !== sourceLanguage) throw new MixedDocumentLanguageError();
  return true;
}

export async function prepareDocumentPair(
  engine: PairEngine,
  sourceLanguage: LanguageCode,
  targetLanguage: TargetLanguage,
): Promise<DocumentPairActivation | undefined> {
  if (sourceLanguage === targetLanguage) return undefined;
  const availability = await engine.getAvailability(sourceLanguage, targetLanguage);
  if (availability === 'unavailable') {
    throw new TranslationEngineError('PAIR_UNAVAILABLE',
      `Перевод с ${languageDefinition(sourceLanguage).fromName} на ${languageDefinition(targetLanguage).toName} недоступен в этом Chrome.`);
  }
  if (availability === 'downloadable' || availability === 'downloading') {
    return { sourceLanguage, targetLanguage, activate: (callbacks = {}) => engine.prepare(sourceLanguage, callbacks, targetLanguage) };
  }
  await engine.prepare(sourceLanguage, {}, targetLanguage);
  return undefined;
}
