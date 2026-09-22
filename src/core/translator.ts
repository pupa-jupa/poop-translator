import type { EngineAvailability, LanguageCode, PageTargetLanguage, SourceMode, TargetLanguage, TranslationResult } from '../shared/types';
import { LANGUAGE_CODES, languageDefinition } from './languages';

type AvailabilityValue = string;

interface ModelMonitorLike {
  addEventListener(type: 'downloadprogress', listener: (event: Event & { loaded: number }) => void): void;
}

interface TranslatorInstanceLike {
  translate(text: string): Promise<string>;
  destroy?: () => void;
}

interface TranslatorConstructorLike {
  availability(options: { sourceLanguage: string; targetLanguage: string }): Promise<AvailabilityValue>;
  create(options: {
    sourceLanguage: string;
    targetLanguage: string;
    monitor?: (monitor: ModelMonitorLike) => void;
  }): Promise<TranslatorInstanceLike>;
}

interface DetectorInstanceLike {
  detect(text: string): Promise<Array<{ detectedLanguage: string; confidence: number }>>;
  destroy?: () => void;
}

interface DetectorConstructorLike {
  availability(options?: { expectedInputLanguages?: string[] }): Promise<AvailabilityValue>;
  create(options?: {
    expectedInputLanguages?: string[];
    monitor?: (monitor: ModelMonitorLike) => void;
  }): Promise<DetectorInstanceLike>;
}

export interface TranslationEnvironment {
  Translator?: TranslatorConstructorLike;
  LanguageDetector?: DetectorConstructorLike;
}

export interface TranslationCallbacks {
  onProgress?: (percent: number) => void;
}

export type TranslationErrorCode =
  | 'API_UNAVAILABLE'
  | 'PAIR_UNAVAILABLE'
  | 'ACTIVATION_REQUIRED'
  | 'DOWNLOAD_FAILED'
  | 'TRANSLATION_FAILED';

export class TranslationEngineError extends Error {
  constructor(public readonly code: TranslationErrorCode, message: string) {
    super(message);
    this.name = 'TranslationEngineError';
  }
}

function normalizeAvailability(value: AvailabilityValue): EngineAvailability {
  if (value === 'available' || value === 'readily') return 'available';
  if (value === 'downloadable' || value === 'after-download') return 'downloadable';
  if (value === 'downloading') return 'downloading';
  return 'unavailable';
}

function messageForCreationError(
  error: unknown,
  sourceLanguage: LanguageCode = 'en',
  targetLanguage: TargetLanguage = 'ru',
): TranslationEngineError {
  if (error instanceof TranslationEngineError) return error;
  const name = error instanceof DOMException ? error.name : '';
  if (name === 'NotAllowedError') {
    return new TranslationEngineError(
      'ACTIVATION_REQUIRED',
      'Chrome ждёт ваш клик, чтобы подготовить переводчик. Нажмите «Повторить».',
    );
  }
  if (name === 'NetworkError') {
    return new TranslationEngineError(
      'DOWNLOAD_FAILED',
      'Не удалось загрузить языковой пакет. Проверьте интернет и повторите.',
    );
  }
  if (name === 'NotSupportedError') {
    const source = languageDefinition(sourceLanguage).fromName;
    const target = languageDefinition(targetLanguage).toName;
    return new TranslationEngineError(
      'PAIR_UNAVAILABLE',
      `Перевод с ${source} на ${target} недоступен в этом Chrome.`,
    );
  }
  return new TranslationEngineError('TRANSLATION_FAILED', 'Не удалось выполнить перевод. Попробуйте ещё раз.');
}

export class ChromeTranslator {
  private readonly environment: TranslationEnvironment;
  private readonly translators = new Map<string, Promise<TranslatorInstanceLike>>();
  private detector?: Promise<DetectorInstanceLike>;

  constructor(
    environment: TranslationEnvironment = globalThis as unknown as TranslationEnvironment,
    private readonly creationTimeoutMs = 180_000,
  ) {
    this.environment = environment;
  }

