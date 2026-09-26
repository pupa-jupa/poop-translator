import './popup.css';
import { lookupAlternativeVariants } from '../core/dictionary-client';
import { dueCards } from '../core/review';
import { createBackup, DEFAULT_STATE, STORAGE_KEY } from '../core/storage';
import { getStorageClient } from '../core/storage-client';
import { persistTranslationHistory } from '../core/translation-history';
import { ChromeTranslator } from '../core/translator';
import { languageDefinition } from '../core/languages';
import { beginTranslationFromUserActivation, type TranslationAttempt } from '../core/user-activated-translation';
import { createRequestId, type PageStatus, type RuntimeResponse } from '../shared/messages';
import type { DictionaryEntry, DictionaryVariant, ExtensionState, HistoryEntry, OcrMode, SourceMode, TargetLanguage, TextScale, TranslationResult } from '../shared/types';
import { activateTab, mountPopupShell, type PopupTab } from './ui';

const root = document.querySelector<HTMLDivElement>('#app')!;
mountPopupShell(root);

if (navigator.userAgent.includes('Mac')) {
  const enterHint = root.querySelector<HTMLElement>('.enter-hint');
  if (enterHint) enterHint.textContent = '⌘ + Enter';
}

function required<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Missing UI element: ${selector}`);
  return element;
}

const repository = getStorageClient();
const engine = new ChromeTranslator();
let state: ExtensionState = structuredClone(DEFAULT_STATE);
let latestResult: TranslationResult | undefined;
let toastTimer = 0;
let translationBusy = false;
let translationOperation = 0;
let engineStatusOperation = 0;
let revealedReviewId: string | undefined;
let reviewBusy = false;
let stateRefreshVersion = 0;
let languageSettingsOperation = 0;
let pendingTranslationActivation: Extract<TranslationAttempt, { status: 'needs-activation' }> & { key: string } | undefined;

const sourceText = required<HTMLTextAreaElement>('#source-text');
const charCount = required<HTMLElement>('[data-char-count]');
const translateForm = required<HTMLFormElement>('[data-form="translate"]');
const translateButton = translateForm.querySelector<HTMLButtonElement>('button[type="submit"]')!;
const sourceMode = required<HTMLSelectElement>('[data-control="source-mode"]');
const settingsSourceMode = required<HTMLSelectElement>('[data-control="settings-source-mode"]');
const targetLanguage = required<HTMLSelectElement>('[data-control="target-language"]');
const settingsTargetLanguage = required<HTMLSelectElement>('[data-control="settings-target-language"]');
const settingsOcrMode = required<HTMLSelectElement>('[data-control="settings-ocr-mode"]');
const pageTargetLanguage = required<HTMLSelectElement>('[data-control="page-target-language"]');
const pageSourceLanguage = required<HTMLSelectElement>('[data-control="page-source-language"]');
pageSourceLanguage.value = 'auto';
const saveHistory = required<HTMLInputElement>('[data-control="save-history"]');
const selectionButtonSetting = required<HTMLInputElement>('[data-control="selection-button"]');
const textScale = required<HTMLSelectElement>('[data-control="text-scale"]');
const importFile = required<HTMLInputElement>('[data-import-file]');
const resultCard = required<HTMLElement>('[data-result]');
const resultOriginal = required<HTMLElement>('[data-result-original]');
const resultTranslation = required<HTMLElement>('[data-result-translation]');
const resultLanguage = required<HTMLElement>('[data-result-language]');
const resultVariants = required<HTMLElement>('[data-result-variants]');
const resultVariantsList = required<HTMLElement>('[data-result-variants-list]');
const translateError = required<HTMLElement>('[data-translate-error]');
const enginePill = required<HTMLElement>('[data-engine-status]');
const engineDetail = required<HTMLElement>('[data-engine-detail]');
const historyList = required<HTMLElement>('[data-history-list]');
const dictionaryList = required<HTMLElement>('[data-dictionary-list]');
const reviewList = required<HTMLElement>('[data-review-list]');
const reviewDue = required<HTMLElement>('[data-review-due]');
const reviewHeading = required<HTMLElement>('#panel-review h2');
const historySearch = required<HTMLInputElement>('[data-search="history"]');
const dictionarySearch = required<HTMLInputElement>('[data-search="dictionary"]');
const pageStatusLabel = required<HTMLElement>('[data-page-status]');
const wordDialog = required<HTMLDialogElement>('[data-word-modal]');
const wordForm = required<HTMLFormElement>('[data-form="word"]');
const wordId = required<HTMLInputElement>('[data-word-id]');
const wordOriginal = required<HTMLInputElement>('[data-word-original]');
const wordTranslation = required<HTMLInputElement>('[data-word-translation]');
const wordNote = required<HTMLTextAreaElement>('[data-word-note]');
const wordTitle = required<HTMLElement>('[data-word-modal-title]');
const confirmDialog = required<HTMLDialogElement>('[data-confirm-modal]');
const confirmTitle = required<HTMLElement>('[data-confirm-title]');
const confirmText = required<HTMLElement>('[data-confirm-text]');
const toast = required<HTMLElement>('[data-toast]');

function showToast(message: string): void {
  window.clearTimeout(toastTimer);
  toast.textContent = message;
  toast.hidden = false;
  toastTimer = window.setTimeout(() => { toast.hidden = true; }, 1900);
}

function setBusy(busy: boolean, label = 'Перевести'): void {
  translateButton.disabled = busy;
  translateButton.querySelector('span')!.textContent = busy ? 'Перевожу…' : label;
}

function invalidateManualTranslation(): void {
  translationOperation += 1;
  pendingTranslationActivation = undefined;
  translationBusy = false;
  setBusy(false);
  latestResult = undefined;
  resultCard.hidden = true;
  resultVariants.hidden = true;
  resultVariantsList.replaceChildren();
  translateError.hidden = true;
}

function syncSettingsControls(): void {
  sourceMode.value = state.settings.sourceMode;
  settingsSourceMode.value = state.settings.sourceMode;
  targetLanguage.value = state.settings.targetLanguage;
  settingsTargetLanguage.value = state.settings.targetLanguage;
  pageTargetLanguage.value = state.settings.pageTargetLanguage;
  settingsOcrMode.value = state.settings.ocrMode;
  saveHistory.checked = state.settings.saveHistory;
  selectionButtonSetting.checked = state.settings.showSelectionButton;
  textScale.value = String(state.settings.textScale);
  document.documentElement.dataset.textScale = String(state.settings.textScale);
}

function sourceLabel(entry: HistoryEntry): string {
  const labels = {
    manual: 'вручную', selection: 'выделение', 'context-menu': 'контекстное меню', 'ocr-region': 'область экрана',
  } as const;
  return labels[entry.source];
}

function formattedDate(timestamp: number): string {
  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  }).format(timestamp);
}

function emptyState(icon: string, title: string, description: string): HTMLElement {
  const element = document.createElement('div');
  element.className = 'empty-state';
  element.innerHTML = `<div class="empty-state__face"></div><strong></strong><p></p>`;
  element.querySelector('.empty-state__face')!.textContent = icon;
  element.querySelector('strong')!.textContent = title;
  element.querySelector('p')!.textContent = description;
  return element;
}

function miniButton(label: string, action: () => void | Promise<void>): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'mini-action';
  button.textContent = label;
  button.addEventListener('click', () => void action());
  return button;
}

function renderHistory(): void {
  const query = historySearch.value.trim().toLocaleLowerCase();
  const entries = state.history.filter((entry) => (
    !query || entry.original.toLocaleLowerCase().includes(query) || entry.translation.toLocaleLowerCase().includes(query)
  ));
  historyList.replaceChildren();
  if (!entries.length) {
    historyList.append(emptyState('◷', query ? 'Ничего не нашлось' : 'Пока пусто', query
      ? 'Попробуйте другой запрос.'
      : 'Ваши ручные переводы и переводы выделений появятся здесь.'));
    return;
  }
  for (const entry of entries) {
    const card = document.createElement('article');
    card.className = 'item-card';
    card.innerHTML = `
      <div class="item-main"><p></p><span class="item-arrow" aria-hidden="true">→</span><p></p></div>
      <div class="item-meta"><span></span><div class="item-buttons"></div></div>`;
    const paragraphs = card.querySelectorAll('p');
    paragraphs[0]!.textContent = entry.original;
    paragraphs[1]!.textContent = entry.translation;
    card.querySelector<HTMLElement>('.item-meta > span')!.textContent = `${sourceLabel(entry)} · ${formattedDate(entry.createdAt)}`;
    const buttons = card.querySelector<HTMLElement>('.item-buttons')!;
    buttons.append(
      miniButton('♡ В словарь', async () => {
        const result = await repository.addDictionaryEntry(entry);
        await refreshState();
        showToast(result.added ? 'Добавлено в словарь' : 'Уже в словаре');
      }),
      miniButton('Удалить', async () => {
        await repository.removeHistoryEntry(entry.id);
        await refreshState();
      }),
    );
    historyList.append(card);
  }
}

function openWordDialog(entry?: DictionaryEntry): void {
  wordId.value = entry?.id ?? '';
  wordOriginal.value = entry?.original ?? '';
  wordTranslation.value = entry?.translation ?? '';
  wordNote.value = entry?.note ?? '';
  wordTitle.textContent = entry ? 'Изменить запись' : 'Новое слово';
  wordDialog.showModal();
  window.setTimeout(() => wordOriginal.focus(), 0);
}

function renderDictionary(): void {
  const query = dictionarySearch.value.trim().toLocaleLowerCase();
  const entries = state.dictionary.filter((entry) => (
    !query
    || entry.original.toLocaleLowerCase().includes(query)
    || entry.translation.toLocaleLowerCase().includes(query)
    || entry.note.toLocaleLowerCase().includes(query)
  ));
  dictionaryList.replaceChildren();
  if (!entries.length) {
    dictionaryList.append(emptyState('♡', query ? 'Ничего не нашлось' : 'Ваш словарь ждёт', query
      ? 'Проверьте написание или заметку.'
      : 'Добавляйте сюда полезные слова и фразы одним нажатием.'));
    return;
  }
  for (const entry of entries) {
    const card = document.createElement('article');
    card.className = 'item-card';
    card.innerHTML = `
      <div class="item-main"><p></p><span class="item-arrow" aria-hidden="true">→</span><p></p></div>
      <div class="item-meta"><span></span><div class="item-buttons"></div></div>`;
    const paragraphs = card.querySelectorAll('p');
    paragraphs[0]!.textContent = entry.original;
    paragraphs[1]!.textContent = entry.translation;
    card.querySelector<HTMLElement>('.item-meta > span')!.textContent = entry.note || formattedDate(entry.updatedAt);
    card.querySelector<HTMLElement>('.item-buttons')!.append(
      miniButton('Изменить', () => openWordDialog(entry)),
      miniButton('Удалить', async () => {
        await repository.removeDictionaryEntry(entry.id);
        await refreshState();
      }),
    );
    dictionaryList.append(card);
  }
}

function renderReview(): void {
  const due = dueCards(state, Date.now());
  const dueText = `${due.length} сейчас`;
  const entry = due[0];
  const current = reviewList.querySelector<HTMLElement>('[data-review-card]');
  if (entry && current?.dataset.reviewCard === entry.id && reviewDue.textContent === dueText
    && current.querySelector('.review-question')?.textContent === entry.original
    && current.querySelector('.review-answer p')?.textContent === entry.translation
    && current.querySelector<HTMLElement>('.review-answer')?.hidden === (revealedReviewId !== entry.id)) {
    return;
  }
  reviewDue.textContent = dueText;
  reviewList.replaceChildren();
  if (!entry) {
    revealedReviewId = undefined;
    if (!state.dictionary.length) {
      reviewList.append(emptyState('♡', 'Слов пока нет', 'Добавьте первую пару в словарь, чтобы начать повторение.'));
      const add = miniButton('Открыть словарь', () => {
        activateTab(root, 'dictionary');
        required<HTMLButtonElement>('[data-action="add-word"]').focus();
      });
      add.className = 'button button--accent review-empty-action';
      reviewList.append(add);
    } else {
      const next = Math.min(...state.review.map((item) => item.dueAt));
      reviewList.append(emptyState('✿', 'Все карточки пройдены',
        Number.isFinite(next) ? `Следующее повторение: ${formattedDate(next)}.` : 'Загляните позже.'));
    }
    return;
  }

  const card = document.createElement('article');
  card.className = 'review-card';
  card.dataset.reviewCard = entry.id;
  const kicker = document.createElement('span');
  kicker.className = 'section-kicker';
  kicker.textContent = 'Как это переводится?';
  const question = document.createElement('p');
  question.className = 'review-question';
  question.textContent = entry.original;
  const reveal = document.createElement('button');
  reveal.type = 'button';
  reveal.className = 'button button--accent review-reveal';
  reveal.dataset.reviewReveal = '';
  reveal.textContent = 'Показать перевод';
  const answer = document.createElement('div');
  answer.className = 'review-answer';
  answer.hidden = revealedReviewId !== entry.id;
  const answerLabel = document.createElement('span');
  answerLabel.className = 'section-kicker';
  answerLabel.textContent = 'Ответ';
  const translation = document.createElement('p');
  translation.textContent = entry.translation;
  answer.append(answerLabel, translation);
  const actions = document.createElement('div');
  actions.className = 'review-actions';
  actions.hidden = answer.hidden;
  const ratings = [
    ['again', 'Повторить', 'через 10 минут'],
    ['hard', 'Сложно', 'завтра'],
    ['good', 'Знаю', 'дольше'],
  ] as const;
  for (const [rating, label, hint] of ratings) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'review-rating';
    button.dataset.reviewRating = rating;
    const title = document.createElement('strong');
    title.textContent = label;
    const detail = document.createElement('small');
    detail.textContent = hint;
    button.append(title, detail);
    button.disabled = reviewBusy;
    button.addEventListener('click', () => {
      if (reviewBusy) return;
      reviewBusy = true;
      stateRefreshVersion += 1;
      actions.querySelectorAll<HTMLButtonElement>('button').forEach((item) => { item.disabled = true; });
      void (async () => {
        let progress;
        try {
          progress = await repository.rateReview(entry.id, rating);
        } catch (error) {
          reviewBusy = false;
          stateRefreshVersion += 1;
          renderReview();
          reviewList.querySelectorAll<HTMLButtonElement>('[data-review-rating]')
            .forEach((item) => { item.disabled = false; });
          const retry = reviewList.querySelector<HTMLButtonElement>(`[data-review-rating="${rating}"]`);
          if (retry) retry.focus();
          else {
            reviewHeading.tabIndex = -1;
            reviewHeading.focus();
          }
          showToast(error instanceof Error ? error.message : 'Не удалось сохранить повторение');
          void refreshState().catch(() => undefined);
          return;
        }
        revealedReviewId = undefined;
        reviewBusy = false;
        stateRefreshVersion += 1;
        state.review = [...state.review.filter((item) => item.dictionaryId !== entry.id), progress];
        try {
          renderReview();
          showToast(`Повторим: ${formattedDate(progress.dueAt)}`);
          const next = reviewList.querySelector<HTMLButtonElement>('[data-review-reveal]');
          if (next) next.focus();
          else {
            reviewHeading.tabIndex = -1;
            reviewHeading.focus();
          }
          void refreshState().catch(() => undefined);
        } catch {
          showToast('Повторение сохранено. Откройте карточки снова.');
        }
      })();
    });
    actions.append(button);
  }
  reveal.hidden = !answer.hidden;
  reveal.addEventListener('click', () => {
    revealedReviewId = entry.id;
    reveal.hidden = true;
    answer.hidden = false;
    actions.hidden = false;
    actions.querySelector<HTMLButtonElement>('button')?.focus();
  });
  card.append(kicker, question, reveal, answer, actions);
  reviewList.append(card);
}

async function refreshState(): Promise<void> {
  const version = ++stateRefreshVersion;
  const loaded = await repository.loadState();
  if (version !== stateRefreshVersion || reviewBusy) return;
  state = loaded;
  syncSettingsControls();
  renderHistory();
  renderDictionary();
  if (!reviewBusy) renderReview();
}

async function updateSourceMode(mode: SourceMode): Promise<void> {
  const currentTarget = targetLanguage.value as TargetLanguage;
  const target = mode !== 'auto' && mode === currentTarget
    ? mode === 'ru' ? 'en' : 'ru'
    : currentTarget;
  await persistLanguageSettings(mode, target);
}

async function updateTargetLanguage(target: TargetLanguage): Promise<void> {
  const currentMode = sourceMode.value as SourceMode;
  const mode = currentMode === target ? 'auto' : currentMode;
  await persistLanguageSettings(mode, target);
}

async function persistLanguageSettings(mode: SourceMode, target: TargetLanguage): Promise<void> {
  invalidateManualTranslation();
  const operation = ++languageSettingsOperation;
  stateRefreshVersion += 1;
  state = {
    ...state,
    settings: { ...state.settings, sourceMode: mode, targetLanguage: target },
  };
  syncSettingsControls();
  try {
    const saved = await repository.updateSettings({ sourceMode: mode, targetLanguage: target });
    if (operation !== languageSettingsOperation) return;
    state = { ...state, settings: saved };
    syncSettingsControls();
  } catch (error) {
    if (operation === languageSettingsOperation) await refreshState().catch(() => undefined);
    throw error;
  }
}

function partOfSpeechLabel(value?: string): string {
  return ({
    n: 'сущ.', v: 'гл.', adj: 'прил.', adv: 'нареч.', pn: 'имя',
    pronoun: 'мест.', preposition: 'предл.', conjunction: 'союз', interjection: 'межд.',
    proverb: 'посл.', phraseologicalUnit: 'фраза',
  } as Record<string, string>)[value ?? ''] ?? '';
}

function createVariantButton(result: TranslationResult, variant: DictionaryVariant): HTMLButtonElement {
  const button = document.createElement('button');
  button.className = 'result-variant';
  button.type = 'button';
  button.setAttribute('aria-label', `Добавить «${variant.translation}» в словарь`);
  const meaning = document.createElement('span');
  meaning.className = 'result-variant__meaning';
  meaning.textContent = variant.translation;
  const meta = document.createElement('span');
  meta.className = 'result-variant__meta';
  meta.textContent = `${partOfSpeechLabel(variant.partOfSpeech)} ＋`.trim();
  button.append(meaning, meta);
  button.addEventListener('click', () => {
    button.disabled = true;
    void repository.addDictionaryEntry({ original: result.original, translation: variant.translation })
      .then(async ({ added }) => {
        await refreshState();
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

async function renderAlternativeVariants(result: TranslationResult): Promise<void> {
  resultVariants.hidden = true;
  resultVariantsList.replaceChildren();
  if (result.alreadyTarget) return;
  const variants = await lookupAlternativeVariants(
    result.original,
    result.translation,
    result.sourceLanguage,
    result.targetLanguage,
  );
  if (latestResult !== result || !variants.length) return;
  resultVariantsList.append(...variants.map((variant) => createVariantButton(result, variant)));
  resultVariants.hidden = false;
}

function renderTranslationResult(result: TranslationResult): void {
  latestResult = result;
  resultOriginal.textContent = result.original;
  resultTranslation.textContent = result.alreadyTarget ? 'Текст уже на выбранном языке' : result.translation;
  resultLanguage.textContent = `${result.sourceLanguage.toUpperCase()} → ${result.targetLanguage.toUpperCase()}`;
  resultCard.hidden = false;
  required<HTMLButtonElement>('[data-action="save-result"]').disabled = result.alreadyTarget;
  void renderAlternativeVariants(result);
}

async function updateEngineStatus(): Promise<void> {
  const mode = sourceMode.value as SourceMode;
  const target = targetLanguage.value as TargetLanguage;
  const operation = ++engineStatusOperation;
  const availability = mode === 'auto' ? 'available' : await engine.getAvailability(mode, target);
  if (operation !== engineStatusOperation || sourceMode.value !== mode || targetLanguage.value !== target) return;
  enginePill.dataset.state = availability;
  const compact = mode === 'auto' ? 'По запросу' : {
    available: 'Готов', downloadable: 'Нужна загрузка', downloading: 'Загрузка', unavailable: 'Недоступен',
  }[availability];
  const detail = {
    available: mode === 'auto' ? 'Язык определится локально; будет подготовлена только нужная пара.' : 'Языковой пакет готов. Перевод выполняется на устройстве.',
    downloadable: 'Нажмите «Подготовить», чтобы бесплатно скачать языковой пакет.',
    downloading: 'Chrome загружает языковой пакет.',
    unavailable: 'Нужен настольный Google Chrome 138 или новее.',
  }[availability];
  enginePill.querySelector('span:last-child')!.textContent = compact;
  engineDetail.textContent = detail;
}

async function sendToActiveTab<T>(message: unknown): Promise<RuntimeResponse<T>> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !tab.url?.match(/^https?:\/\//)) {
    throw new Error('На этой странице перевод недоступен. Откройте обычный сайт http/https.');
  }
  try {
    return await chrome.tabs.sendMessage(tab.id, message) as RuntimeResponse<T>;
  } catch {
    throw new Error('Обновите страницу после установки расширения и повторите.');
  }
}

function renderPageStatus(status: PageStatus): void {
  switch (status.state) {
    case 'awaiting-activation':
      pageStatusLabel.textContent = 'Подтвердите запуск внизу открытой страницы.';
      break;
    case 'translating':
      pageStatusLabel.textContent = status.total
        ? `Переведено ${status.completed} из ${status.total} фрагментов…`
        : 'Подготавливаю локальный переводчик…';
      break;
    case 'translated':
      pageStatusLabel.textContent = status.error ?? `Готово: ${status.completed} фрагментов.`;
      break;
    case 'error':
      pageStatusLabel.textContent = status.error ?? 'Не удалось перевести страницу.';
      break;
    default:
      pageStatusLabel.textContent = 'Переведу основной текст, сохранив кнопки и ссылки.';
  }
}

function confirmAction(title: string, description: string, buttonLabel: string): Promise<boolean> {
  confirmTitle.textContent = title;
  confirmText.textContent = description;
  required<HTMLButtonElement>('[data-confirm-button]').textContent = buttonLabel;
  confirmDialog.showModal();
  return new Promise((resolve) => {
    confirmDialog.addEventListener('close', () => resolve(confirmDialog.returnValue === 'confirm'), { once: true });
  });
}

root.querySelectorAll<HTMLButtonElement>('[role="tab"]').forEach((tab) => {
  tab.addEventListener('click', () => {
    activateTab(root, tab.dataset.tab as PopupTab);
    window.scrollTo({ top: 0, behavior: 'instant' });
  });
  tab.addEventListener('keydown', (event) => {
    const tabs = Array.from(root.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
    const current = tabs.indexOf(tab);
    const next = event.key === 'ArrowRight'
      ? (current + 1) % tabs.length
      : event.key === 'ArrowLeft'
        ? (current - 1 + tabs.length) % tabs.length
        : event.key === 'Home'
          ? 0
          : event.key === 'End'
            ? tabs.length - 1
            : -1;
    if (next < 0) return;
    event.preventDefault();
    tabs[next]?.click();
    tabs[next]?.focus();
  });
});

sourceText.addEventListener('input', () => {
  invalidateManualTranslation();
  charCount.textContent = `${sourceText.value.length.toLocaleString('ru-RU')} / 10 000`;
});
sourceText.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
    event.preventDefault();
    translateForm.requestSubmit();
  }
});

translateForm.addEventListener('submit', (event) => {
  event.preventDefault();
  if (translationBusy) return;
  const text = sourceText.value.trim();
  if (!text) {
    translateError.textContent = 'Напишите текст, который нужно перевести.';
    translateError.hidden = false;
    sourceText.focus();
    return;
  }
  const submittedMode = sourceMode.value as SourceMode;
  const operation = ++translationOperation;
  translationBusy = true;
  const submittedTarget = targetLanguage.value as TargetLanguage;
  const key = JSON.stringify([text, submittedMode, submittedTarget]);
  const callbacks = {
    onProgress(percent: number) {
      if (operation !== translationOperation) return;
      setBusy(true, `Загрузка ${percent}%`);
      engineDetail.textContent = `Загружаю языковой пакет: ${percent}%`;
    },
  };
  const activatedResult = pendingTranslationActivation?.key === key
    ? pendingTranslationActivation.activate(callbacks)
    : undefined;
  if (activatedResult) pendingTranslationActivation = undefined;
  const attemptPromise = activatedResult
    ? activatedResult.then((result) => ({ status: 'translated' as const, result }))
    : beginTranslationFromUserActivation(engine, text, submittedMode, submittedTarget, callbacks);
  void (async () => {
    translateError.hidden = true;
    resultCard.hidden = true;
    setBusy(true);
    try {
      const attempt = await attemptPromise;
      if (operation !== translationOperation) return;
      if (attempt.status === 'needs-activation') {
        pendingTranslationActivation = { ...attempt, key };
        engineDetail.textContent = `Определён язык: ${languageDefinition(attempt.sourceLanguage).name}. Нужен один клик для загрузки этой пары.`;
        return;
      }
      const { result } = attempt;
      renderTranslationResult(result);
      if (!result.alreadyTarget) {
        const historyResult = await persistTranslationHistory(() => repository.addHistory({
          requestId: createRequestId(),
          original: result.original,
          translation: result.translation,
          sourceLanguage: result.sourceLanguage,
          targetLanguage: result.targetLanguage,
          source: 'manual',
        }));
        if (historyResult.status === 'failed') {
          showToast('Перевод готов, историю сохранить не удалось');
        } else if (historyResult.status === 'saved') {
          await refreshState().catch(() => showToast('Перевод готов, историю обновить не удалось'));
        }
      }
      await updateEngineStatus();
    } catch (error) {
      if (operation !== translationOperation) return;
      translateError.textContent = error instanceof Error ? error.message : 'Не удалось выполнить перевод.';
      translateError.hidden = false;
    } finally {
      if (operation === translationOperation) {
        translationBusy = false;
        setBusy(false, pendingTranslationActivation?.key === key ? 'Подготовить и перевести' : 'Перевести');
      }
    }
  })();
});

sourceMode.addEventListener('change', () => void updateSourceMode(sourceMode.value as SourceMode)
  .then(updateEngineStatus)
  .catch((error) => showToast(error instanceof Error ? error.message : 'Не удалось сохранить направление')));
settingsSourceMode.addEventListener('change', () => void updateSourceMode(settingsSourceMode.value as SourceMode)
  .then(updateEngineStatus)
  .catch((error) => showToast(error instanceof Error ? error.message : 'Не удалось сохранить направление')));
targetLanguage.addEventListener('change', () => void updateTargetLanguage(targetLanguage.value as TargetLanguage)
  .then(updateEngineStatus)
  .catch((error) => showToast(error instanceof Error ? error.message : 'Не удалось сохранить язык перевода')));
settingsTargetLanguage.addEventListener('change', () => void updateTargetLanguage(settingsTargetLanguage.value as TargetLanguage)
  .then(updateEngineStatus)
  .catch((error) => showToast(error instanceof Error ? error.message : 'Не удалось сохранить язык перевода')));
settingsOcrMode.addEventListener('change', () => {
  const ocrMode = settingsOcrMode.value as OcrMode;
  void repository.updateSettings({ ocrMode })
    .then(refreshState)
    .catch(() => { showToast('Не удалось сохранить язык OCR'); void refreshState().catch(() => undefined); });
});
saveHistory.addEventListener('change', () => void repository.updateSettings({ saveHistory: saveHistory.checked })
  .then(refreshState)
  .catch(() => {
    showToast('Не удалось сохранить настройку');
    void refreshState().catch(() => undefined);
  }));
selectionButtonSetting.addEventListener('change', () => void repository.updateSettings({ showSelectionButton: selectionButtonSetting.checked })
  .then(refreshState)
  .catch(() => {
    showToast('Не удалось сохранить настройку');
    void refreshState().catch(() => undefined);
  }));
textScale.addEventListener('change', () => {
  const value = Number(textScale.value) as TextScale;
  document.documentElement.dataset.textScale = textScale.value;
  void repository.updateSettings({ textScale: value })
    .then(refreshState)
    .catch(() => showToast('Не удалось сохранить размер текста'));
});
historySearch.addEventListener('input', renderHistory);
dictionarySearch.addEventListener('input', renderDictionary);

required<HTMLButtonElement>('[data-action="copy-result"]').addEventListener('click', () => {
  if (!latestResult) return;
  void navigator.clipboard.writeText(latestResult.translation)
    .then(() => showToast('Перевод скопирован'))
    .catch(() => showToast('Не удалось скопировать перевод'));
});

required<HTMLButtonElement>('[data-action="save-result"]').addEventListener('click', () => {
  if (!latestResult || latestResult.alreadyTarget) return;
  void repository.addDictionaryEntry(latestResult).then(async (result) => {
    await refreshState();
    showToast(result.added ? 'Добавлено в словарь' : 'Уже в словаре');
  }).catch(() => showToast('Не удалось добавить перевод в словарь'));
});

required<HTMLButtonElement>('[data-action="export-data"]').addEventListener('click', () => {
  try {
    const backup = createBackup(state);
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `poop-translator-backup-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
    showToast('Резервная копия сохранена');
  } catch {
    showToast('Не удалось создать резервную копию');
  }
});

