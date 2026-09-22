import './pdf.css';
import { getDocument, GlobalWorkerOptions, type PDFDocumentLoadingTask, type PDFPageProxy } from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import {
  describePdfError,
  classifyPdfInput,
  pageTextFromItems,
  PDF_LIMITS,
  processPageBatches,
  safePdfBaseName,
  validatePdfInput,
  validatePdfPageTextBudget,
  validatePdfTextBudget,
} from '../core/pdf';
import { splitText } from '../core/page-translation';
import { ChromeTranslator } from '../core/translator';
import { detectDocumentSource, prepareDocumentPair, shouldTranslateDocumentPart, type DocumentPairActivation } from '../core/document-language';
import { OCR_LANGUAGES, TRANSLATION_LANGUAGES, languageDefinition } from '../core/languages';
import { recognizeCanvas } from '../ocr/tesseract-engine';
import type { OcrLanguage, PageTargetLanguage, SourceMode } from '../shared/types';

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
const sourceSelect = document.querySelector<HTMLSelectElement>('[data-source-language]')!;
const ocrSelect = document.querySelector<HTMLSelectElement>('[data-ocr-language]')!;
const translateButton = document.querySelector<HTMLButtonElement>('[data-action="translate"]')!;
const preparePairButton = document.querySelector<HTMLButtonElement>('[data-action="prepare-pair"]')!;
const cancelButton = document.querySelector<HTMLButtonElement>('[data-action="cancel"]')!;
const downloadButton = document.querySelector<HTMLButtonElement>('[data-action="download"]')!;
const engine = new ChromeTranslator();
ocrSelect.replaceChildren(
  new Option('Авто EN/RU', 'auto'),
  ...OCR_LANGUAGES.map((language) => new Option(language.name, language.code)),
);
targetSelect.replaceChildren(...TRANSLATION_LANGUAGES.map((language) => new Option(`На ${language.toName}`, language.code)));
targetSelect.value = 'ru';
sourceSelect.replaceChildren(new Option('Определить автоматически', 'auto'),
  ...TRANSLATION_LANGUAGES.map((language) => new Option(language.name, language.code)));
let loadedPages: LoadedPage[] = [];
let loadedName = '';
let completedTarget: PageTargetLanguage | undefined;
let documentGeneration = 0;
let translationGeneration = 0;
let activeLoadingTask: PDFDocumentLoadingTask | undefined;
let cancelPendingPairActivation: (() => void) | undefined;
const warningDialog = document.querySelector<HTMLDialogElement>('[data-pdf-warning]')!;
const warningText = document.querySelector<HTMLElement>('[data-pdf-warning-text]')!;

function yieldToBrowser(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

function confirmLargePdf(warnings: Array<'large-file' | 'many-pages'>): Promise<boolean> {
  if (!warnings.length) return Promise.resolve(true);
  const details: string[] = [];
  if (warnings.includes('large-file')) details.push('файл больше 20 МБ');
  if (warnings.includes('many-pages')) details.push('в документе больше 50 страниц');
  warningText.textContent = `Этот PDF потребует больше памяти и времени (${details.join(', ')}). Обработка останется локальной и будет идти пакетами по 5 страниц.`;
  warningDialog.returnValue = '';
  warningDialog.showModal();
  return new Promise((resolve) => {
    warningDialog.addEventListener('close', () => resolve(warningDialog.returnValue === 'continue'), { once: true });
  });
}

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
  try {
    await page.render({ canvas, canvasContext, viewport }).promise;
    return canvas;
  } catch (error) {
    canvas.width = canvas.height = 1;
    throw error;
  }
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
    validatePdfPageTextBudget(recognized.text.length);
    return { original: recognized.text, source: 'ocr' };
  } finally {
    canvas.width = canvas.height = 1;
  }
}

async function loadPdf(file: File): Promise<void> {
  const generation = ++documentGeneration;
  translationGeneration += 1;
  cancelPendingPairActivation?.();
  if (warningDialog.open) warningDialog.close('cancel');
  const previousTask = activeLoadingTask;
  activeLoadingTask = undefined;
  if (previousTask) void previousTask.destroy().catch(() => undefined);
  let ownLoadingTask: PDFDocumentLoadingTask | undefined;
  try {
    setError();
    const earlyWarnings = classifyPdfInput(file).warnings;
    const ocrLanguages: OcrLanguage[] = ocrSelect.value === 'auto'
      ? ['eng', 'rus']
      : [ocrSelect.value as OcrLanguage];
    setStatus('Открываю PDF на устройстве…');
    translateButton.disabled = true;
    cancelButton.hidden = false;
    if (!await confirmLargePdf(earlyWarnings)) {
      setStatus(loadedPages.length ? 'Открытие отменено. Предыдущий документ сохранён.' : 'Открытие PDF отменено.');
      translateButton.disabled = loadedPages.length === 0;
      return;
    }
    if (generation !== documentGeneration) return;
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
    const classification = classifyPdfInput(file, nextDocument.numPages);
    const newWarnings = classification.warnings.filter((warning) => !earlyWarnings.includes(warning));
    if (!await confirmLargePdf(newWarnings)) {
      setStatus(loadedPages.length ? 'Открытие отменено. Предыдущий документ сохранён.' : 'Открытие PDF отменено.');
      translateButton.disabled = loadedPages.length === 0;
      return;
    }
    if (generation !== documentGeneration) return;
    const nextPages: LoadedPage[] = [];
    let totalCharacters = 0;
    await processPageBatches(
      nextDocument.numPages,
      5,
      async (index) => {
        setStatus(`Читаю страницу ${index} из ${nextDocument.numPages}…`);
        const page = await nextDocument.getPage(index);
        try {
          const extracted = await extractPage(page, ocrLanguages);
          if (generation !== documentGeneration) return;
          totalCharacters = validatePdfTextBudget(totalCharacters, extracted.original.length);
          nextPages.push({ number: index, translation: '', ...extracted });
        } finally {
          page.cleanup();
        }
      },
      yieldToBrowser,
      () => generation !== documentGeneration,
    );
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
    if (generation === documentGeneration) cancelButton.hidden = true;
  }
}