  async getAvailability(sourceLanguage: LanguageCode, targetLanguage: TargetLanguage = sourceLanguage === 'ru' ? 'en' : 'ru'): Promise<EngineAvailability> {
    if (sourceLanguage === targetLanguage) return 'available';
    if (this.translators.has(`${sourceLanguage}-${targetLanguage}`)) return 'available';
    const api = this.environment.Translator;
    if (!api) return 'unavailable';
    try {
      return normalizeAvailability(await api.availability({ sourceLanguage, targetLanguage }));
    } catch {
      return 'unavailable';
    }
  }

  private withCreationTimeout<T>(creation: Promise<T>): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => reject(new TranslationEngineError(
        'DOWNLOAD_FAILED',
        'Подготовка переводчика заняла слишком много времени. Нажмите «Повторить».',
      )), this.creationTimeoutMs);
    });
    return Promise.race([creation, timeout]).finally(() => {
      if (timer !== undefined) clearTimeout(timer);
    });
  }

  private createTranslator(
    sourceLanguage: LanguageCode,
    targetLanguage: TargetLanguage,
    callbacks: TranslationCallbacks,
  ): Promise<TranslatorInstanceLike> {
    const api = this.environment.Translator;
    if (!api) {
      return Promise.reject(new TranslationEngineError(
        'API_UNAVAILABLE',
        'Встроенный переводчик недоступен. Нужен Google Chrome 138 или новее.',
      ));
    }

    const pair = `${sourceLanguage}-${targetLanguage}`;
    const cached = this.translators.get(pair);
    if (cached) return cached;

    // `create()` must start in the same task as the user's click. An awaited
    // availability probe here would consume Chrome's transient activation.
    let modelCreation: Promise<TranslatorInstanceLike>;
    try {
      modelCreation = api.create({
        sourceLanguage,
        targetLanguage,
        monitor(monitor) {
          monitor.addEventListener('downloadprogress', (event) => {
            callbacks.onProgress?.(Math.round(Math.max(0, Math.min(1, event.loaded)) * 100));
          });
        },
      });
    } catch (error) {
      return Promise.reject(messageForCreationError(error, sourceLanguage, targetLanguage));
    }
    const creation = this.withCreationTimeout(modelCreation).catch((error) => {
      this.translators.delete(pair);
      throw messageForCreationError(error, sourceLanguage, targetLanguage);
    });

    this.translators.set(pair, creation);
    return creation;
  }

  private createDetector(callbacks: TranslationCallbacks): Promise<DetectorInstanceLike> | undefined {
    const api = this.environment.LanguageDetector;
    if (!api) return undefined;
    if (this.detector) return this.detector;
    const modelCreation = api.create({
      expectedInputLanguages: [...LANGUAGE_CODES],
      monitor(monitor) {
        monitor.addEventListener('downloadprogress', (event) => {
          callbacks.onProgress?.(Math.round(Math.max(0, Math.min(1, event.loaded)) * 100));
        });
      },
    });
    this.detector = this.withCreationTimeout(modelCreation).catch((error) => {
      this.detector = undefined;
      throw error;
    });
    return this.detector;
  }

  async prepare(sourceLanguage: LanguageCode = 'en', callbacks: TranslationCallbacks = {}, targetLanguage: TargetLanguage = sourceLanguage === 'ru' ? 'en' : 'ru'): Promise<void> {
    if (sourceLanguage !== targetLanguage) await this.createTranslator(sourceLanguage, targetLanguage, callbacks);
  }

  async prepareForMode(sourceMode: SourceMode, callbacks: TranslationCallbacks = {}, targetLanguage?: TargetLanguage): Promise<void> {
    if (sourceMode === 'auto') {
      const detector = this.createDetector(callbacks);
      if (!detector) return;
      try {
        await detector;
      } catch (error) {
        throw messageForCreationError(error);
      }
      return;
    }
    try {
      if (sourceMode !== targetLanguage) {
        await this.createTranslator(
          sourceMode,
          targetLanguage ?? (sourceMode === 'ru' ? 'en' : 'ru'),
          callbacks,
        );
      }
    } catch (error) {
      throw messageForCreationError(error, sourceMode, targetLanguage ?? (sourceMode === 'ru' ? 'en' : 'ru'));
    }
  }

  async prepareForPageTarget(_targetLanguage: PageTargetLanguage, callbacks: TranslationCallbacks = {}): Promise<void> {
    // Page translation does not know its source languages before inspecting text.
    // Start only the detector here; creating every possible pair would download and
    // retain dozens of models. A downloadable pair is requested by a later click.
    const detector = this.createDetector(callbacks);
    if (detector) void detector.catch(() => undefined);
  }

  async translatePageText(text: string, targetLanguage: PageTargetLanguage, callbacks: TranslationCallbacks = {}): Promise<string> {
    const original = text.trim();
    if (!original) return original;
    const sourceLanguage = await this.detectSourceLanguage(original, callbacks);
    if (sourceLanguage === targetLanguage) return original;
    try {
      const translator = await this.createTranslator(sourceLanguage, targetLanguage, callbacks);
      const translation = (await translator.translate(original)).trim();
      if (!translation) throw new Error('Empty translation');
      return translation;
    } catch (error) {
      throw messageForCreationError(error, sourceLanguage, targetLanguage);
    }
  }

  async detectSourceLanguage(text: string, callbacks: TranslationCallbacks = {}): Promise<LanguageCode> {
    const hasLatin = /[a-z]/i.test(text);
    const hasCyrillic = /\p{Script=Cyrillic}/u.test(text);
    if (hasCyrillic && !hasLatin && /[іїєґ]/i.test(text)) return 'uk';
    if (text.length < 8) return hasCyrillic ? 'ru' : 'en';
    const detectorPromise = this.createDetector(callbacks);
    if (!detectorPromise) return hasCyrillic ? 'ru' : 'en';
    try {
      const detector = await detectorPromise;
      const [best] = await detector.detect(text);
      if (!best || best.confidence < 0.65 || best.detectedLanguage === 'und') {
        return hasCyrillic ? 'ru' : 'en';
      }
      return LANGUAGE_CODES.includes(best.detectedLanguage as LanguageCode)
        ? best.detectedLanguage as LanguageCode
        : hasCyrillic ? 'ru' : 'en';
    } catch {
      return hasCyrillic ? 'ru' : 'en';
    }
  }

  async translate(
    text: string,
    sourceMode: SourceMode,
    callbacks: TranslationCallbacks = {},
    targetLanguage?: TargetLanguage,
  ): Promise<TranslationResult> {
    const original = text.trim();
    if (!original) {
      throw new TranslationEngineError('TRANSLATION_FAILED', 'Введите текст для перевода.');
    }
    if (!this.environment.Translator) {
      throw new TranslationEngineError(
        'API_UNAVAILABLE',
        'Встроенный переводчик недоступен. Нужен Google Chrome 138 или новее.',
      );
    }

    let sourceLanguage: LanguageCode | undefined;
    let resolvedTarget: TargetLanguage | undefined;
    try {
      sourceLanguage = sourceMode === 'auto'
        ? await this.detectSourceLanguage(original, callbacks)
        : sourceMode;
      resolvedTarget = targetLanguage ?? (sourceLanguage === 'ru' ? 'en' : 'ru');
      if (sourceLanguage === resolvedTarget) {
        return { original, translation: original, sourceLanguage, targetLanguage: resolvedTarget, alreadyTarget: true };
      }
      const translator = await this.createTranslator(sourceLanguage, resolvedTarget, callbacks);
      const translation = (await translator.translate(original)).trim();
      if (!translation) throw new Error('Empty translation');
      return { original, translation, sourceLanguage, targetLanguage: resolvedTarget, alreadyTarget: false };
    } catch (error) {
      throw messageForCreationError(error, sourceLanguage, resolvedTarget);
    }
  }

  destroy(): void {
    for (const translator of this.translators.values()) {
      void translator.then((instance) => instance.destroy?.()).catch(() => undefined);
    }
    this.translators.clear();
    void this.detector?.then((instance) => instance.destroy?.()).catch(() => undefined);
    this.detector = undefined;
  }
}