required<HTMLButtonElement>('[data-action="import-data"]').addEventListener('click', () => importFile.click());
importFile.addEventListener('change', () => void (async () => {
  const file = importFile.files?.[0];
  importFile.value = '';
  if (!file) return;
  if (file.size > 10_000_000) {
    showToast('Файл слишком большой');
    return;
  }
  try {
    const backup = JSON.parse(await file.text()) as unknown;
    const confirmed = await confirmAction(
      'Импортировать данные?',
      'История и словарь объединятся с текущими, настройки будут взяты из файла.',
      'Импортировать',
    );
    if (!confirmed) return;
    const result = await repository.importBackup(backup);
    await refreshState();
    showToast(`Добавлено: ${result.dictionaryAdded} слов, ${result.historyAdded} переводов`);
  } catch (error) {
    showToast(error instanceof Error ? error.message : 'Не удалось прочитать резервную копию');
  }
})());

required<HTMLButtonElement>('[data-action="translate-page"]').addEventListener('click', () => {
  void sendToActiveTab<PageStatus>({
    type: 'TRANSLATE_PAGE', requestId: createRequestId(), targetLanguage: pageTargetLanguage.value as TargetLanguage,
    sourceMode: pageSourceLanguage.value as SourceMode,
  }).then((response) => {
    if (!response.ok || !response.data) throw new Error(response.error ?? 'Страница не ответила.');
    renderPageStatus(response.data);
    showToast('Подтвердите перевод на странице');
  }).catch((error) => {
    renderPageStatus({ state: 'error', completed: 0, total: 0, error: error.message });
  });
});

