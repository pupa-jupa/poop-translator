import contentStyles from './content.css?inline';
import { lookupAlternativeVariants } from './core/dictionary-client';
import { placeFloatingCard } from './core/floating-card';
import { PageTranslationSession, findMainContent } from './core/page-translation';
import { normalizeRegionSelection } from './core/region-capture';
import { STORAGE_KEY } from './core/storage';
import { getStorageClient } from './core/storage-client';
import { persistTranslationHistory, type HistoryPersistenceResult } from './core/translation-history';
import { ChromeTranslator } from './core/translator';
import { translateFromUserActivation } from './core/user-activated-translation';
import {
  createRequestId,
  isContentRequest,
  isOcrRecognitionResult,
  type PageStatus,
  type RegionCaptureRequest,
  type RuntimeResponse,
} from './shared/messages';
import type {
  DictionaryVariant,
  OcrLanguage,
  OcrRecognitionResult,
  PageTargetLanguage,
  RegionRect,
  Settings,
  SourceMode,
  TranslationResult,
  TranslationSource,
} from './shared/types';

const engine = new ChromeTranslator();
const repository = getStorageClient();
let settings: Settings = { sourceMode: 'en', pageTargetLanguage: 'ru', saveHistory: true, showSelectionButton: true, textScale: 115 };
let host: HTMLDivElement | undefined;
let layer: HTMLDivElement | undefined;
let selectionButton: HTMLButtonElement | undefined;
let card: HTMLDivElement | undefined;
let cardPreviousFocus: HTMLElement | undefined;
let pagePrompt: HTMLDivElement | undefined;
let selectedText = '';
let selectedRect: DOMRect | undefined;
let pageSession = new PageTranslationSession();
let pageAbort: AbortController | undefined;
let pageStatus: PageStatus = { state: 'idle', completed: 0, total: 0 };
let pageOperationId = 0;
let regionOverlay: HTMLDivElement | undefined;
let regionPreviousFocus: HTMLElement | undefined;

type PreparationOutcome = { ok: true } | { ok: false; error: unknown };
interface RegionOperation {
  requestId: string;
  sourceMode: SourceMode;
  preparation: Promise<PreparationOutcome>;
  view?: CardView;
}
let regionOperation: RegionOperation | undefined;

const poopSvg = `
  <svg class="pt-mini-poop" viewBox="0 0 48 48" aria-hidden="true">
    <path fill="currentColor" d="M10 35c0-5 4-8 9-9-5-1-6-4-5-7 1-4 5-6 9-5-2-3 0-6 3-8 1 4 5 5 7 8 2 2 1 4-1 6 5 0 8 3 8 7 0 4-2 6-4 7 2 1 3 3 3 5H11c-1-1-1-3-1-4Z"/>
    <circle cx="21" cy="27" r="2" fill="#201a28"/><circle cx="30" cy="27" r="2" fill="#201a28"/>
    <path d="M20 33c3 2 7 2 10 0" stroke="#201a28" stroke-width="2" stroke-linecap="round"/>
  </svg>`;

function ensureLayer(): HTMLDivElement {
  if (layer) return layer;
  host = document.createElement('div');
  host.dataset.poopTranslatorRoot = '';
  host.dataset.textScale = String(settings.textScale);
  const shadow = host.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = contentStyles;
  layer = document.createElement('div');
  layer.className = 'pt-layer';
  shadow.append(style, layer);
  document.documentElement.append(host);
  return layer;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

function positionCardElement(element: HTMLElement, anchor?: DOMRect): void {
  const measured = element.getBoundingClientRect();
  const point = placeFloatingCard({
    anchor,
    cardWidth: measured.width,
    cardHeight: measured.height,
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
  });
  element.style.setProperty('--pt-left', `${point.left}px`);
  element.style.setProperty('--pt-top', `${point.top}px`);
}

function removeSelectionButton(): void {
  selectionButton?.remove();
  selectionButton = undefined;
}

function closeCard(): void {
  const closingCard = card;
  card?.remove();
  card = undefined;
  if (closingCard && regionOperation?.view?.element === closingCard) regionOperation = undefined;
  if (cardPreviousFocus?.isConnected) cardPreviousFocus.focus({ preventScroll: true });
  cardPreviousFocus = undefined;
}

function showToast(message: string): void {
  const toast = document.createElement('div');
  toast.className = 'pt-toast';
  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-live', 'polite');
  toast.textContent = message;
  ensureLayer().append(toast);
  window.setTimeout(() => toast.remove(), 1800);
}

function makeButton(label: string, className = 'pt-button'): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = className;
  button.textContent = label;
  return button;
}

