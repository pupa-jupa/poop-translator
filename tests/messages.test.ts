import { describe, expect, it } from 'vitest';
import { createRequestId, isContentRequest, isDictionaryLookupRequest } from '../src/shared/messages';

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
      sourceMode: 'auto',
    })).toBe(true);
  });

  it('accepts reverse translation and local dictionary lookup requests', () => {
    expect(isContentRequest({
      type: 'TRANSLATE_PAGE', requestId: 'pt-123', sourceMode: 'ru',
    })).toBe(true);
    expect(isDictionaryLookupRequest({
      type: 'LOOKUP_DICTIONARY', requestId: 'pt-124', text: 'bank', sourceLanguage: 'en',
    })).toBe(true);
  });

  it('rejects malformed or unknown runtime messages', () => {
    expect(isContentRequest({ type: 'TRANSLATE_PAGE', sourceMode: 'auto' })).toBe(false);
    expect(isContentRequest({ type: 'TRANSLATE_PAGE', requestId: 'pt-1', sourceMode: 'fr' })).toBe(false);
    expect(isContentRequest({ type: 'DELETE_EVERYTHING', requestId: 'pt-1' })).toBe(false);
    expect(isContentRequest({ type: 'SHOW_SELECTION_TRANSLATOR', requestId: 'pt-1', text: 'hello', source: 'context-menu' })).toBe(false);
    expect(isContentRequest(null)).toBe(false);
  });
});
