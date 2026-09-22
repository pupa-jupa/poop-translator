import type { OcrLanguage, OcrRecognitionResult, PageTargetLanguage, RegionRect, SourceMode, TargetLanguage, TranslationSource } from './types';
import { isOcrLanguage, isSourceMode, isTargetLanguage } from '../core/languages';

export type PageOperationState = 'idle' | 'awaiting-activation' | 'translating' | 'translated' | 'error';

export interface PageStatus {
  state: PageOperationState;
  completed: number;
  total: number;
  error?: string;
}

export type ContentRequest =
  | { type: 'SHOW_SELECTION_TRANSLATOR'; requestId: string; text: string; source: Extract<TranslationSource, 'context-menu'>; sourceMode: SourceMode; targetLanguage: TargetLanguage }
  | { type: 'START_REGION_SELECTION'; requestId: string }
  | { type: 'REGION_OCR_STARTED'; requestId: string }
  | { type: 'TRANSLATE_PAGE'; requestId: string; targetLanguage: PageTargetLanguage; sourceMode?: SourceMode }
  | { type: 'RESTORE_PAGE'; requestId: string }
  | { type: 'GET_PAGE_STATUS'; requestId: string };

export interface DictionaryLookupRequest {
  type: 'LOOKUP_DICTIONARY';
  requestId: string;
  text: string;
  sourceLanguage: 'en' | 'ru';
}

export interface RuntimeResponse<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
}

export interface RegionCaptureRequest {
  type: 'CAPTURE_REGION';
  requestId: string;
  region: RegionRect;
  languages: OcrLanguage[];
}

export interface OcrRecognitionRequest {
  target: 'offscreen';
  type: 'OCR_RECOGNIZE';
  requestId: string;
  imageDataUrl: string;
  region: RegionRect;
  languages: OcrLanguage[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasRequestId(value: Record<string, unknown>): boolean {
  return typeof value.requestId === 'string' && value.requestId.startsWith('pt-');
}

export function isContentRequest(value: unknown): value is ContentRequest {
  if (!isRecord(value) || !hasRequestId(value) || typeof value.type !== 'string') return false;
  switch (value.type) {
    case 'SHOW_SELECTION_TRANSLATOR':
      return typeof value.text === 'string'
        && value.text.trim().length > 0
        && value.source === 'context-menu'
        && isSourceMode(value.sourceMode)
        && isTargetLanguage(value.targetLanguage);
    case 'TRANSLATE_PAGE':
      return isTargetLanguage(value.targetLanguage)
        && (value.sourceMode === undefined || isSourceMode(value.sourceMode));
    case 'START_REGION_SELECTION':
    case 'REGION_OCR_STARTED':
    case 'RESTORE_PAGE':
    case 'GET_PAGE_STATUS':
      return true;
    default:
      return false;
  }
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export function isRegionCaptureRequest(value: unknown): value is RegionCaptureRequest {
  return isRecord(value)
    && hasRequestId(value)
    && value.type === 'CAPTURE_REGION'
    && isRegionPayload(value.region, value.languages);
}

function isRegionPayload(regionValue: unknown, languagesValue: unknown): boolean {
  if (!isRecord(regionValue)) return false;
  const region = regionValue;
  const numericKeys = ['left', 'top', 'width', 'height', 'viewportWidth', 'viewportHeight'] as const;
  if (!numericKeys.every((key) => isFiniteNumber(region[key]))) return false;
  if ((region.left as number) < 0 || (region.top as number) < 0
    || (region.width as number) < 12 || (region.height as number) < 12
    || (region.viewportWidth as number) <= 0 || (region.viewportHeight as number) <= 0
    || (region.left as number) + (region.width as number) > (region.viewportWidth as number)
    || (region.top as number) + (region.height as number) > (region.viewportHeight as number)) return false;
  if (!Array.isArray(languagesValue) || languagesValue.length < 1 || languagesValue.length > 2) return false;
  return languagesValue.every(isOcrLanguage)
    && new Set(languagesValue).size === languagesValue.length;
}

export function isOcrRecognitionRequest(value: unknown): value is OcrRecognitionRequest {
  return isRecord(value)
    && hasRequestId(value)
    && value.target === 'offscreen'
    && value.type === 'OCR_RECOGNIZE'
    && typeof value.imageDataUrl === 'string'
    && /^data:image\/(?:png|jpeg);base64,[a-z0-9+/=]+$/i.test(value.imageDataUrl)
    && isRegionPayload(value.region, value.languages);
}

export function isOcrRecognitionResult(value: unknown): value is OcrRecognitionResult {
  return isRecord(value)
    && typeof value.text === 'string'
    && value.text.length <= 100_000
    && isFiniteNumber(value.confidence)
    && value.confidence >= 0
    && value.confidence <= 100;
}

export function isDictionaryLookupRequest(value: unknown): value is DictionaryLookupRequest {
  return isRecord(value)
    && hasRequestId(value)
    && value.type === 'LOOKUP_DICTIONARY'
    && typeof value.text === 'string'
    && value.text.trim().length > 0
    && value.text.length <= 120
    && (value.sourceLanguage === 'en' || value.sourceLanguage === 'ru');
}

export function createRequestId(): string {
  const id = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `pt-${id.toLowerCase()}`;
}