function showSelectionButton(rect: DOMRect): void {
  removeSelectionButton();
  closeCard();
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'pt-selection-button';
  button.setAttribute('aria-label', 'Перевести выделенный текст');
  button.innerHTML = poopSvg;
  const left = clamp(rect.right + 7, 8, window.innerWidth - 44);
  const top = clamp(rect.bottom + 5, 8, window.innerHeight - 44);
  button.style.setProperty('--pt-left', `${left}px`);
  button.style.setProperty('--pt-top', `${top}px`);
  button.addEventListener('pointerdown', (event) => event.preventDefault());
  button.addEventListener('click', () => {
    const text = selectedText;
    const selectionRect = selectedRect;
    removeSelectionButton();
    void showTranslationCard(text, selectionRect, 'selection', true);
  });
  ensureLayer().append(button);
  selectionButton = button;
}

function cardShell(original: string, rect?: DOMRect): {
  element: HTMLDivElement;
  original: HTMLParagraphElement;
  variantGeneration: number;
  translationGeneration: number;
  status: HTMLDivElement;
  translation: HTMLParagraphElement;
  variants: HTMLElement;
  variantsList: HTMLElement;
  actions: HTMLDivElement;
  anchor?: DOMRect;
} {
  closeCard();
  const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : undefined;
  const element = document.createElement('div');
  element.className = 'pt-card';
  element.setAttribute('role', 'dialog');
  element.setAttribute('aria-label', 'Перевод');
  element.tabIndex = -1;
  element.style.setProperty('--pt-left', '12px');
  element.style.setProperty('--pt-top', '12px');
  element.style.visibility = 'hidden';
  element.innerHTML = `
    <div class="pt-card-header">
      <span class="pt-card-mark">${poopSvg}</span>
      <span class="pt-card-title">poop translator</span>
      <button class="pt-icon-button" type="button" aria-label="Закрыть">✕</button>
    </div>
    <p class="pt-label">Оригинал</p>
    <p class="pt-copy pt-original"></p>
    <div class="pt-divider"></div>
    <p class="pt-label">Перевод</p>
    <div class="pt-status" role="status" aria-live="polite"><span class="pt-spinner"></span><span>Запускаю локальный перевод…</span></div>
    <p class="pt-copy pt-translation" hidden></p>
    <section class="pt-variants" aria-label="Варианты перевода" hidden>
      <div class="pt-variants__head"><span>Другие значения</span><small>локальный словарь</small></div>
      <div class="pt-variants__list"></div>
    </section>
    <div class="pt-actions"></div>`;
  element.querySelector<HTMLParagraphElement>('.pt-original')!.textContent = original;
  element.querySelector<HTMLButtonElement>('.pt-icon-button')!.addEventListener('click', closeCard);
  element.addEventListener('pointerdown', (event) => event.stopPropagation());
  ensureLayer().append(element);
  card = element;
  cardPreviousFocus = previousFocus;
  positionCardElement(element, rect);
  element.style.visibility = '';
  element.focus({ preventScroll: true });
  return {
    element,
    original: element.querySelector<HTMLParagraphElement>('.pt-original')!,
    variantGeneration: 0,
    translationGeneration: 0,
    status: element.querySelector<HTMLDivElement>('.pt-status')!,
    translation: element.querySelector<HTMLParagraphElement>('.pt-translation')!,
    variants: element.querySelector<HTMLElement>('.pt-variants')!,
    variantsList: element.querySelector<HTMLElement>('.pt-variants__list')!,
    actions: element.querySelector<HTMLDivElement>('.pt-actions')!,
    anchor: rect,
  };
}

