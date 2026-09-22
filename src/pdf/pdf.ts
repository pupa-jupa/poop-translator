import './pdf.css';
import { getDocument, GlobalWorkerOptions, type PDFDocumentLoadingTask, type PDFPageProxy } from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import {
  describePdfError,
  pageTextFromItems,
  PDF_LIMITS,
  safePdfBaseName,
  validatePdfInput,
  validatePdfTextBudget,
} from '../core/pdf';
import { splitText } from '../core/page-translation';
import { ChromeTranslator } from '../core/translator';
import { recognizeCanvas } from '../ocr/tesseract-engine';
import type { OcrLanguage, PageTargetLanguage } from '../shared/types';

GlobalWorkerOptions.workerSrc = workerUrl;

interface LoadedPage { number: number; original: string; translation: string; source: 'text' | 'ocr'; }

const fileInput = document.querySelector<HTMLInputElement>('#pdf-file')!;
const dropZone = document.querySelector<HTMLElement>('[data-drop-zone]')!;
const status = document.querySelector<HTMLElement>('[data-status]')!;
const errorBox = document.querySelector<HTMLElement>('[data-error]')!;
const workspace = document.querySelector<HTMLElement>('[data-workspace]')!;
const pagesRoot = document.querySelector<HTMLElement>('[data-pages]')!;
const fileName = document.querySelector<HTMLElement>('[data-file-name]')!;
const fileMeta = document.querySelector<HTMLElement>('[data-file-meta]')!;
const targetSelect = document.querySelector<HTMLSelectElement>('[data-target-language]')!;
const ocrSelect = document.querySelector<HTMLSelectElement>('[data-ocr-language]')!;
const translateButton = document.querySelector<HTMLButtonElement>('[data-action="translate"]')!;
const cancelButton = document.querySelector<HTMLButtonElement>('[data-action="cancel"]')!;
const downloadButton = document.querySelector<HTMLButtonElement>('[data-action="download"]')!;
const engine = new ChromeTranslator();
let loadedPages: LoadedPage[] = [];
let loadedName = '';
let completedTarget: PageTargetLanguage | undefined;
let documentGeneration = 0;
let translationGeneration = 0;
let activeLoadingTask: PDFDocumentLoadingTask | undefined;

function setError(message?: string): void {
  errorBox.hidden = !message;
  errorBox.textContent = message ?? '';
}

function setStatus(message: string): void { status.textContent = message; }

function renderPages(): void {
  const fragment = document.createDocumentFragment();
  for (const page of loadedPages) {
    const article = document.createElement('article');
    article.className = 'pdf-page';
    article.dataset.page = String(page.number);
    const heading = document.createElement('div');
    heading.className = 'page-heading';
    heading.append(document.createTextNode(`Страница ${page.number}`));
    const source = document.createElement('span');
    source.textContent = page.source === 'ocr' ? 'распознано локально' : 'текстовый слой';
    heading.append(source);
    const originalPanel = document.createElement('section');
    originalPanel.className = 'text-panel';
    const originalTitle = document.createElement('h3');
    originalTitle.textContent = 'Оригинал';
    const original = document.createElement('p');
    original.textContent = page.original;
    originalPanel.append(originalTitle, original);
    const translatedPanel = document.createElement('section');
    translatedPanel.className = 'text-panel text-panel--translation';
    const translatedTitle = document.createElement('h3');
    translatedTitle.textContent = 'Перевод';
    const translated = document.createElement('p');
    translated.dataset.translation = String(page.number);
    translated.textContent = page.translation;
    translatedPanel.append(translatedTitle, translated);
    article.append(heading, originalPanel, translatedPanel);
    fragment.append(article);
  }
  pagesRoot.replaceChildren(fragment);
}

