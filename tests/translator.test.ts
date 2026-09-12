import { describe, expect, it, vi } from 'vitest';
import { ChromeTranslator, TranslationEngineError } from '../src/core/translator';

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

  it('returns Russian text unchanged when auto detection is confident', async () => {
    const translatorApi = fakeTranslatorApi();
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
      translation: 'Добрый день',
      sourceLanguage: 'ru',
      alreadyRussian: true,
    });
    expect(translatorApi.create).not.toHaveBeenCalled();
  });

  it('falls back to English for a short word instead of unreliable detection', async () => {
    const translatorApi = fakeTranslatorApi();
    const detectorApi = { availability: vi.fn(), create: vi.fn() };
    const engine = new ChromeTranslator({ Translator: translatorApi, LanguageDetector: detectorApi });

    const result = await engine.translate('cat', 'auto');

    expect(result.sourceLanguage).toBe('en');
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
});