type CardView = ReturnType<typeof cardShell>;

function partOfSpeechLabel(value?: string): string {
  return ({
    n: 'сущ.', v: 'гл.', adj: 'прил.', adv: 'нареч.', pn: 'имя',
    pronoun: 'мест.', preposition: 'предл.', conjunction: 'союз', interjection: 'межд.',
    proverb: 'посл.', phraseologicalUnit: 'фраза',
  } as Record<string, string>)[value ?? ''] ?? '';
}

function createVariantButton(result: TranslationResult, variant: DictionaryVariant): HTMLButtonElement {
  const button = document.createElement('button');
  button.className = 'pt-variant';
  button.type = 'button';
  button.setAttribute('aria-label', `Добавить «${variant.translation}» в словарь`);
  const meaning = document.createElement('span');
  meaning.textContent = variant.translation;
  const meta = document.createElement('small');
  meta.textContent = `${partOfSpeechLabel(variant.partOfSpeech)} ＋`.trim();
  button.append(meaning, meta);
  button.addEventListener('click', () => {
    button.disabled = true;
    void repository.addDictionaryEntry({ original: result.original, translation: variant.translation })
      .then(({ added }) => {
        meta.textContent = added ? 'добавлено ✓' : 'уже есть ✓';
        showToast(added ? 'Вариант добавлен в словарь' : 'Уже в словаре');
      })
      .catch(() => {
        button.disabled = false;
        showToast('Не удалось добавить вариант');
      });
  });
  return button;
}

async function showAlternativeVariants(view: CardView, result: TranslationResult): Promise<void> {
  const generation = ++view.variantGeneration;
  const variants = await lookupAlternativeVariants(result.original, result.translation, result.sourceLanguage);
  if (!view.element.isConnected || card !== view.element || view.variantGeneration !== generation || !variants.length) return;
  view.variantsList.append(...variants.map((variant) => createVariantButton(result, variant)));
  view.variants.hidden = false;
  positionCardElement(view.element, view.anchor);
}

async function saveSuccessfulTranslation(
  result: TranslationResult,
  source: TranslationSource,
  requestId: string,
): Promise<HistoryPersistenceResult> {
  if (result.alreadyRussian) return { status: 'skipped' };
  return persistTranslationHistory(() => repository.addHistory({
    requestId,
    original: result.original,
    translation: result.translation,
    sourceLanguage: result.sourceLanguage,
    targetLanguage: result.targetLanguage,
    source,
  }));
}