async function translatePdf(targetLanguage: PageTargetLanguage, sourceMode: SourceMode, generation: number, preparation: Promise<void>): Promise<void> {
  try {
    await preparation;
    if (generation !== translationGeneration) return;
    const sourceLanguage = sourceMode === 'auto'
      ? (await detectDocumentSource(engine, loadedPages.map((page) => page.original), targetLanguage)).sourceLanguage
      : sourceMode;
    if (generation !== translationGeneration) return;
    const pairActivation = await prepareDocumentPair(engine, sourceLanguage, targetLanguage);
    if (generation !== translationGeneration) return;
    if (pairActivation) await requestPdfPairActivation(pairActivation, generation);
    for (let pageIndex = 0; pageIndex < loadedPages.length; pageIndex += 1) {
      const page = loadedPages[pageIndex];
      if (!page || generation !== translationGeneration) return;
      const chunks = splitText(page.original);
      const translations: string[] = [];
      for (let index = 0; index < chunks.length; index += 1) {
        if (generation !== translationGeneration) return;
        setStatus(`Перевожу страницу ${page.number} из ${loadedPages.length} · фрагмент ${index + 1} из ${chunks.length}`);
        const chunk = chunks[index]!;
        const shouldTranslate = await shouldTranslateDocumentPart(engine, chunk, sourceLanguage, targetLanguage, sourceMode === 'auto');
        if (generation !== translationGeneration) return;
        if (!shouldTranslate) { translations.push(chunk); continue; }
        const result = await engine.translate(chunk, sourceLanguage, {}, targetLanguage);
        if (generation !== translationGeneration) return;
        translations.push(result.translation);
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
      preparePairButton.hidden = true;
    }
  }
}

function requestPdfPairActivation(
  attempt: DocumentPairActivation,
  generation: number,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const source = languageDefinition(attempt.sourceLanguage).fromName;
    const target = languageDefinition(attempt.targetLanguage).toName;
    setStatus(`Определён язык: перевод с ${source} на ${target}. Нажмите «Подготовить и перевести».`);
    preparePairButton.hidden = false;
    const cleanup = () => {
      preparePairButton.hidden = true;
      preparePairButton.onclick = null;
      if (cancelPendingPairActivation === cancel) cancelPendingPairActivation = undefined;
    };
    const cancel = () => { cleanup(); reject(new DOMException('Операция отменена', 'AbortError')); };
    cancelPendingPairActivation = cancel;
    preparePairButton.onclick = () => {
      if (generation !== translationGeneration) { cancel(); return; }
      const pending = attempt.activate({
        onProgress(percent) { if (generation === translationGeneration) setStatus(`Загружаю языковой пакет: ${percent}%`); },
      });
      cleanup();
      void pending.then(resolve, reject);
    };
    preparePairButton.focus({ preventScroll: true });
  });
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
  const target = targetSelect.value as PageTargetLanguage;
  const sourceMode = sourceSelect.value as SourceMode;
  setError();
  translateButton.disabled = true;
  cancelButton.hidden = false;
  downloadButton.hidden = true;
  completedTarget = undefined;
  for (const page of loadedPages) page.translation = '';
  renderPages();
  // Must be invoked synchronously from this click for Chrome's transient activation.
  const preparation = sourceMode === 'auto' ? engine.prepareForPageTarget(target, {
    onProgress(percent) { if (generation === translationGeneration) setStatus(`Загружаю языковой пакет: ${percent}%`); },
  }) : Promise.all([
    engine.prepareForMode(sourceMode, {
      onProgress(percent) { if (generation === translationGeneration) setStatus(`Загружаю языковой пакет: ${percent}%`); },
    }, target),
    engine.prepareForPageTarget(target),
  ]).then(() => undefined);
  void translatePdf(target, sourceMode, generation, preparation);
});

cancelButton.addEventListener('click', () => {
  cancelPendingPairActivation?.();
  documentGeneration += 1;
  translationGeneration += 1;
  const loadingTask = activeLoadingTask;
  activeLoadingTask = undefined;
  if (loadingTask) void loadingTask.destroy().catch(() => undefined);
  if (warningDialog.open) warningDialog.close('cancel');
  cancelButton.hidden = true;
  translateButton.disabled = loadedPages.length === 0;
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
