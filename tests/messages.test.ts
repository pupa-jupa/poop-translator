import { describe, expect, it } from 'vitest';
import {
  createRequestId,
  isContentRequest,
  isDictionaryLookupRequest,
  isOcrRecognitionRequest,
  isOcrRecognitionResult,
  isRegionCaptureRequest,
} from '../src/shared/messages';

describe('runtime message protocol', () => {
  it('creates distinct request ids safe for deduplication', () => {
    const first = createRequestId();
    const second = createRequestId();

    expect(first).toMatch(/^pt-[a-z0-9-]+$/);
    expect(second).not.toBe(first);
  });

  it('accepts complete page translation requests', () => {
    expect(isContentRequest({
      type: 'TRANSLATE_PAGE',
      requestId: 'pt-123',
      targetLanguage: 'ru',
    })).toBe(true);
    expect(isContentRequest({
      type: 'REGION_OCR_STARTED', requestId: 'pt-region',
    })).toBe(true);
  });

  it('accepts reverse translation and local dictionary lookup requests', () => {
    expect(isContentRequest({
      type: 'TRANSLATE_PAGE', requestId: 'pt-123', targetLanguage: 'en',
    })).toBe(true);
    expect(isDictionaryLookupRequest({
      type: 'LOOKUP_DICTIONARY', requestId: 'pt-124', text: 'bank', sourceLanguage: 'en',
    })).toBe(true);
    expect(isContentRequest({
      type: 'TRANSLATE_PAGE', requestId: 'pt-125', targetLanguage: 'ja',
    })).toBe(true);
  });

  it('accepts a bounded region capture request and rejects malformed geometry', () => {
    const region = {
      left: 100,
      top: 50,
      width: 400,
      height: 250,
      viewportWidth: 800,
      viewportHeight: 600,
    };
    expect(isRegionCaptureRequest({
      type: 'CAPTURE_REGION', requestId: 'pt-125', region, languages: ['eng', 'rus'],
    })).toBe(true);
    expect(isRegionCaptureRequest({
      type: 'CAPTURE_REGION', requestId: 'pt-126', region: { ...region, width: -1 }, languages: ['eng'],
    })).toBe(false);
    expect(isRegionCaptureRequest({
      type: 'CAPTURE_REGION', requestId: 'pt-127', region, languages: ['eng', 'deu'],
    })).toBe(true);
    expect(isRegionCaptureRequest({
      type: 'CAPTURE_REGION', requestId: 'pt-127b', region, languages: ['jpn'],
    })).toBe(true);

    expect(isOcrRecognitionRequest({
      target: 'offscreen',
      type: 'OCR_RECOGNIZE',
      requestId: 'pt-128',
      imageDataUrl: 'data:image/png;base64,abcd',
      region,
      languages: ['eng', 'rus'],
    })).toBe(true);
    expect(isOcrRecognitionRequest({
      target: 'offscreen', type: 'OCR_RECOGNIZE', requestId: 'pt-128-cjk',
      imageDataUrl: 'data:image/png;base64,abcd', region, languages: ['chi_sim'],
    })).toBe(true);
    expect(isOcrRecognitionRequest({
      target: 'offscreen', type: 'OCR_RECOGNIZE', requestId: 'pt-128-too-many',
      imageDataUrl: 'data:image/png;base64,abcd', region, languages: ['jpn', 'kor', 'chi_sim'],
    })).toBe(false);
    expect(isOcrRecognitionRequest({
      target: 'offscreen',
      type: 'OCR_RECOGNIZE',
      requestId: 'pt-129',
      imageDataUrl: 'https://example.com/capture.png',
      region,
      languages: ['eng'],
    })).toBe(false);
    expect(isOcrRecognitionResult({ text: 'HELLO OCR', confidence: 85.2 })).toBe(true);
    expect(isOcrRecognitionResult({ text: 'HELLO OCR', confidence: Number.NaN })).toBe(false);
    expect(isOcrRecognitionResult({ text: '', confidence: 85.2 })).toBe(true);
  });

  it('rejects malformed or unknown runtime messages', () => {
    expect(isContentRequest({ type: 'TRANSLATE_PAGE', targetLanguage: 'ru' })).toBe(false);
    expect(isContentRequest({ type: 'TRANSLATE_PAGE', requestId: 'pt-1', targetLanguage: 'fr' })).toBe(true);
    expect(isContentRequest({ type: 'TRANSLATE_PAGE', requestId: 'pt-1', targetLanguage: 'xx' })).toBe(false);
    expect(isContentRequest({ type: 'TRANSLATE_PAGE', requestId: 'pt-1', sourceMode: 'auto' })).toBe(false);
    expect(isContentRequest({ type: 'DELETE_EVERYTHING', requestId: 'pt-1' })).toBe(false);
    expect(isContentRequest({ type: 'SHOW_SELECTION_TRANSLATOR', requestId: 'pt-1', text: 'hello', source: 'context-menu' })).toBe(false);
    expect(isContentRequest(null)).toBe(false);
  });

  it('accepts an auto-detected context-menu translation with an explicit target', () => {
    expect(isContentRequest({
      type: 'SHOW_SELECTION_TRANSLATOR',
      requestId: 'pt-context-1',
      text: 'Guten Morgen',
      source: 'context-menu',
      sourceMode: 'auto',
      targetLanguage: 'ru',
    })).toBe(true);
    expect(isContentRequest({
      type: 'SHOW_SELECTION_TRANSLATOR',
      requestId: 'pt-context-2',
      text: 'Bonjour',
      source: 'context-menu',
      sourceMode: 'auto',
      targetLanguage: 'fr',
    })).toBe(true);
    expect(isContentRequest({
      type: 'SHOW_SELECTION_TRANSLATOR',
      requestId: 'pt-context-3',
      text: 'こんにちは',
      source: 'context-menu',
      sourceMode: 'ja',
      targetLanguage: 'ko',
    })).toBe(true);
  });
});