async function showTranslationCard(
  text: string,
  rect: DOMRect | undefined,
  source: TranslationSource,
  userActivated: boolean,
  requestId = createRequestId(),
  sourceMode: SourceMode = settings.sourceMode,
): Promise<void> {
  regionOperation = undefined;
  const view = cardShell(text, rect);

  const run = async () => {
    view.status.hidden = false;
    view.status.dataset.kind = '';
    view.status.innerHTML = '<span class="pt-spinner"></span><span>Запускаю локальный перевод…</span>';
    view.translation.hidden = true;
    view.actions.replaceChildren();
    const slowHint = window.setTimeout(() => {
      if (!view.element.isConnected || view.status.hidden) return;
      const label = view.status.querySelector('span:last-child');
      if (label) label.textContent = 'Chrome готовит языковую модель на устройстве…';
    }, 4_000);
    try {
      const result = await translateFromUserActivation(engine, text, sourceMode, {
        onProgress(percent) {
          window.clearTimeout(slowHint);
          const label = view.status.querySelector('span:last-child');
          if (label) label.textContent = `Загружаю языковой пакет: ${percent}%`;
        },
      });
      if (!view.element.isConnected) return;
      view.status.hidden = true;
      view.translation.hidden = false;
      view.translation.textContent = result.alreadyRussian ? 'Текст уже на русском' : result.translation;
      const copy = makeButton('Копировать');
      copy.addEventListener('click', () => {
        void navigator.clipboard.writeText(result.translation)
          .then(() => showToast('Скопировано'))
          .catch(() => showToast('Не удалось скопировать'));
      });
      const add = makeButton('В словарь', 'pt-button pt-button--primary');
      add.addEventListener('click', () => {
        add.disabled = true;
        void repository.addDictionaryEntry({
          original: result.original,
          translation: result.translation,
        }).then((added) => {
          add.textContent = added.added ? 'Добавлено ✓' : 'Уже в словаре';
        }).catch(() => {
          add.disabled = false;
          showToast('Не удалось добавить перевод в словарь');
        });
      });
      if (!result.alreadyRussian) view.actions.append(copy, add);
      positionCardElement(view.element, view.anchor);
      void showAlternativeVariants(view, result).catch(() => undefined);
      const historyResult = await saveSuccessfulTranslation(result, source, requestId);
      if (historyResult.status === 'failed') showToast('Перевод готов, историю сохранить не удалось');
    } catch (error) {
      if (!view.element.isConnected) return;
      const message = error instanceof Error ? error.message : 'Не удалось выполнить перевод.';
      view.status.dataset.kind = 'error';
      view.status.replaceChildren(document.createTextNode(message));
      const retry = makeButton('Повторить', 'pt-button pt-button--primary');
      retry.addEventListener('click', () => void run());
      view.actions.replaceChildren(retry);
      positionCardElement(view.element, view.anchor);
    } finally {
      window.clearTimeout(slowHint);
    }
  };

  if (userActivated) {
    await run();
  } else {
    // Try the cached model first. If Chrome requires fresh activation, the
    // rendered retry button provides the click in the correct document.
    await run();
  }
}

function ocrLanguagesForMode(sourceMode: SourceMode): OcrLanguage[] {
  if (sourceMode === 'en') return ['eng'];
  if (sourceMode === 'ru') return ['rus'];
  return ['eng', 'rus'];
}

function trackedPreparation(sourceMode: SourceMode, onProgress?: (percent: number) => void): Promise<PreparationOutcome> {
  // This call must stay synchronous with the user's pointer/click activation.
  return engine.prepareForMode(sourceMode, { onProgress })
    .then(() => ({ ok: true as const }))
    .catch((error: unknown) => ({ ok: false as const, error }));
}

function removeRegionOverlay(restoreFocus = true): void {
  regionOverlay?.remove();
  regionOverlay = undefined;
  if (restoreFocus && regionPreviousFocus?.isConnected) regionPreviousFocus.focus({ preventScroll: true });
  regionPreviousFocus = undefined;
}

function showRegionProgress(operation: RegionOperation): CardView | undefined {
  if (regionOperation !== operation) return undefined;
  if (operation.view) return operation.view.element.isConnected ? operation.view : undefined;
  const view = cardShell('Выбранная область');
  view.element.setAttribute('aria-label', 'Распознавание текста в области');
  view.status.hidden = false;
  view.status.innerHTML = '<span class="pt-spinner"></span><span>Распознаю текст на устройстве…</span>';
  operation.view = view;
  return view;
}

function showRegionError(operation: RegionOperation, message: string): void {
  const view = showRegionProgress(operation);
  if (!view) return;
  view.status.hidden = false;
  view.status.dataset.kind = 'error';
  view.status.replaceChildren(document.createTextNode(message));
  const retry = makeButton('Выбрать область снова', 'pt-button pt-button--primary');
  retry.addEventListener('click', () => {
    regionOperation = undefined;
    closeCard();
    startRegionSelection();
  });
  view.actions.replaceChildren(retry);
  positionCardElement(view.element);
}

function showRecognizedTranslationError(
  operation: RegionOperation,
  view: CardView,
  editor: HTMLTextAreaElement,
  message: string,
  buttonLabel = 'Повторить перевод',
): void {
  if (regionOperation !== operation || !view.element.isConnected) return;
  view.status.hidden = false;
  view.status.dataset.kind = 'error';
  view.status.replaceChildren(document.createTextNode(message));
  const retry = makeButton(buttonLabel, 'pt-button pt-button--primary');
  retry.addEventListener('click', () => {
    const preparation = trackedPreparation(operation.sourceMode, (percent) => {
      const label = view.status.querySelector('span:last-child');
      if (label) label.textContent = `Загружаю языковой пакет: ${percent}%`;
    });
    void renderRecognizedTranslation(operation, view, editor, preparation, createRequestId())
      .catch((error) => showRecognizedTranslationError(
        operation,
        view,
        editor,
        error instanceof Error ? error.message : 'Не удалось перевести распознанный текст.',
      ));
  });
  view.actions.replaceChildren(retry);
  positionCardElement(view.element);
}