pageTargetLanguage.addEventListener('change', () => {
  const selected = pageTargetLanguage.value as TargetLanguage;
  void repository.updateSettings({ pageTargetLanguage: selected })
    .then(() => { state.settings.pageTargetLanguage = selected; showToast('Язык страницы сохранён'); })
    .catch((error) => { pageTargetLanguage.value = state.settings.pageTargetLanguage; showToast(error instanceof Error ? error.message : 'Не удалось сохранить настройку'); });
});

required<HTMLButtonElement>('[data-action="translate-region"]').addEventListener('click', () => {
  void sendToActiveTab<PageStatus>({ type: 'START_REGION_SELECTION', requestId: createRequestId() })
    .then((response) => {
      if (!response.ok) throw new Error(response.error ?? 'Страница не ответила.');
      window.close();
    })
    .catch((error) => showToast(error instanceof Error ? error.message : 'Не удалось начать выбор области'));
});

required<HTMLButtonElement>('[data-action="open-pdf"]').addEventListener('click', () => {
  void chrome.tabs.create({ url: chrome.runtime.getURL('pdf.html') })
    .then(() => window.close())
    .catch(() => showToast('Не удалось открыть перевод PDF'));
});

required<HTMLButtonElement>('[data-action="restore-page"]').addEventListener('click', () => {
  void sendToActiveTab<PageStatus>({ type: 'RESTORE_PAGE', requestId: createRequestId() })
    .then((response) => response.data && renderPageStatus(response.data))
    .catch((error) => showToast(error.message));
});

