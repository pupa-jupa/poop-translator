import { describe, expect, it } from 'vitest';
import {
  PDF_LIMITS,
  classifyPdfInput,
  describePdfError,
  pageTextFromItems,
  processPageBatches,
  validatePdfPageTextBudget,
  validatePdfInput,
  validatePdfTextBudget,
} from '../src/core/pdf';

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

  it('warns at the old thresholds and rejects only at hard limits', () => {
    expect(() => validatePdfInput({ name: 'notes.txt', size: 20, type: 'text/plain' })).toThrow('PDF');
    expect(() => validatePdfInput({ name: 'book.pdf', size: PDF_LIMITS.maxBytes + 1, type: 'application/pdf' })).toThrow('100 МБ');
    expect(() => validatePdfInput({ name: 'book.pdf', size: 100, type: 'application/pdf' }, PDF_LIMITS.maxPages + 1)).toThrow('200 страниц');
    expect(validatePdfInput({ name: 'BOOK.PDF', size: 100, type: '' }, 2)).toEqual({ name: 'BOOK.PDF', size: 100 });

    const file = (size: number) => ({ name: 'book.pdf', size, type: 'application/pdf' });
    expect(classifyPdfInput(file(PDF_LIMITS.warningBytes + 1)).warnings).toContain('large-file');
    expect(classifyPdfInput(file(1_000), PDF_LIMITS.warningPages + 1).warnings).toContain('many-pages');
    expect(() => classifyPdfInput(file(PDF_LIMITS.maxBytes + 1))).toThrow('100 МБ');
    expect(() => classifyPdfInput(file(1_000), PDF_LIMITS.maxPages + 1)).toThrow('200 страниц');
  });

  it('processes pages sequentially, yields between batches and stops on cancellation', async () => {
    const seen: number[] = [];
    let yields = 0;
    await processPageBatches(12, 5, async (page) => { seen.push(page); }, async () => { yields += 1; }, () => false);
    expect(seen).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(yields).toBe(2);

    const cancelled: number[] = [];
    await processPageBatches(10, 5, async (page) => { cancelled.push(page); }, async () => undefined, () => cancelled.length === 3);
    expect(cancelled).toEqual([1, 2, 3]);
  });

  it('turns parser failures into useful Russian errors without exposing internals', () => {
    expect(describePdfError(Object.assign(new Error('password'), { name: 'PasswordException' }))).toContain('паролем');
    expect(describePdfError(Object.assign(new Error('xref broken'), { name: 'InvalidPDFException' }))).toBe('PDF повреждён или имеет неподдерживаемый формат.');
    expect(describePdfError(new Error('secret parser path'))).toBe('Не удалось прочитать PDF. Попробуйте другой файл.');
  });

  it('bounds decompressed page and document text', () => {
    expect(() => pageTextFromItems([{ str: 'x'.repeat(PDF_LIMITS.maxPageCharacters + 1) }])).toThrow('текста');
    expect(() => validatePdfPageTextBudget(PDF_LIMITS.maxPageCharacters + 1)).toThrow('На странице');
    expect(validatePdfTextBudget(100, 200)).toBe(300);
    expect(() => validatePdfTextBudget(PDF_LIMITS.maxTotalCharacters, 1)).toThrow('текста');
  });
});