async function renderRecognizedTranslation(
  operation: RegionOperation,
  view: CardView,
  editor: HTMLTextAreaElement,
  preparation: Promise<PreparationOutcome>,
  requestId: string,
): Promise<void> {
  const generation = ++view.translationGeneration;
  const text = editor.value.trim();
  if (!text) {
    showRecognizedTranslationError(operation, view, editor, 'Введите текст для перевода.');
    editor.focus();
    return;
  }
  view.status.hidden = false;
  view.status.dataset.kind = '';
  view.status.innerHTML = '<span class="pt-spinner"></span><span>Перевожу распознанный текст…</span>';
  view.translation.hidden = true;
  view.variantGeneration += 1;
  view.variants.hidden = true;
  view.variantsList.replaceChildren();
  view.actions.replaceChildren();
  positionCardElement(view.element);

  let result: TranslationResult;
  try {
    const prepared = await preparation;
    if (regionOperation !== operation || !view.element.isConnected || view.translationGeneration !== generation) return;
    if (!prepared.ok) throw prepared.error;
    result = await engine.translate(text, operation.sourceMode);
  } catch (error) {
    if (regionOperation !== operation || !view.element.isConnected || view.translationGeneration !== generation) return;
    throw error;
  }
  if (regionOperation !== operation || !view.element.isConnected || view.translationGeneration !== generation) return;

  view.status.hidden = true;
  view.translation.hidden = false;
  view.translation.textContent = result.alreadyRussian ? 'Текст уже на русском' : result.translation;
  const copy = makeButton('Копировать');
  copy.addEventListener('click', () => {
    void navigator.clipboard.writeText(result.translation)
      .then(() => showToast('Перевод скопирован'))
      .catch(() => showToast('Не удалось скопировать'));
  });
  const add = makeButton('В словарь', 'pt-button pt-button--primary');
  add.addEventListener('click', () => {
    add.disabled = true;
    void repository.addDictionaryEntry({ original: result.original, translation: result.translation })
      .then(({ added }) => { add.textContent = added ? 'Добавлено ✓' : 'Уже в словаре'; })
      .catch(() => {
        add.disabled = false;
        showToast('Не удалось добавить перевод в словарь');
      });
  });
  const translateAgain = makeButton('Перевести изменения');
  translateAgain.addEventListener('click', () => {
    const nextPreparation = trackedPreparation(operation.sourceMode, (percent) => {
      const label = view.status.querySelector('span:last-child');
      if (label) label.textContent = `Загружаю языковой пакет: ${percent}%`;
    });
    void renderRecognizedTranslation(operation, view, editor, nextPreparation, createRequestId())
      .catch((error) => showRecognizedTranslationError(
        operation,
        view,
        editor,
        error instanceof Error ? error.message : 'Не удалось перевести распознанный текст.',
      ));
  });
  view.actions.append(copy, add, translateAgain);
  positionCardElement(view.element);
  void showAlternativeVariants(view, result).catch(() => undefined);
  const historyResult = await saveSuccessfulTranslation(result, 'ocr-region', requestId);
  if (historyResult.status === 'failed' && view.translationGeneration === generation) {
    showToast('Перевод готов, историю сохранить не удалось');
  }
}

