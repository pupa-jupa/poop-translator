import { describe, expect, it } from 'vitest';
import { PDF_LIMITS, describePdfError, pageTextFromItems, validatePdfInput, validatePdfTextBudget } from '../src/core/pdf';

describe('local PDF helpers', () => {
  it('keeps reading order and explicit line endings from the PDF text layer', () => {
    expect(pageTextFromItems([
      { str: 'Hello', hasEOL: false },
      { str: ' world.', hasEOL: true },
      { str: 'Second line', hasEOL: false },
      { type: 'markedContent' },
    ])).toBe('Hello world.\nSecond line');
  });

  it('normalizes repeated PDF whitespace without joining words', () => {
    expect(pageTextFromItems([
      { str: '  One   two  ', hasEOL: true },
      { str: '   Three', hasEOL: false },
    ])).toBe('One two\nThree');
  });

  it('rejects a non-PDF, an oversized file and too many pages', () => {
    expect(() => validatePdfInput({ name: 'notes.txt', size: 20, type: 'text/plain' })).toThrow('PDF');
    expect(() => validatePdfInput({ name: 'book.pdf', size: PDF_LIMITS.maxBytes + 1, type: 'application/pdf' })).toThrow('20 МБ');
    expect(() => validatePdfInput({ name: 'book.pdf', size: 100, type: 'application/pdf' }, PDF_LIMITS.maxPages + 1)).toThrow('50 страниц');
    expect(validatePdfInput({ name: 'BOOK.PDF', size: 100, type: '' }, 2)).toEqual({ name: 'BOOK.PDF', size: 100 });
  });

  it('turns parser failures into useful Russian errors without exposing internals', () => {
    expect(describePdfError(Object.assign(new Error('password'), { name: 'PasswordException' }))).toContain('паролем');
    expect(describePdfError(Object.assign(new Error('xref broken'), { name: 'InvalidPDFException' }))).toBe('PDF повреждён или имеет неподдерживаемый формат.');
    expect(describePdfError(new Error('secret parser path'))).toBe('Не удалось прочитать PDF. Попробуйте другой файл.');
  });

  it('bounds decompressed page and document text', () => {
    expect(() => pageTextFromItems([{ str: 'x'.repeat(PDF_LIMITS.maxPageCharacters + 1) }])).toThrow('текста');
    expect(validatePdfTextBudget(100, 200)).toBe(300);
    expect(() => validatePdfTextBudget(PDF_LIMITS.maxTotalCharacters, 1)).toThrow('текста');
  });
});
