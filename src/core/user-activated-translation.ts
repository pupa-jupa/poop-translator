import type { SourceMode, TargetLanguage, TranslationResult } from '../shared/types';
import type { ChromeTranslator, TranslationCallbacks } from './translator';

type UserActivatedEngine = Pick<ChromeTranslator, 'prepareForMode' | 'translate'>;

/**
 * Starts every potentially downloadable component before the click task ends,
 * then performs detection and translation after preparation has completed.
 */
export function translateFromUserActivation(
  engine: UserActivatedEngine,
  text: string,
  sourceMode: SourceMode,
  callbacks: TranslationCallbacks = {},
  targetLanguage?: TargetLanguage,
): Promise<TranslationResult> {
  const preparation = engine.prepareForMode(sourceMode, callbacks, targetLanguage);
  return preparation.then(() => engine.translate(text, sourceMode, callbacks, targetLanguage));
}