async function recognizeSelectedRegion(
  operation: RegionOperation,
  region: RegionRect,
): Promise<void> {
  await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  if (regionOperation !== operation) return;
  try {
    const request: RegionCaptureRequest = {
      type: 'CAPTURE_REGION',
      requestId: operation.requestId,
      region,
      languages: ocrLanguagesForMode(operation.sourceMode),
    };
    const response = await chrome.runtime.sendMessage<RegionCaptureRequest, RuntimeResponse<OcrRecognitionResult>>(request);
    if (regionOperation !== operation) return;
    if (!response?.ok || !isOcrRecognitionResult(response.data)) {
      throw new Error(response?.error || 'Не удалось распознать текст');
    }
    if (!response.data.text) throw new Error('Текст в выбранной области не найден. Попробуйте выделить его плотнее.');

    const view = showRegionProgress(operation);
    if (!view) return;
    view.element.querySelector<HTMLElement>('.pt-label')!.textContent = 'Распознанный текст';
    const editor = document.createElement('textarea');
    editor.className = 'pt-copy pt-original pt-ocr-editor';
    editor.setAttribute('aria-label', 'Распознанный текст');
    editor.maxLength = 10_000;
    editor.value = response.data.text.slice(0, 10_000);
    view.original.replaceWith(editor);
    view.status.hidden = false;
    view.status.dataset.kind = '';
    view.status.textContent = response.data.text.length > 10_000
      ? 'Распознано · первые 10 000 символов'
      : 'Текст распознан';
    positionCardElement(view.element);
    if (response.data.confidence < 60) {
      showRecognizedTranslationError(operation, view, editor,
        'Не удалось уверенно распознать текст. Проверьте и исправьте его перед переводом или выделите надпись плотнее.',
        'Перевести этот текст');
      return;
    }
    try {
      await renderRecognizedTranslation(
        operation,
        view,
        editor,
        operation.preparation,
        operation.requestId,
      );
    } catch (error) {
      showRecognizedTranslationError(
        operation,
        view,
        editor,
        error instanceof Error ? error.message : 'Не удалось перевести распознанный текст.',
      );
    }
  } catch (error) {
    if (regionOperation !== operation) return;
    showRegionError(
      operation,
      error instanceof Error ? error.message : 'Не удалось распознать и перевести область.',
    );
  }
}

function startRegionSelection(): void {
  removeSelectionButton();
  closeCard();
  dismissPagePrompt();
  removeRegionOverlay(false);
  regionOperation = undefined;
  regionPreviousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : undefined;

  const overlay = document.createElement('div');
  overlay.className = 'pt-region-overlay';
  overlay.tabIndex = -1;
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', 'Выбор области для распознавания текста');
  overlay.setAttribute('aria-describedby', 'pt-region-instructions');
  overlay.innerHTML = `
    <div class="pt-region-help" id="pt-region-instructions"><div><strong>Выделите текст или картинку</strong><span>Проведите мышью по нужной области · Esc — отмена</span></div><button type="button" class="pt-region-cancel">Отмена</button></div>
    <div class="pt-region-box" hidden><span aria-hidden="true"></span></div>`;
  const box = overlay.querySelector<HTMLDivElement>('.pt-region-box')!;
  const sizeLabel = box.querySelector<HTMLSpanElement>('span')!;
  const hint = overlay.querySelector<HTMLSpanElement>('.pt-region-help span')!;
  const cancel = overlay.querySelector<HTMLButtonElement>('.pt-region-cancel')!;
  overlay.addEventListener('keydown', (event) => {
    if (event.key !== 'Tab') return;
    event.preventDefault();
    cancel.focus({ preventScroll: true });
  });
  let start: { x: number; y: number } | undefined;
  let pointerId: number | undefined;

  const draw = (x: number, y: number) => {
    if (!start) return;
    const left = Math.min(start.x, x);
    const top = Math.min(start.y, y);
    box.style.left = `${left}px`;
    box.style.top = `${top}px`;
    box.style.width = `${Math.abs(x - start.x)}px`;
    box.style.height = `${Math.abs(y - start.y)}px`;
    sizeLabel.textContent = `${Math.round(Math.abs(x - start.x))} × ${Math.round(Math.abs(y - start.y))}`;
  };
  cancel.addEventListener('pointerdown', (event) => event.stopPropagation());
  cancel.addEventListener('click', () => removeRegionOverlay());
  overlay.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    event.preventDefault();
    pointerId = event.pointerId;
    start = { x: event.clientX, y: event.clientY };
    box.hidden = false;
    overlay.setPointerCapture(event.pointerId);
    draw(event.clientX, event.clientY);
  });
  overlay.addEventListener('pointermove', (event) => {
    if (event.pointerId === pointerId) draw(event.clientX, event.clientY);
  });
  overlay.addEventListener('pointerup', (event) => {
    if (!start || event.pointerId !== pointerId) return;
    const region = normalizeRegionSelection(start, { x: event.clientX, y: event.clientY }, {
      width: window.innerWidth,
      height: window.innerHeight,
    });
    pointerId = undefined;
    start = undefined;
    if (!region) {
      box.hidden = true;
      hint.textContent = 'Область слишком мала — выделите прямоугольник побольше · Esc — отмена';
      return;
    }
    const sourceMode = settings.sourceMode;
    const requestId = createRequestId();
    const operation: RegionOperation = {
      requestId,
      sourceMode,
      preparation: trackedPreparation(sourceMode),
    };
    regionOperation = operation;
    removeRegionOverlay(false);
    void recognizeSelectedRegion(operation, region);
  });
  ensureLayer().append(overlay);
  regionOverlay = overlay;
  overlay.focus({ preventScroll: true });
}