required<HTMLButtonElement>('[data-action="prepare-engine"]').addEventListener('click', () => {
  const pending = engine.prepareForMode(state.settings.sourceMode, {
    onProgress(percent) { engineDetail.textContent = `Загружаю языковой пакет: ${percent}%`; },
  }, state.settings.targetLanguage);
  engineDetail.textContent = 'Подготавливаю локальный переводчик…';
  void pending.then(async () => {
    await updateEngineStatus();
    showToast('Переводчик готов');
  }).catch((error) => {
    engineDetail.textContent = error instanceof Error ? error.message : 'Не удалось подготовить переводчик.';
  });
});

required<HTMLButtonElement>('[data-action="add-word"]').addEventListener('click', () => openWordDialog());
wordForm.addEventListener('submit', (event) => {
  const submitter = event.submitter as HTMLButtonElement | null;
  if (submitter?.value === 'cancel') return;
  event.preventDefault();
  const input = { original: wordOriginal.value, translation: wordTranslation.value, note: wordNote.value };
  const action = wordId.value
    ? repository.updateDictionaryEntry(wordId.value, input).then(() => ({ added: true }))
    : repository.addDictionaryEntry(input);
  void action.then(async (result) => {
    wordDialog.close();
    await refreshState();
    showToast('added' in result && !result.added ? 'Уже в словаре' : 'Словарь обновлён');
  }).catch((error) => showToast(error instanceof Error ? error.message : 'Не удалось сохранить запись'));
});

