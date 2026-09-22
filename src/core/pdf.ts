export const PDF_LIMITS = {
  maxBytes: 20 * 1024 * 1024,
  maxPages: 50,
  maxImagePixels: 16_000_000,
  maxCanvasBytes: 64 * 1024 * 1024,
  maxPageCharacters: 100_000,
  maxTotalCharacters: 1_000_000,
} as const;

const PAGE_TEXT_LIMIT_ERROR = 'На странице слишком много текста для безопасной обработки.';
const TOTAL_TEXT_LIMIT_ERROR = 'В PDF слишком много текста для безопасной обработки.';

interface PdfInputLike {
  name: string;
  size: number;
  type: string;
}

export function validatePdfInput(file: PdfInputLike, pageCount?: number): { name: string; size: number } {
  if (!file.name.toLocaleLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
    throw new Error('Выберите файл PDF.');
  }
  if (!Number.isFinite(file.size) || file.size <= 0) throw new Error('PDF пуст или недоступен.');
  if (file.size > PDF_LIMITS.maxBytes) throw new Error('PDF должен быть не больше 20 МБ.');
  if (pageCount !== undefined && (!Number.isInteger(pageCount) || pageCount < 1 || pageCount > PDF_LIMITS.maxPages)) {
    throw new Error('Можно перевести PDF до 50 страниц.');
  }
  return { name: file.name, size: file.size };
}

export function pageTextFromItems(items: unknown[], maxCharacters: number = PDF_LIMITS.maxPageCharacters): string {
  let text = '';
  for (const item of items) {
    if (typeof item !== 'object' || item === null || !('str' in item) || typeof item.str !== 'string') continue;
    if (text.length + item.str.length + 1 > maxCharacters) throw new Error(PAGE_TEXT_LIMIT_ERROR);
    text += item.str;
    if ('hasEOL' in item && item.hasEOL === true) text += '\n';
  }
  return text
    .split(/\r?\n/)
    .map((line) => line.replace(/[\t ]+/g, ' ').trim())
    .filter(Boolean)
    .join('\n');
}

export function validatePdfTextBudget(currentCharacters: number, nextCharacters: number): number {
  const total = currentCharacters + nextCharacters;
  if (!Number.isSafeInteger(total) || total > PDF_LIMITS.maxTotalCharacters) throw new Error(TOTAL_TEXT_LIMIT_ERROR);
  return total;
}

export function safePdfBaseName(name: string): string {
  const withoutExtension = name.replace(/\.pdf$/i, '').trim() || 'document';
  return withoutExtension.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').slice(0, 120);
}

export function describePdfError(error: unknown): string {
  if (error instanceof Error) {
    if (error.message.startsWith('Выберите файл PDF') || error.message.startsWith('PDF должен')
      || error.message.startsWith('PDF пуст') || error.message.startsWith('Можно перевести PDF')
      || error.message.startsWith('На странице нет') || error.message === PAGE_TEXT_LIMIT_ERROR
      || error.message === TOTAL_TEXT_LIMIT_ERROR) return error.message;
    if (error.name === 'PasswordException') return 'PDF защищён паролем. Сохраните незашифрованную копию и попробуйте её.';
    if (error.name === 'InvalidPDFException' || error.name === 'FormatError') {
      return 'PDF повреждён или имеет неподдерживаемый формат.';
    }
  }
  return 'Не удалось прочитать PDF. Попробуйте другой файл.';
}
