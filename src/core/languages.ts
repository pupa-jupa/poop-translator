import type { LanguageCode, OcrLanguage, OcrMode, SourceMode, TargetLanguage } from '../shared/types';

export interface TranslationLanguageDefinition {
  code: LanguageCode;
  name: string;
  fromName: string;
  toName: string;
}

export interface OcrLanguageDefinition {
  code: OcrLanguage;
  name: string;
}

export type LanguageDefinition = TranslationLanguageDefinition;

export const TRANSLATION_LANGUAGES: readonly TranslationLanguageDefinition[] = [
  { code: 'en', name: 'Английский', fromName: 'английского', toName: 'английский' },
  { code: 'ru', name: 'Русский', fromName: 'русского', toName: 'русский' },
  { code: 'uk', name: 'Украинский', fromName: 'украинского', toName: 'украинский' },
  { code: 'de', name: 'Немецкий', fromName: 'немецкого', toName: 'немецкий' },
  { code: 'fr', name: 'Французский', fromName: 'французского', toName: 'французский' },
  { code: 'es', name: 'Испанский', fromName: 'испанского', toName: 'испанский' },
  { code: 'ja', name: 'Японский', fromName: 'японского', toName: 'японский' },
  { code: 'ko', name: 'Корейский', fromName: 'корейского', toName: 'корейский' },
  { code: 'zh', name: 'Китайский (упрощённый)', fromName: 'упрощённого китайского', toName: 'упрощённый китайский' },
  { code: 'zh-Hant', name: 'Китайский (традиционный)', fromName: 'традиционного китайского', toName: 'традиционный китайский' },
  { code: 'ar', name: 'Арабский', fromName: 'арабского', toName: 'арабский' },
  { code: 'bg', name: 'Болгарский', fromName: 'болгарского', toName: 'болгарский' },
  { code: 'bn', name: 'Бенгальский', fromName: 'бенгальского', toName: 'бенгальский' },
  { code: 'cs', name: 'Чешский', fromName: 'чешского', toName: 'чешский' },
  { code: 'da', name: 'Датский', fromName: 'датского', toName: 'датский' },
  { code: 'el', name: 'Греческий', fromName: 'греческого', toName: 'греческий' },
  { code: 'fi', name: 'Финский', fromName: 'финского', toName: 'финский' },
  { code: 'he', name: 'Иврит', fromName: 'иврита', toName: 'иврит' },
  { code: 'hi', name: 'Хинди', fromName: 'хинди', toName: 'хинди' },
  { code: 'hr', name: 'Хорватский', fromName: 'хорватского', toName: 'хорватский' },
  { code: 'hu', name: 'Венгерский', fromName: 'венгерского', toName: 'венгерский' },
  { code: 'id', name: 'Индонезийский', fromName: 'индонезийского', toName: 'индонезийский' },
  { code: 'it', name: 'Итальянский', fromName: 'итальянского', toName: 'итальянский' },
  { code: 'kn', name: 'Каннада', fromName: 'каннада', toName: 'каннада' },
  { code: 'lt', name: 'Литовский', fromName: 'литовского', toName: 'литовский' },
  { code: 'mr', name: 'Маратхи', fromName: 'маратхи', toName: 'маратхи' },
  { code: 'nl', name: 'Нидерландский', fromName: 'нидерландского', toName: 'нидерландский' },
  { code: 'no', name: 'Норвежский', fromName: 'норвежского', toName: 'норвежский' },
  { code: 'pl', name: 'Польский', fromName: 'польского', toName: 'польский' },
  { code: 'pt', name: 'Португальский', fromName: 'португальского', toName: 'португальский' },
  { code: 'ro', name: 'Румынский', fromName: 'румынского', toName: 'румынский' },
  { code: 'sk', name: 'Словацкий', fromName: 'словацкого', toName: 'словацкий' },
  { code: 'sl', name: 'Словенский', fromName: 'словенского', toName: 'словенский' },
  { code: 'sv', name: 'Шведский', fromName: 'шведского', toName: 'шведский' },
  { code: 'ta', name: 'Тамильский', fromName: 'тамильского', toName: 'тамильский' },
  { code: 'te', name: 'Телугу', fromName: 'телугу', toName: 'телугу' },
  { code: 'th', name: 'Тайский', fromName: 'тайского', toName: 'тайский' },
  { code: 'tr', name: 'Турецкий', fromName: 'турецкого', toName: 'турецкий' },
  { code: 'vi', name: 'Вьетнамский', fromName: 'вьетнамского', toName: 'вьетнамский' },
] as const;

export const LANGUAGES = TRANSLATION_LANGUAGES;
export const LANGUAGE_CODES: readonly LanguageCode[] = TRANSLATION_LANGUAGES.map((language) => language.code);
export const OCR_LANGUAGES: readonly OcrLanguageDefinition[] = [
  { code: 'eng', name: 'Английский' },
  { code: 'rus', name: 'Русский' },
  { code: 'ukr', name: 'Украинский' },
  { code: 'deu', name: 'Немецкий' },
  { code: 'fra', name: 'Французский' },
  { code: 'spa', name: 'Испанский' },
  { code: 'jpn', name: 'Японский' },
  { code: 'kor', name: 'Корейский' },
  { code: 'chi_sim', name: 'Китайский (упрощённый)' },
  { code: 'chi_tra', name: 'Китайский (традиционный)' },
] as const;
export const OCR_LANGUAGE_CODES: readonly OcrLanguage[] = OCR_LANGUAGES.map(({ code }) => code);

const OCR_BY_TRANSLATION_LANGUAGE: Partial<Record<LanguageCode, OcrLanguage>> = {
  en: 'eng', ru: 'rus', uk: 'ukr', de: 'deu', fr: 'fra', es: 'spa',
  ja: 'jpn', ko: 'kor', zh: 'chi_sim', 'zh-Hant': 'chi_tra',
};

export function isLanguageCode(value: unknown): value is LanguageCode {
  return typeof value === 'string' && LANGUAGE_CODES.includes(value as LanguageCode);
}

export function isSourceMode(value: unknown): value is SourceMode {
  return value === 'auto' || isLanguageCode(value);
}

export function isTargetLanguage(value: unknown): value is TargetLanguage {
  return isLanguageCode(value);
}

export function isOcrLanguage(value: unknown): value is OcrLanguage {
  return typeof value === 'string' && OCR_LANGUAGE_CODES.includes(value as OcrLanguage);
}

export function isOcrMode(value: unknown): value is OcrMode {
  return value === 'auto' || isOcrLanguage(value);
}

export function languageDefinition(code: LanguageCode): TranslationLanguageDefinition {
  const definition = TRANSLATION_LANGUAGES.find((language) => language.code === code);
  if (!definition) throw new Error(`Unsupported language: ${code}`);
  return definition;
}

export function ocrLanguageForTranslationLanguage(language: LanguageCode): OcrLanguage | undefined {
  return OCR_BY_TRANSLATION_LANGUAGE[language];
}

export function ocrLanguagesForMode(mode: OcrMode): OcrLanguage[] {
  if (mode === 'auto') return ['eng', 'rus'];
  return [mode];
}

export function sourceCandidates(target: TargetLanguage): LanguageCode[] {
  return LANGUAGE_CODES.filter((code) => code !== target);
}