async function clearHistoryWithConfirmation(): Promise<void> {
  if (!await confirmAction('Очистить историю?', 'Все сохранённые переводы будут удалены. Личный словарь останется.', 'Очистить историю')) return;
  await repository.clearHistory();
  await refreshState();
  showToast('История очищена');
}

required<HTMLButtonElement>('[data-action="clear-history"]').addEventListener('click', () => void clearHistoryWithConfirmation());
required<HTMLButtonElement>('[data-action="clear-history-settings"]').addEventListener('click', () => void clearHistoryWithConfirmation());
required<HTMLButtonElement>('[data-action="clear-dictionary"]').addEventListener('click', () => void (async () => {
  if (!await confirmAction('Очистить словарь?', 'Все личные слова, переводы и заметки будут удалены. История останется.', 'Очистить словарь')) return;
  await repository.clearDictionary();
  await refreshState();
  showToast('Словарь очищен');
})());
required<HTMLButtonElement>('[data-action="clear-all"]').addEventListener('click', () => void (async () => {
  if (!await confirmAction('Сбросить все данные?', 'История, словарь и ваши настройки будут удалены с этого устройства.', 'Сбросить всё')) return;
  await repository.clearUserData();
  latestResult = undefined;
  resultCard.hidden = true;
  sourceText.value = '';
  sourceText.dispatchEvent(new Event('input'));
  await refreshState();
  showToast('Данные сброшены');
})());

chrome.runtime.onMessage.addListener((message: unknown) => {
  if (typeof message === 'object' && message !== null && 'type' in message && message.type === 'PAGE_STATUS_CHANGED' && 'status' in message) {
    renderPageStatus(message.status as PageStatus);
  }
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local' && changes[STORAGE_KEY]) {
    void refreshState().catch(() => undefined);
  }
});

void (async () => {
  await refreshState();
  await updateEngineStatus();
  try {
    const response = await sendToActiveTab<PageStatus>({ type: 'GET_PAGE_STATUS', requestId: createRequestId() });
    if (response.data) renderPageStatus(response.data);
  } catch {
    // Restricted and pre-install pages remain usable for manual translation.
  }
})();
