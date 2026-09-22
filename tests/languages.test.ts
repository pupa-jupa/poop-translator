import { describe, expect, it } from 'vitest';
import {
  LANGUAGE_CODES,
  TRANSLATION_LANGUAGES,
  isLanguageCode,
  isSourceMode,
  isTargetLanguage,
  languageDefinition,
  OCR_LANGUAGE_CODES,
  ocrLanguageForTranslationLanguage,
  ocrLanguagesForMode,
  sourceCandidates,
} from '../src/core/languages';

describe('translation language catalog', () => {
  it('contains every declared Chrome language exactly once', () => {
    expect(LANGUAGE_CODES).toHaveLength(39);
    expect(new Set(LANGUAGE_CODES).size).toBe(39);
    expect(LANGUAGE_CODES).toEqual(expect.arrayContaining([
      'en', 'ru', 'fr', 'ja', 'ko', 'zh', 'zh-Hant',
    ]));
    expect(TRANSLATION_LANGUAGES.every(({ name }) => name.length > 0)).toBe(true);
  });

  it('maps explicitly selected CJK OCR models without broad auto loading', () => {
    expect(OCR_LANGUAGE_CODES).toEqual(expect.arrayContaining(['jpn', 'kor', 'chi_sim', 'chi_tra']));
    expect(ocrLanguageForTranslationLanguage('ja')).toBe('jpn');
    expect(ocrLanguageForTranslationLanguage('ko')).toBe('kor');
    expect(ocrLanguageForTranslationLanguage('zh')).toBe('chi_sim');
    expect(ocrLanguageForTranslationLanguage('zh-Hant')).toBe('chi_tra');
    expect(ocrLanguagesForMode('auto')).toEqual(['eng', 'rus']);
    expect(ocrLanguagesForMode('jpn')).toEqual(['jpn']);
  });

  it('validates source and target codes from the same catalog', () => {
    expect(isLanguageCode('ko')).toBe(true);
    expect(isTargetLanguage('ja')).toBe(true);
    expect(isSourceMode('auto')).toBe(true);
    expect(isLanguageCode('xx')).toBe(false);
    expect(isTargetLanguage('xx')).toBe(false);
  });

  it('provides Russian labels and excludes the selected target from candidates', () => {
    expect(languageDefinition('zh-Hant').name).toBe('Китайский (традиционный)');
    expect(sourceCandidates('ja')).not.toContain('ja');
    expect(sourceCandidates('ja')).toContain('ko');
  });
});