function setPageStatus(status: PageStatus): void {
  pageStatus = status;
  void chrome.runtime.sendMessage({ type: 'PAGE_STATUS_CHANGED', status }).catch(() => undefined);
}

function dismissPagePrompt(): void {
  pagePrompt?.remove();
  pagePrompt = undefined;
}

function showPagePrompt(targetLanguage: PageTargetLanguage): void {
  const operationId = ++pageOperationId;
  pageAbort?.abort();
  pageSession.restore();
  dismissPagePrompt();
  const prompt = document.createElement('div');
  prompt.className = 'pt-page-prompt';
  prompt.innerHTML = `
    <span class="pt-card-mark">${poopSvg}</span>
    <div><strong>Перевести страницу на ${targetLanguage === 'ru' ? 'русский' : 'английский'}?</strong><span>Нажатие разрешит Chrome подготовить локальный переводчик.</span></div>
    <div class="pt-page-prompt__buttons"></div>`;
  const buttons = prompt.querySelector<HTMLDivElement>('.pt-page-prompt__buttons')!;
  const cancel = makeButton('Не сейчас');
  const start = makeButton('Начать', 'pt-button pt-button--primary');
  cancel.addEventListener('click', () => {
    dismissPagePrompt();
    if (operationId === pageOperationId) setPageStatus({ state: 'idle', completed: 0, total: 0 });
  });
  start.addEventListener('click', () => {
    const session = new PageTranslationSession();
    const controller = new AbortController();
    pageSession = session;
    pageAbort = controller;
    // Start model creation before the first await to preserve activation.
    const preparation = engine.prepareForPageTarget(targetLanguage, {
      onProgress(percent) {
        if (operationId === pageOperationId) {
          setPageStatus({ state: 'translating', completed: percent, total: 100 });
        }
      },
    });
    dismissPagePrompt();
    void runPageTranslation(targetLanguage, preparation, operationId, session, controller);
  });
  buttons.append(cancel, start);
  ensureLayer().append(prompt);
  pagePrompt = prompt;
  setPageStatus({ state: 'awaiting-activation', completed: 0, total: 0 });
}

