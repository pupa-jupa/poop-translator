import contentStyles from './content.css?inline';
import { lookupAlternativeVariants } from './core/dictionary-client';
import { placeFloatingCard } from './core/floating-card';
import { PageTranslationSession, findMainContent } from './core/page-translation';
import { STORAGE_KEY } from './core/storage';
import { getStorageClient } from './core/storage-client';
import { persistTranslationHistory, type HistoryPersistenceResult } from './core/translation-history';
import { ChromeTranslator } from './core/translator';
import { translateFromUserActivation } from './core/user-activated-translation';
import { createRequestId, isContentRequest, type PageStatus, type RuntimeResponse } from './shared/messages';
import type { DictionaryVariant, Settings, SourceMode, TranslationResult, TranslationSource } from './shared/types';

const engine = new ChromeTranslator();
const repository = getStorageClient();
let settings: Settings = { sourceMode: 'en', saveHistory: true, showSelectionButton: true, textScale: 115 };
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
  card?.remove();
  card = undefined;
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
    <div class="pt-status" role="status" aria-live="polite"><span class="pt-spinner"></span><span>Готовлю переводчик…</span></div>
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
  const variants = await lookupAlternativeVariants(result.original, result.translation, result.sourceLanguage);
  if (!view.element.isConnected || card !== view.element || !variants.length) return;
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
  const view = cardShell(text, rect);

  const run = async () => {
    view.status.hidden = false;
    view.status.dataset.kind = '';
    view.status.innerHTML = '<span class="pt-spinner"></span><span>Готовлю переводчик…</span>';
    view.translation.hidden = true;
    view.actions.replaceChildren();
    try {
      const result = await translateFromUserActivation(engine, text, sourceMode, {
        onProgress(percent) {
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
          .then(() => {
            showToast('Скопировано');
            copy.textContent = 'Скопировано ✓';
            setTimeout(() => { if (copy.textContent === 'Скопировано ✓') copy.textContent = 'Копировать'; }, 1500);
          })
          .catch(() => showToast('Не удалось скопировать'));
      });
      const add = makeButton('В словарь', 'pt-button pt-button--primary');
      add.addEventListener('click', () => {
        add.disabled = true;
        void repository.addDictionaryEntry({
          original: result.original,
          translation: result.translation,
        }).then((added) => {
          add.textContent = added.added ? '♥ Сохранено' : 'Уже в словаре';
          setTimeout(() => { if (add.textContent === '♥ Сохранено' || add.textContent === 'Уже в словаре') add.textContent = 'В словарь'; }, 1500);
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

function setPageStatus(status: PageStatus): void {
  pageStatus = status;
  void chrome.runtime.sendMessage({ type: 'PAGE_STATUS_CHANGED', status }).catch(() => undefined);
}

function dismissPagePrompt(): void {
  pagePrompt?.remove();
  pagePrompt = undefined;
}

function showPagePrompt(sourceMode: SourceMode): void {
  const operationId = ++pageOperationId;
  pageAbort?.abort();
  pageSession.restore();
  dismissPagePrompt();
  const prompt = document.createElement('div');
  prompt.className = 'pt-page-prompt';
  prompt.innerHTML = `
    <span class="pt-card-mark">${poopSvg}</span>
    <div><strong>Перевести эту страницу?</strong><span>Нажатие разрешит Chrome подготовить локальный переводчик.</span></div>
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
    const preparation = engine.prepareForMode(sourceMode, {
      onProgress(percent) {
        if (operationId === pageOperationId) {
          setPageStatus({ state: 'translating', completed: percent, total: 100 });
        }
      },
    });
    dismissPagePrompt();
    void runPageTranslation(sourceMode, preparation, operationId, session, controller);
  });
  buttons.append(cancel, start);
  ensureLayer().append(prompt);
  pagePrompt = prompt;
  setPageStatus({ state: 'awaiting-activation', completed: 0, total: 0 });
}

async function runPageTranslation(
  sourceMode: SourceMode,
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
      async (text) => (await engine.translate(text, sourceMode)).translation,
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
  }
});

window.addEventListener('scroll', removeSelectionButton, { passive: true });

chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
  if (!isContentRequest(message)) return false;
  const respond = (response: RuntimeResponse<PageStatus>) => sendResponse(response);
  try {
    switch (message.type) {
      case 'SHOW_SELECTION_TRANSLATOR':
        void showTranslationCard(message.text, undefined, 'context-menu', false, message.requestId, message.sourceMode)
          .then(() => respond({ ok: true, data: pageStatus }))
          .catch((error) => respond({ ok: false, error: String(error) }));
        return true;
      case 'TRANSLATE_PAGE':
        showPagePrompt(message.sourceMode);
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
