import type { EngineAvailability, SourceMode, TranslationResult } from '../shared/types';

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

function messageForCreationError(error: unknown): TranslationEngineError {
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
    return new TranslationEngineError(
      'PAIR_UNAVAILABLE',
      'Перевод с английского на русский недоступен в этом Chrome.',
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

  async getAvailability(sourceLanguage: string): Promise<EngineAvailability> {
    const api = this.environment.Translator;
    if (!api) return 'unavailable';
    try {
      return normalizeAvailability(await api.availability({ sourceLanguage, targetLanguage: 'ru' }));
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

  private createTranslator(sourceLanguage: string, callbacks: TranslationCallbacks): Promise<TranslatorInstanceLike> {
    const api = this.environment.Translator;
    if (!api) {
      return Promise.reject(new TranslationEngineError(
        'API_UNAVAILABLE',
        'Встроенный переводчик недоступен. Нужен Google Chrome 138 или новее.',
      ));
    }

    const cached = this.translators.get(sourceLanguage);
    if (cached) return cached;

    // `create()` must start in the same task as the user's click. An awaited
    // availability probe here would consume Chrome's transient activation.
    const modelCreation = api.create({
      sourceLanguage,
      targetLanguage: 'ru',
      monitor(monitor) {
        monitor.addEventListener('downloadprogress', (event) => {
          callbacks.onProgress?.(Math.round(Math.max(0, Math.min(1, event.loaded)) * 100));
        });
      },
    });
    const creation = this.withCreationTimeout(modelCreation).catch((error) => {
      this.translators.delete(sourceLanguage);
      throw messageForCreationError(error);
    });

    this.translators.set(sourceLanguage, creation);
    return creation;
  }

  private createDetector(callbacks: TranslationCallbacks): Promise<DetectorInstanceLike> | undefined {
    const api = this.environment.LanguageDetector;
    if (!api) return undefined;
    if (this.detector) return this.detector;
    const modelCreation = api.create({
      expectedInputLanguages: ['en', 'ru'],
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

  async prepare(sourceLanguage = 'en', callbacks: TranslationCallbacks = {}): Promise<void> {
    await this.createTranslator(sourceLanguage, callbacks);
  }

  async prepareForMode(sourceMode: SourceMode, callbacks: TranslationCallbacks = {}): Promise<void> {
    // Both create calls happen before the first await, while transient user
    // activation from the button click is still available.
    const preparations: Array<Promise<unknown>> = [this.createTranslator('en', callbacks)];
    if (sourceMode === 'auto') {
      const detector = this.createDetector(callbacks);
      if (detector) preparations.push(detector);
    }
    try {
      await Promise.all(preparations);
    } catch (error) {
      throw messageForCreationError(error);
    }
  }

  private async detectSource(text: string, callbacks: TranslationCallbacks): Promise<string> {
    if (text.length < 8) return 'en';
    const detectorPromise = this.createDetector(callbacks);
    if (!detectorPromise) return 'en';
    try {
      const detector = await detectorPromise;
      const [best] = await detector.detect(text);
      if (!best || best.confidence < 0.65 || best.detectedLanguage === 'und') return 'en';
      return best.detectedLanguage;
    } catch {
      return 'en';
    }
  }

  async translate(
    text: string,
    sourceMode: SourceMode,
    callbacks: TranslationCallbacks = {},
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

    try {
      const sourceLanguage = sourceMode === 'auto'
        ? await this.detectSource(original, callbacks)
        : 'en';
      if (sourceLanguage === 'ru') {
        return { original, translation: original, sourceLanguage, targetLanguage: 'ru', alreadyRussian: true };
      }
      const translator = await this.createTranslator(sourceLanguage, callbacks);
      const translation = (await translator.translate(original)).trim();
      if (!translation) throw new Error('Empty translation');
      return { original, translation, sourceLanguage, targetLanguage: 'ru', alreadyRussian: false };
    } catch (error) {
      throw messageForCreationError(error);
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