async function runPageTranslation(
  targetLanguage: PageTargetLanguage,
  preparation: Promise<void>,
  operationId: number,
  session: PageTranslationSession,
  controller: AbortController,
): Promise<void> {
  setPageStatus({ state: 'translating', completed: 0, total: 0 });
  try {
    await preparation;
    if (operationId !== pageOperationId || controller.signal.aborted) return;
    const summary = await session.translate(
      findMainContent(),
      async (text) => engine.translatePageText(text, targetLanguage),
      (completed, total) => {
        if (operationId === pageOperationId) setPageStatus({ state: 'translating', completed, total });
      },
      controller.signal,
    );
    if (operationId !== pageOperationId) return;
    setPageStatus({
      state: 'translated',
      completed: summary.completed,
      total: summary.total,
      error: summary.failed ? `Не удалось перевести фрагментов: ${summary.failed}` : undefined,
    });
    showToast(summary.failed ? 'Страница переведена частично' : 'Страница переведена');
  } catch (error) {
    if (operationId !== pageOperationId || (error instanceof DOMException && error.name === 'AbortError')) return;
    setPageStatus({
      state: 'error',
      completed: pageStatus.completed,
      total: pageStatus.total,
      error: error instanceof Error ? error.message : 'Не удалось перевести страницу.',
    });
    showToast(pageStatus.error ?? 'Не удалось перевести страницу');
  }
}

function restorePage(): PageStatus {
  pageOperationId += 1;
  pageAbort?.abort();
  dismissPagePrompt();
  const restored = pageSession.restore();
  pageStatus = { state: 'idle', completed: 0, total: 0 };
  showToast(restored ? 'Оригинал возвращён' : 'Страница уже в оригинале');
  return pageStatus;
}

function selectionIsEditable(selection: Selection): boolean {
  const node = selection.anchorNode;
  const element = node instanceof Element ? node : node?.parentElement;
  return Boolean(element?.closest('input, textarea, [contenteditable]:not([contenteditable="false"])'));
}

document.addEventListener('mouseup', (event) => {
  if (host && event.composedPath().includes(host)) return;
  window.setTimeout(() => {
    const selection = window.getSelection();
    if (!settings.showSelectionButton || !selection || selection.isCollapsed || selectionIsEditable(selection)) {
      removeSelectionButton();
      return;
    }
    const text = selection.toString().trim();
    if (!text) {
      removeSelectionButton();
      return;
    }
    const range = selection.rangeCount ? selection.getRangeAt(0) : undefined;
    const rect = range?.getBoundingClientRect();
    if (!rect || (!rect.width && !rect.height)) return;
    selectedText = text;
    selectedRect = rect;
    showSelectionButton(rect);
  }, 0);
});

document.addEventListener('pointerdown', (event) => {
  if (host && event.composedPath().includes(host)) return;
  removeSelectionButton();
  closeCard();
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    removeSelectionButton();
    closeCard();
    dismissPagePrompt();
    regionOperation = undefined;
    removeRegionOverlay();
  }
});

window.addEventListener('scroll', removeSelectionButton, { passive: true });

chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
  if (!isContentRequest(message)) return false;
  const respond = (response: RuntimeResponse<PageStatus>) => sendResponse(response);
  try {
    switch (message.type) {
      case 'START_REGION_SELECTION':
        startRegionSelection();
        respond({ ok: true, data: pageStatus });
        return false;
      case 'REGION_OCR_STARTED':
        if (regionOperation?.requestId === message.requestId) showRegionProgress(regionOperation);
        respond({ ok: true, data: pageStatus });
        return false;
      case 'SHOW_SELECTION_TRANSLATOR':
        void showTranslationCard(message.text, undefined, 'context-menu', false, message.requestId, message.sourceMode)
          .then(() => respond({ ok: true, data: pageStatus }))
          .catch((error) => respond({ ok: false, error: String(error) }));
        return true;
      case 'TRANSLATE_PAGE':
        showPagePrompt(message.targetLanguage);
        respond({ ok: true, data: pageStatus });
        return false;
      case 'RESTORE_PAGE':
        respond({ ok: true, data: restorePage() });
        return false;
      case 'GET_PAGE_STATUS':
        respond({ ok: true, data: pageStatus });
        return false;
    }
  } catch (error) {
    respond({ ok: false, error: error instanceof Error ? error.message : String(error) });
  }
  return false;
});

void repository.loadState().then((state) => {
  settings = state.settings;
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== 'local' || !changes[STORAGE_KEY]) return;
  void repository.loadState().then((state) => {
    settings = state.settings;
    if (host) host.dataset.textScale = String(settings.textScale);
    if (!settings.showSelectionButton) removeSelectionButton();
  });
});

void createRequestId();
