import contentStyles from './content.css?inline';
import { PageTranslationSession, findMainContent } from './core/page-translation';
import { getStorageRepository, STORAGE_KEY } from './core/storage';
import { ChromeTranslator, TranslationEngineError } from './core/translator';
import { createRequestId, isContentRequest, type PageStatus, type RuntimeResponse } from './shared/messages';
import type { Settings, SourceMode, TranslationResult, TranslationSource } from './shared/types';

const engine = new ChromeTranslator();
const repository = getStorageRepository();
let settings: Settings = { sourceMode: 'en', saveHistory: true, showSelectionButton: true };
let host: HTMLDivElement | undefined;
let layer: HTMLDivElement | undefined;
let selectionButton: HTMLButtonElement | undefined;
let card: HTMLDivElement | undefined;
let pagePrompt: HTMLDivElement | undefined;
let selectedText = '';
let selectedRect: DOMRect | undefined;
let pageSession = new PageTranslationSession();
let pageAbort: AbortController | undefined;
let pageStatus: PageStatus = { state: 'idle', completed: 0, total: 0 };

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

function pointForCard(rect?: DOMRect): { left: number; top: number } {
  const width = Math.min(350, window.innerWidth - 24);
  const left = clamp(rect ? rect.left : (window.innerWidth - width) / 2, 12, window.innerWidth - width - 12);
  const preferredTop = rect ? rect.bottom + 10 : Math.max(12, (window.innerHeight - 300) / 2);
  return { left, top: clamp(preferredTop, 12, window.innerHeight - 280) };
}

function removeSelectionButton(): void {
  selectionButton?.remove();
  selectionButton = undefined;
}

function closeCard(): void {
  card?.remove();
  card = undefined;
}

function showToast(message: string): void {
  const toast = document.createElement('div');
  toast.className = 'pt-toast';
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
  actions: HTMLDivElement;
} {
  closeCard();
  const point = pointForCard(rect);
  const element = document.createElement('div');
  element.className = 'pt-card';
  element.setAttribute('role', 'dialog');
  element.setAttribute('aria-label', 'Перевод');
  element.style.setProperty('--pt-left', `${point.left}px`);
  element.style.setProperty('--pt-top', `${point.top}px`);
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
    <div class="pt-status"><span class="pt-spinner"></span><span>Готовлю переводчик…</span></div>
    <p class="pt-copy pt-translation" hidden></p>
    <div class="pt-actions"></div>`;
  element.querySelector<HTMLParagraphElement>('.pt-original')!.textContent = original;
  element.querySelector<HTMLButtonElement>('.pt-icon-button')!.addEventListener('click', closeCard);
  element.addEventListener('pointerdown', (event) => event.stopPropagation());
  ensureLayer().append(element);
  card = element;
  return {
    element,
    status: element.querySelector<HTMLDivElement>('.pt-status')!,
    translation: element.querySelector<HTMLParagraphElement>('.pt-translation')!,
    actions: element.querySelector<HTMLDivElement>('.pt-actions')!,
  };
}

async function saveSuccessfulTranslation(
  result: TranslationResult,
  source: TranslationSource,
  requestId: string,
): Promise<void> {
  if (result.alreadyRussian) return;
  await repository.addHistory({
    requestId,
    original: result.original,
    translation: result.translation,
    sourceLanguage: result.sourceLanguage,
    targetLanguage: 'ru',
    source,
  });
}

async function showTranslationCard(
  text: string,
  rect: DOMRect | undefined,
  source: TranslationSource,
  userActivated: boolean,
  requestId = createRequestId(),
): Promise<void> {
  const view = cardShell(text, rect);

  const run = async () => {
    view.status.dataset.kind = '';
    view.status.innerHTML = '<span class="pt-spinner"></span><span>Готовлю переводчик…</span>';
    view.actions.replaceChildren();
    try {
      const result = await engine.translate(text, settings.sourceMode, {
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
        void navigator.clipboard.writeText(result.translation).then(() => showToast('Скопировано'));
      });
      const add = makeButton('В словарь', 'pt-button pt-button--primary');
      add.addEventListener('click', async () => {
        const added = await repository.addDictionaryEntry({
          original: result.original,
          translation: result.translation,
        });
        add.textContent = added.added ? 'Добавлено ✓' : 'Уже в словаре';
        add.disabled = true;
      });
      if (!result.alreadyRussian) view.actions.append(copy, add);
      await saveSuccessfulTranslation(result, source, requestId);
    } catch (error) {
      if (!view.element.isConnected) return;
      const message = error instanceof Error ? error.message : 'Не удалось выполнить перевод.';
      view.status.dataset.kind = 'error';
      view.status.replaceChildren(document.createTextNode(message));
      const retry = makeButton('Повторить', 'pt-button pt-button--primary');
      retry.addEventListener('click', () => void run());
      view.actions.replaceChildren(retry);
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
    setPageStatus({ state: 'idle', completed: 0, total: 0 });
  });
  start.addEventListener('click', () => {
    // Start model creation before the first await to preserve activation.
    const preparation = engine.prepare('en', {
      onProgress(percent) {
        setPageStatus({ state: 'translating', completed: percent, total: 100 });
      },
    });
    dismissPagePrompt();
    void runPageTranslation(sourceMode, preparation);
  });
  buttons.append(cancel, start);
  ensureLayer().append(prompt);
  pagePrompt = prompt;
  setPageStatus({ state: 'awaiting-activation', completed: 0, total: 0 });
}

async function runPageTranslation(sourceMode: SourceMode, preparation: Promise<void>): Promise<void> {
  pageAbort?.abort();
  pageSession.restore();
  pageSession = new PageTranslationSession();
  pageAbort = new AbortController();
  setPageStatus({ state: 'translating', completed: 0, total: 0 });
  try {
    await preparation;
    const summary = await pageSession.translate(
      findMainContent(),
      async (text) => (await engine.translate(text, sourceMode)).translation,
      (completed, total) => setPageStatus({ state: 'translating', completed, total }),
      pageAbort.signal,
    );
    setPageStatus({
      state: 'translated',
      completed: summary.completed,
      total: summary.total,
      error: summary.failed ? `Не удалось перевести фрагментов: ${summary.failed}` : undefined,
    });
    showToast(summary.failed ? 'Страница переведена частично' : 'Страница переведена');
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return;
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
  return Boolean(element?.closest('input, textarea, [contenteditable=""], [contenteditable="true"]'));
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
        void showTranslationCard(message.text, undefined, 'context-menu', false, message.requestId)
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
    if (!settings.showSelectionButton) removeSelectionButton();
  });
});

void createRequestId();
