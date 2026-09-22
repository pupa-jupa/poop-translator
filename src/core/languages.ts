import type { LanguageCode, OcrLanguage, SourceMode, TargetLanguage } from '../shared/types';

export interface LanguageDefinition {
  code: LanguageCode;
  ocr: OcrLanguage;
  name: string;
  fromName: string;
  toName: string;
}

export const LANGUAGES: readonly LanguageDefinition[] = [
  { code: 'en', ocr: 'eng', name: 'Английский', fromName: 'английского', toName: 'английский' },
  { code: 'ru', ocr: 'rus', name: 'Русский', fromName: 'русского', toName: 'русский' },
  { code: 'uk', ocr: 'ukr', name: 'Украинский', fromName: 'украинского', toName: 'украинский' },
  { code: 'de', ocr: 'deu', name: 'Немецкий', fromName: 'немецкого', toName: 'немецкий' },
  { code: 'fr', ocr: 'fra', name: 'Французский', fromName: 'французского', toName: 'французский' },
  { code: 'es', ocr: 'spa', name: 'Испанский', fromName: 'испанского', toName: 'испанский' },
] as const;

export const LANGUAGE_CODES = LANGUAGES.map((language) => language.code);
export const OCR_LANGUAGE_CODES = LANGUAGES.map((language) => language.ocr);

export function isLanguageCode(value: unknown): value is LanguageCode {
  return typeof value === 'string' && LANGUAGE_CODES.includes(value as LanguageCode);
}

export function isSourceMode(value: unknown): value is SourceMode {
  return value === 'auto' || isLanguageCode(value);
}

export function isTargetLanguage(value: unknown): value is TargetLanguage {
  return value === 'en' || value === 'ru';
}

export function isOcrLanguage(value: unknown): value is OcrLanguage {
  return typeof value === 'string' && OCR_LANGUAGE_CODES.includes(value as OcrLanguage);
}

export function languageDefinition(code: LanguageCode): LanguageDefinition {
  return LANGUAGES.find((language) => language.code === code)!;
}

export function ocrLanguagesForMode(mode: SourceMode): OcrLanguage[] {
  if (mode === 'auto') return ['eng', 'rus'];
  return [languageDefinition(mode).ocr];
}

export function sourceCandidates(target: TargetLanguage): LanguageCode[] {
  return LANGUAGE_CODES.filter((code) => code !== target);
}