async function renderPageForOcr(page: PDFPageProxy): Promise<HTMLCanvasElement> {
  const base = page.getViewport({ scale: 1 });
  const scale = Math.min(2.2, 1700 / Math.max(base.width, base.height));
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(viewport.width));
  canvas.height = Math.max(1, Math.round(viewport.height));
  const canvasContext = canvas.getContext('2d', { alpha: false });
  if (!canvasContext) throw new Error('Не удалось подготовить страницу для OCR.');
  await page.render({ canvas, canvasContext, viewport }).promise;
  return canvas;
}

async function extractPage(page: PDFPageProxy, ocrLanguages: OcrLanguage[]): Promise<Omit<LoadedPage, 'number' | 'translation'>> {
  const reader = page.streamTextContent().getReader();
  let text = '';
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      const separatorLength = text ? 1 : 0;
      const part = pageTextFromItems(chunk.value.items, PDF_LIMITS.maxPageCharacters - text.length - separatorLength);
      if (part) text += `${text ? '\n' : ''}${part}`;
    }
  } catch (error) {
    await reader.cancel().catch(() => undefined);
    throw error;
  } finally {
    reader.releaseLock();
  }
  if (text) return { original: text, source: 'text' };
  const canvas = await renderPageForOcr(page);
  try {
    const recognized = await recognizeCanvas(canvas, ocrLanguages);
    if (!recognized.text) throw new Error('На странице нет распознаваемого текста.');
    return { original: recognized.text, source: 'ocr' };
  } finally {
    canvas.width = canvas.height = 1;
  }
}

async function loadPdf(file: File): Promise<void> {
  const generation = ++documentGeneration;
  translationGeneration += 1;
  const previousTask = activeLoadingTask;
  activeLoadingTask = undefined;
  if (previousTask) void previousTask.destroy().catch(() => undefined);
  let ownLoadingTask: PDFDocumentLoadingTask | undefined;
  try {
    setError();
    validatePdfInput(file);
    const ocrLanguages: OcrLanguage[] = ocrSelect.value === 'auto'
      ? ['eng', 'rus']
      : [ocrSelect.value as OcrLanguage];
    setStatus('Открываю PDF на устройстве…');
    translateButton.disabled = true;
    cancelButton.hidden = true;
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (generation !== documentGeneration) return;
    ownLoadingTask = getDocument({
      data: bytes,
      stopAtErrors: true,
      maxImageSize: PDF_LIMITS.maxImagePixels,
      canvasMaxAreaInBytes: PDF_LIMITS.maxCanvasBytes,
    });
    activeLoadingTask = ownLoadingTask;
    const nextDocument = await ownLoadingTask.promise;
    if (generation !== documentGeneration) return;
    validatePdfInput(file, nextDocument.numPages);
    const nextPages: LoadedPage[] = [];
    let totalCharacters = 0;
    for (let index = 1; index <= nextDocument.numPages; index += 1) {
      if (generation !== documentGeneration) return;
      setStatus(`Читаю страницу ${index} из ${nextDocument.numPages}…`);
      const page = await nextDocument.getPage(index);
      const extracted = await extractPage(page, ocrLanguages);
      if (generation !== documentGeneration) return;
      totalCharacters = validatePdfTextBudget(totalCharacters, extracted.original.length);
      nextPages.push({ number: index, translation: '', ...extracted });
    }
    if (generation !== documentGeneration) return;
    loadedPages = nextPages;
    loadedName = file.name;
    completedTarget = undefined;
    downloadButton.hidden = true;
    fileName.textContent = file.name;
    const ocrCount = loadedPages.filter((page) => page.source === 'ocr').length;
    fileMeta.textContent = `${loadedPages.length} стр. · ${(file.size / 1024 / 1024).toFixed(1)} МБ${ocrCount ? ` · OCR: ${ocrCount}` : ''}`;
    workspace.hidden = false;
    renderPages();
    translateButton.disabled = false;
    setStatus(ocrCount ? 'PDF прочитан. Страницы без текстового слоя распознаны локально.' : 'PDF прочитан и готов к переводу.');
  } catch (error) {
    if (generation !== documentGeneration) return;
    setError(describePdfError(error));
    translateButton.disabled = loadedPages.length === 0;
    setStatus(loadedPages.length ? 'Новый PDF не открыт. Предыдущий документ сохранён.' : 'PDF не загружен.');
  } finally {
    if (activeLoadingTask === ownLoadingTask) activeLoadingTask = undefined;
    await ownLoadingTask?.destroy().catch(() => undefined);
  }
}

