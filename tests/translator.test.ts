import { describe, expect, it, vi } from 'vitest';
import { ChromeTranslator, TranslationEngineError } from '../src/core/translator';
import { translateFromUserActivation } from '../src/core/user-activated-translation';

function fakeTranslatorApi(options?: { availability?: string; translated?: string }) {
  return {
    availability: vi.fn(async () => options?.availability ?? 'available'),
    create: vi.fn(async ({ monitor }: {
      monitor?: (value: { addEventListener: (type: string, listener: (event: Event & { loaded: number }) => void) => void }) => void;
    }) => {
      let progressListener: ((event: Event & { loaded: number }) => void) | undefined;
      monitor?.({ addEventListener: (_type, listener) => { progressListener = listener; } });
      progressListener?.(Object.assign(new Event('downloadprogress'), { loaded: 1 }));
      return {
        translate: vi.fn(async () => options?.translated ?? 'Привет'),
        destroy: vi.fn(),
      };
    }),
  };
}

describe('ChromeTranslator', () => {
  it('reports a clear unsupported error when the browser API is absent', async () => {
    const engine = new ChromeTranslator({});

    await expect(engine.translate('Hello', 'en')).rejects.toMatchObject({
      code: 'API_UNAVAILABLE',
      message: 'Встроенный переводчик недоступен. Нужен Google Chrome 138 или новее.',
    });
  });

  it('normalizes a downloadable model status and emits download progress', async () => {
    const api = fakeTranslatorApi({ availability: 'downloadable' });
    const engine = new ChromeTranslator({ Translator: api });
    const progress: number[] = [];

    expect(await engine.getAvailability('en')).toBe('downloadable');
    const result = await engine.translate('Hello', 'en', { onProgress: (value) => progress.push(value) });

    expect(result.translation).toBe('Привет');
    expect(progress).toEqual([100]);
  });

  it('starts model creation without awaiting an availability probe', async () => {
    let releaseAvailability: (() => void) | undefined;
    const api = fakeTranslatorApi();
    api.availability.mockImplementation(() => new Promise<string>((resolve) => {
      releaseAvailability = () => resolve('available');
    }));
    const engine = new ChromeTranslator({ Translator: api });

    const pending = engine.translate('Hello', 'en');
    expect(api.create).toHaveBeenCalledOnce();
    expect(api.availability).not.toHaveBeenCalled();
    releaseAvailability?.();
    await pending;
  });

  it('prepares and reuses a translator for long-lived page work', async () => {
    const api = fakeTranslatorApi();
    const engine = new ChromeTranslator({ Translator: api });

    await engine.prepare('en');
    await engine.translate('Hello again', 'en');

    expect(api.create).toHaveBeenCalledOnce();
  });

  it('starts language detection synchronously when preparing auto mode', async () => {
    const translatorApi = fakeTranslatorApi();
    const detectorApi = {
      availability: vi.fn(async () => 'downloadable'),
      create: vi.fn(async () => ({ detect: vi.fn(), destroy: vi.fn() })),
    };
    const engine = new ChromeTranslator({ Translator: translatorApi, LanguageDetector: detectorApi });

    const preparation = engine.prepareForMode('auto');
    expect(translatorApi.create).toHaveBeenCalledTimes(2);
    expect(detectorApi.create).toHaveBeenCalledOnce();
    await preparation;
  });

  it('prepares only the pair towards the page target, with detector in the click task', async () => {
    const translatorApi = fakeTranslatorApi();
    const detectorApi = {
      availability: vi.fn(async () => 'available'),
      create: vi.fn(async () => ({ detect: vi.fn(), destroy: vi.fn() })),
    };
    const engine = new ChromeTranslator({ Translator: translatorApi, LanguageDetector: detectorApi });
    const pending = engine.prepareForPageTarget('en');
    expect(translatorApi.create).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
      sourceLanguage: 'ru', targetLanguage: 'en',
    }));
    expect(detectorApi.create).toHaveBeenCalledOnce();
    await pending;
  });

  it('does not wait for a downloading detector when the page translator is ready', async () => {
    const translatorApi = fakeTranslatorApi();
    const detectorApi = {
      availability: vi.fn(async () => 'downloadable'),
      create: vi.fn(() => new Promise<never>(() => undefined)),
    };
    const engine = new ChromeTranslator({ Translator: translatorApi, LanguageDetector: detectorApi }, 1_000);
    await expect(engine.prepareForPageTarget('ru')).resolves.toBeUndefined();
    expect(detectorApi.create).toHaveBeenCalledOnce();
    engine.destroy();
  });

  it('leaves text already on the page target unchanged without creating a reverse pair', async () => {
    const api = fakeTranslatorApi({ translated: 'Hello' });
    const engine = new ChromeTranslator({ Translator: api });
    await engine.prepareForPageTarget('en');
    expect(await engine.translatePageText('Hello there', 'en')).toBe('Hello there');
    expect(await engine.translatePageText('Привет мир', 'en')).toBe('Hello');
    expect(api.create).toHaveBeenCalledOnce();
  });

  it('translates Russian to English with the reverse language pair', async () => {
    const api = fakeTranslatorApi({ translated: 'Good afternoon' });
    const engine = new ChromeTranslator({ Translator: api });

    const result = await engine.translate('Добрый день', 'ru');

    expect(result).toMatchObject({
      translation: 'Good afternoon',
      sourceLanguage: 'ru',
      targetLanguage: 'en',
    });
    expect(api.create).toHaveBeenCalledWith(expect.objectContaining({
      sourceLanguage: 'ru',
      targetLanguage: 'en',
    }));
  });

  it('starts both translation directions and detection during the selection click', async () => {
    const releaseTranslators: Array<() => void> = [];
    let releaseDetector: (() => void) | undefined;
    const translated = vi.fn(async () => 'Длинное английское предложение');
    const detected = vi.fn(async () => [{ detectedLanguage: 'en', confidence: 0.99 }]);
    const translatorApi = {
      availability: vi.fn(async () => 'downloadable'),
      create: vi.fn(() => new Promise<{ translate: typeof translated; destroy: () => void }>((resolve) => {
        releaseTranslators.push(() => resolve({ translate: translated, destroy: () => undefined }));
      })),
    };
    const detectorApi = {
      availability: vi.fn(async () => 'downloadable'),
      create: vi.fn(() => new Promise<{ detect: typeof detected; destroy: () => void }>((resolve) => {
        releaseDetector = () => resolve({ detect: detected, destroy: () => undefined });
      })),
    };
    const engine = new ChromeTranslator({ Translator: translatorApi, LanguageDetector: detectorApi });

    const pending = translateFromUserActivation(
      engine,
      'A long English sentence selected on the page.',
      'auto',
    );

    expect(translatorApi.create).toHaveBeenCalledTimes(2);
    expect(detectorApi.create).toHaveBeenCalledOnce();
    expect(detected).not.toHaveBeenCalled();
    releaseTranslators.forEach((release) => release());
    releaseDetector?.();

    await expect(pending).resolves.toMatchObject({
      translation: 'Длинное английское предложение',
      sourceLanguage: 'en',
    });
  });

  it('translates confidently detected Russian text to English in auto mode', async () => {
    const translatorApi = fakeTranslatorApi({ translated: 'Good afternoon' });
    const detectorApi = {
      availability: vi.fn(async () => 'available'),
      create: vi.fn(async () => ({
        detect: vi.fn(async () => [{ detectedLanguage: 'ru', confidence: 0.97 }]),
        destroy: vi.fn(),
      })),
    };
    const engine = new ChromeTranslator({ Translator: translatorApi, LanguageDetector: detectorApi });

    const result = await engine.translate('Добрый день', 'auto');

    expect(result).toMatchObject({
      translation: 'Good afternoon',
      sourceLanguage: 'ru',
      targetLanguage: 'en',
      alreadyRussian: false,
    });
    expect(translatorApi.create).toHaveBeenCalledWith(expect.objectContaining({
      sourceLanguage: 'ru',
      targetLanguage: 'en',
    }));
  });

  it('falls back to English for a short word instead of unreliable detection', async () => {
    const translatorApi = fakeTranslatorApi();
    const detectorApi = { availability: vi.fn(), create: vi.fn() };
    const engine = new ChromeTranslator({ Translator: translatorApi, LanguageDetector: detectorApi });

    const result = await engine.translate('cat', 'auto');

    expect(result.sourceLanguage).toBe('en');
    expect(detectorApi.create).not.toHaveBeenCalled();
  });

  it('recognizes a short Russian word by its script without language detector', async () => {
    const translatorApi = fakeTranslatorApi({ translated: 'cat' });
    const detectorApi = { availability: vi.fn(), create: vi.fn() };
    const engine = new ChromeTranslator({ Translator: translatorApi, LanguageDetector: detectorApi });

    const result = await engine.translate('кот', 'auto');

    expect(result).toMatchObject({ translation: 'cat', sourceLanguage: 'ru', targetLanguage: 'en' });
    expect(detectorApi.create).not.toHaveBeenCalled();
  });

  it('maps unsupported language pairs to a stable error code', async () => {
    const api = fakeTranslatorApi();
    api.create.mockRejectedValue(new DOMException('Unsupported', 'NotSupportedError'));
    const engine = new ChromeTranslator({ Translator: api });

    await expect(engine.translate('Hello', 'en')).rejects.toEqual(
      new TranslationEngineError('PAIR_UNAVAILABLE', 'Перевод с английского на русский недоступен в этом Chrome.'),
    );
  });

  it('stops a model preparation that never settles', async () => {
    vi.useFakeTimers();
    try {
      const api = fakeTranslatorApi();
      api.create.mockImplementation(() => new Promise(() => undefined));
      const engine = new ChromeTranslator({ Translator: api }, 1_000);

      const preparation = engine.prepare('en');
      const rejection = expect(preparation).rejects.toMatchObject({
        code: 'DOWNLOAD_FAILED',
        message: 'Подготовка переводчика заняла слишком много времени. Нажмите «Повторить».',
      });
      await vi.advanceTimersByTimeAsync(1_000);
      await rejection;
    } finally {
      vi.useRealTimers();
    }
  });

  it('times out a detector download that never settles', async () => {
    vi.useFakeTimers();
    try {
      const translatorApi = fakeTranslatorApi();
      const detectorApi = {
        availability: vi.fn(async () => 'downloadable'),
        create: vi.fn(() => new Promise<never>(() => undefined)),
      };
      const engine = new ChromeTranslator({ Translator: translatorApi, LanguageDetector: detectorApi }, 1_000);

      const preparation = engine.prepareForMode('auto');
      const rejection = expect(preparation).rejects.toMatchObject({ code: 'DOWNLOAD_FAILED' });
      await vi.advanceTimersByTimeAsync(1_000);
      await rejection;
    } finally {
      vi.useRealTimers();
    }
  });
});
