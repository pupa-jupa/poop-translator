import type { LanguageCode, SourceMode, TargetLanguage, TranslationResult } from '../shared/types';
import type { ChromeTranslator, TranslationCallbacks } from './translator';

type UserActivatedEngine = Pick<ChromeTranslator, 'detectSourceLanguage' | 'getAvailability' | 'translate'>;

export type TranslationAttempt =
  | { status: 'translated'; result: TranslationResult }
  | {
    status: 'needs-activation';
    sourceLanguage: LanguageCode;
    targetLanguage: TargetLanguage;
    activate: (callbacks?: TranslationCallbacks) => Promise<TranslationResult>;
  };

function unchangedResult(
  text: string,
  sourceLanguage: LanguageCode,
  targetLanguage: TargetLanguage,
): TranslationResult {
  const original = text.trim();
  return { original, translation: original, sourceLanguage, targetLanguage, alreadyTarget: true };
}

/**
 * Starts the component known at click time synchronously. In auto mode that is
 * only language detection. If the detected pair needs a download, the returned
 * activate callback must be invoked by a second user gesture.
 */
export function beginTranslationFromUserActivation(
  engine: UserActivatedEngine,
  text: string,
  sourceMode: SourceMode,
  targetLanguage?: TargetLanguage,
  callbacks: TranslationCallbacks = {},
): Promise<TranslationAttempt> {
  if (sourceMode !== 'auto') {
    const translation = engine.translate(text, sourceMode, callbacks, targetLanguage);
    return translation.then((result) => ({ status: 'translated', result }));
  }

  const detection = engine.detectSourceLanguage(text, callbacks);
  return detection.then(async (sourceLanguage) => {
    const resolvedTarget = targetLanguage ?? (sourceLanguage === 'ru' ? 'en' : 'ru');
    if (sourceLanguage === resolvedTarget) {
      return { status: 'translated', result: unchangedResult(text, sourceLanguage, resolvedTarget) };
    }

    const availability = await engine.getAvailability(sourceLanguage, resolvedTarget);
    if (availability === 'downloadable' || availability === 'downloading') {
      return {
        status: 'needs-activation',
        sourceLanguage,
        targetLanguage: resolvedTarget,
        activate: (activationCallbacks = callbacks) => engine.translate(
          text,
          sourceLanguage,
          activationCallbacks,
          resolvedTarget,
        ),
      };
    }

    const result = await engine.translate(text, sourceLanguage, callbacks, resolvedTarget);
    return { status: 'translated', result };
  });
}