async function translatePdf(targetLanguage: PageTargetLanguage, generation: number, preparation: Promise<void>): Promise<void> {
  try {
    await preparation;
    for (let pageIndex = 0; pageIndex < loadedPages.length; pageIndex += 1) {
      const page = loadedPages[pageIndex];
      if (!page || generation !== translationGeneration) return;
      const chunks = splitText(page.original);
      const translations: string[] = [];
      for (let index = 0; index < chunks.length; index += 1) {
        if (generation !== translationGeneration) return;
        setStatus(`Перевожу страницу ${page.number} из ${loadedPages.length} · фрагмент ${index + 1} из ${chunks.length}`);
        translations.push(await engine.translatePageText(chunks[index]!, targetLanguage));
      }
      if (generation !== translationGeneration) return;
      page.translation = translations.join('\n\n');
      const output = document.querySelector<HTMLElement>(`[data-translation="${page.number}"]`);
      if (output) output.textContent = page.translation;
    }
    setStatus(`Готово: переведено страниц — ${loadedPages.length}.`);
    completedTarget = targetLanguage;
    downloadButton.hidden = false;
  } catch (error) {
    if (generation !== translationGeneration) return;
    setError(error instanceof Error ? error.message : 'Не удалось перевести PDF.');
    setStatus('Перевод остановлен. Уже готовые страницы сохранены на экране.');
  } finally {
    if (generation === translationGeneration) {
      translateButton.disabled = false;
      cancelButton.hidden = true;
    }
  }
}

document.querySelector<HTMLButtonElement>('[data-action="choose-file"]')!.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', () => {
  const file = fileInput.files?.[0];
  fileInput.value = '';
  if (!file) return;
  void loadPdf(file);
});

for (const eventName of ['dragenter', 'dragover']) {
  dropZone.addEventListener(eventName, (event) => { event.preventDefault(); dropZone.dataset.dragging = 'true'; });
}
for (const eventName of ['dragleave', 'drop']) {
  dropZone.addEventListener(eventName, (event) => { event.preventDefault(); delete dropZone.dataset.dragging; });
}
dropZone.addEventListener('drop', (event) => {
  const file = event.dataTransfer?.files[0];
  if (file) void loadPdf(file);
});

translateButton.addEventListener('click', () => {
  if (!loadedPages.length) return;
  const generation = ++translationGeneration;
  const target = targetSelect.value === 'en' ? 'en' : 'ru';
  setError();
  translateButton.disabled = true;
  cancelButton.hidden = false;
  downloadButton.hidden = true;
  completedTarget = undefined;
  for (const page of loadedPages) page.translation = '';
  renderPages();
  // Must be invoked synchronously from this click for Chrome's transient activation.
  const preparation = engine.prepareForPageTarget(target, {
    onProgress(percent) { if (generation === translationGeneration) setStatus(`Загружаю языковой пакет: ${percent}%`); },
  });
  void translatePdf(target, generation, preparation);
});

cancelButton.addEventListener('click', () => {
  translationGeneration += 1;
  cancelButton.hidden = true;
  translateButton.disabled = false;
  setStatus('Перевод отменён. Уже готовые страницы остались на экране.');
});

downloadButton.addEventListener('click', () => {
  if (!completedTarget) return;
  const body = loadedPages.map((page) => `Страница ${page.number}\n\n${page.translation || page.original}`).join('\n\n––––––––––––––––\n\n');
  const blob = new Blob([body], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${safePdfBaseName(loadedName)}-${completedTarget}.txt`;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1_000);
});

window.addEventListener('beforeunload', () => { engine.destroy(); void activeLoadingTask?.destroy(); });
