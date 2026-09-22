import { describe, expect, it, vi } from 'vitest';
import { detectDocumentSource, documentLanguageSamples, prepareDocumentPair, shouldTranslateDocumentPart } from '../src/core/document-language';

describe('document language', () => {
  it('samples large documents across their full length', () => {
    const samples = documentLanguageSamples(Array.from({ length: 30 }, (_value, index) => `Page ${index} ${'text '.repeat(10)}`));
    expect(samples).toHaveLength(12);
    expect(samples[0]).toContain('Page 0');
    expect(samples.at(-1)).toContain('Page 29');
  });

  it('chooses one source and requires explicit selection for a mixed document', async () => {
    const detector = { detectSourceLanguage: vi.fn(async (text: string) => text.includes('日本語') && !text.includes('English') ? 'ja' as const : 'en' as const) };
    await expect(detectDocumentSource(detector as never, [
      `English ${'text '.repeat(20)}`,
      `日本語 ${'文章 '.repeat(20)}`,
    ], 'ru')).rejects.toThrow('Выберите исходный язык явно');
  });

  it('keeps target-language fragments and rejects extra source pairs in auto mode', async () => {
    const detector = { detectSourceLanguage: vi.fn(async (text: string) => text.includes('Привет') ? 'ru' as const : text.includes('日本語') ? 'ja' as const : 'en' as const) };
    await expect(shouldTranslateDocumentPart(detector as never, 'Привет мир', 'en', 'ru', true)).resolves.toBe(false);
    await expect(shouldTranslateDocumentPart(detector as never, `日本語 ${'文章 '.repeat(15)}`, 'en', 'ru', true))
      .rejects.toThrow('Выберите исходный язык явно');
    await expect(shouldTranslateDocumentPart(detector as never, 'English paragraph', 'en', 'ru', true)).resolves.toBe(true);
  });

  it('prepares only the detected pair after a second gesture when a download is needed', async () => {
    const engine = { getAvailability: vi.fn(async () => 'downloadable'), prepare: vi.fn(async () => undefined) };
    const attempt = await prepareDocumentPair(engine as never, 'ja', 'ru');
    expect(engine.prepare).not.toHaveBeenCalled();
    await attempt?.activate();
    expect(engine.prepare).toHaveBeenCalledExactlyOnceWith('ja', {}, 'ru');
  });
});
