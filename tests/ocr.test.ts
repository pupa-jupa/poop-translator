import { describe, expect, it } from 'vitest';
import { normalizeRecognizedText } from '../src/core/ocr';

describe('OCR text normalization', () => {
  it('keeps line boundaries while removing OCR spacing noise', () => {
    expect(normalizeRecognizedText('  Hello   world  \n\n  Привет   мир \f'))
      .toBe('Hello world\nПривет мир');
  });

  it('returns an empty string when OCR found only whitespace', () => {
    expect(normalizeRecognizedText(' \n\t\f ')).toBe('');
  });
});
