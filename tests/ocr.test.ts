import { describe, expect, it } from 'vitest';
import { normalizeRecognizedText, selectOcrResult, maskLightText } from '../src/core/ocr';

describe('OCR text normalization', () => {
  it('keeps line boundaries while removing OCR spacing noise', () => {
    expect(normalizeRecognizedText('  Hello   world  \n\n  Привет   мир \f'))
      .toBe('Hello world\nПривет мир');
  });

  it('returns an empty string when OCR found only whitespace', () => {
    expect(normalizeRecognizedText(' \n\t\f ')).toBe('');
  });
});

describe('OCR photo fallback', () => {
  it('uses confident captions instead of uncertain decorative shapes', () => {
    const result = selectOcrResult({ text: 'D) Ta bo <', confidence: 37 }, [
      { text: 'of', confidence: 60 },
      { text: '\\', confidence: 92 },
      { text: 'what it is', confidence: 91 },
      { text: 'brain health', confidence: 96 },
      { text: 'tips & tricks', confidence: 93 },
    ]);
    expect(result.text).toBe('what it is\nbrain health\ntips & tricks');
    expect(result.confidence).toBeGreaterThan(90);
  });

  it('keeps the first result when the alternative has no reliable text', () => {
    const original = { text: 'Привет', confidence: 58 };
    expect(selectOcrResult(original, [{ text: 'D)', confidence: 99 }])).toBe(original);
    expect(selectOcrResult(original, [{ text: 'текст', confidence: 40 }])).toBe(original);
  });

  it('does not replace a good reading with a marginally better alternative', () => {
    const original = { text: 'Hello world', confidence: 94 };
    expect(selectOcrResult(original, [{ text: 'Hello', confidence: 96 }])).toBe(original);
  });

  it('does not replace a paragraph with one isolated confident word', () => {
    const original = { text: 'This paragraph contains several useful words to preserve', confidence: 42 };
    expect(selectOcrResult(original, [{ text: 'Hello', confidence: 95 }])).toBe(original);
  });

  it('makes bright text black while preserving an opaque white background', () => {
    const pixels = new Uint8ClampedArray([255, 255, 255, 255, 160, 70, 120, 255]);
    maskLightText(pixels);
    expect([...pixels]).toEqual([0, 0, 0, 255, 255, 255, 255, 255]);
  });
});
