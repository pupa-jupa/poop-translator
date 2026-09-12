import './popup.css';
import { getStorageRepository, STORAGE_KEY } from '../core/storage';
import { ChromeTranslator } from '../core/translator';
import { createRequestId, type PageStatus, type RuntimeResponse } from '../shared/messages';
import type { DictionaryEntry, ExtensionState, HistoryEntry, SourceMode, TranslationResult } from '../shared/types';
import { activateTab, mountPopupShell, type PopupTab } from './ui';

const root = document.querySelector<HTMLDivElement>('#app')!;
mountPopupShell(root);

function required<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Missing UI element: ${selector}`);
  return element;
}

const repository = getStorageRepository();
const engine = new ChromeTranslator();
let state: ExtensionState;
let latestResult: TranslationResult | undefined;
let toastTimer = 0;

const sourceText = required<HTMLTextAreaElement>('#source-text');
const charCount = required<HTMLElement>('[data-char-count]');
const translateForm = required<HTMLFormElement>('[data-form="translate"]');
const translateButton = translateForm.querySelector<HTMLButtonElement>('button[type="submit"]')!;
const sourceMode = required<HTMLSelectElement>('[data-control="source-mode"]');
const settingsSourceMode = required<HTMLSelectElement>('[data-control="settings-source-mode"]');
const saveHistory = required<HTMLInputElement>('[data-control="save-history"]');
const selectionButtonSetting = required<HTMLInputElement>('[data-control="selection-button"]');
const resultCard = required<HTMLElement>('[data-result]');
const resultOriginal = required<HTMLElement>('[data-result-original]');
const resultTranslation = required<HTMLElement>('[data-result-translation]');
const resultLanguage = required<HTMLElement>('[data-result-language]');
const translateError = required<HTMLElement>('[data-translate-error]');
const enginePill = required<HTMLElement>('[data-engine-status]');
const engineDetail = required<HTMLElement>('[data-engine-detail]');
const historyList = required<HTMLElement>('[data-history-list]');
const dictionaryList = required<HTMLElement>('[data-dictionary-list]');
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

function syncSettingsControls(): void {
  sourceMode.value = state.settings.sourceMode;
  settingsSourceMode.value = state.settings.sourceMode;
  saveHistory.checked = state.settings.saveHistory;
  selectionButtonSetting.checked = state.settings.showSelectionButton;
}

function sourceLabel(entry: HistoryEntry): string {
  const labels = { manual: 'вручную', selection: 'выделение', 'context-menu': 'контекстное меню' } as const;
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
      <div class="item-main"><p></p><span class="item-arrow">→</span><p></p></div>
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
      <div class="item-main"><p></p><span class="item-arrow">→</span><p></p></div>
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

async function refreshState(): Promise<void> {
  state = await repository.loadState();
  syncSettingsControls();
  renderHistory();
  renderDictionary();
}

async function updateSourceMode(mode: SourceMode): Promise<void> {
  await repository.updateSettings({ sourceMode: mode });
  await refreshState();
}

function renderTranslationResult(result: TranslationResult): void {
  latestResult = result;
  resultOriginal.textContent = result.original;
  resultTranslation.textContent = result.alreadyRussian ? 'Текст уже на русском' : result.translation;
  resultLanguage.textContent = `${result.sourceLanguage.toUpperCase()} → RU`;
  resultCard.hidden = false;
  required<HTMLButtonElement>('[data-action="save-result"]').disabled = result.alreadyRussian;
}

async function updateEngineStatus(): Promise<void> {
  const availability = await engine.getAvailability('en');
  enginePill.dataset.state = availability;
  const compact = {
    available: 'Готов', downloadable: 'Нужна загрузка', downloading: 'Загрузка', unavailable: 'Недоступен',
  }[availability];
  const detail = {
    available: 'Языковой пакет готов. Перевод выполняется на устройстве.',
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
});

sourceText.addEventListener('input', () => {
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
  const text = sourceText.value.trim();
  if (!text) {
    translateError.textContent = 'Напишите текст, который нужно перевести.';
    translateError.hidden = false;
    sourceText.focus();
    return;
  }
  // Start creation synchronously inside submit activation.
  const preparation = engine.prepare('en', {
    onProgress(percent) {
      setBusy(true, `Загрузка ${percent}%`);
      engineDetail.textContent = `Загружаю языковой пакет: ${percent}%`;
    },
  });
  void (async () => {
    translateError.hidden = true;
    resultCard.hidden = true;
    setBusy(true);
    try {
      await preparation;
      const result = await engine.translate(text, sourceMode.value as SourceMode);
      renderTranslationResult(result);
      if (!result.alreadyRussian) {
        await repository.addHistory({
          requestId: createRequestId(),
          original: result.original,
          translation: result.translation,
          sourceLanguage: result.sourceLanguage,
          targetLanguage: 'ru',
          source: 'manual',
        });
        await refreshState();
      }
      await updateEngineStatus();
    } catch (error) {
      translateError.textContent = error instanceof Error ? error.message : 'Не удалось выполнить перевод.';
      translateError.hidden = false;
    } finally {
      setBusy(false);
    }
  })();
});

sourceMode.addEventListener('change', () => void updateSourceMode(sourceMode.value as SourceMode));
settingsSourceMode.addEventListener('change', () => void updateSourceMode(settingsSourceMode.value as SourceMode));
saveHistory.addEventListener('change', () => void repository.updateSettings({ saveHistory: saveHistory.checked }).then(refreshState));
selectionButtonSetting.addEventListener('change', () => void repository.updateSettings({ showSelectionButton: selectionButtonSetting.checked }).then(refreshState));
historySearch.addEventListener('input', renderHistory);
dictionarySearch.addEventListener('input', renderDictionary);

required<HTMLButtonElement>('[data-action="copy-result"]').addEventListener('click', () => {
  if (!latestResult) return;
  void navigator.clipboard.writeText(latestResult.translation).then(() => showToast('Перевод скопирован'));
});

required<HTMLButtonElement>('[data-action="save-result"]').addEventListener('click', () => {
  if (!latestResult || latestResult.alreadyRussian) return;
  void repository.addDictionaryEntry(latestResult).then(async (result) => {
    await refreshState();
    showToast(result.added ? 'Добавлено в словарь' : 'Уже в словаре');
  });
});

required<HTMLButtonElement>('[data-action="translate-page"]').addEventListener('click', () => {
  void sendToActiveTab<PageStatus>({
    type: 'TRANSLATE_PAGE', requestId: createRequestId(), sourceMode: state.settings.sourceMode,
  }).then((response) => {
    if (!response.ok || !response.data) throw new Error(response.error ?? 'Страница не ответила.');
    renderPageStatus(response.data);
    showToast('Подтвердите перевод на странице');
  }).catch((error) => {
    renderPageStatus({ state: 'error', completed: 0, total: 0, error: error.message });
  });
});

required<HTMLButtonElement>('[data-action="restore-page"]').addEventListener('click', () => {
  void sendToActiveTab<PageStatus>({ type: 'RESTORE_PAGE', requestId: createRequestId() })
    .then((response) => response.data && renderPageStatus(response.data))
    .catch((error) => showToast(error.message));
});

required<HTMLButtonElement>('[data-action="prepare-engine"]').addEventListener('click', () => {
  const pending = engine.prepare('en', {
    onProgress(percent) { engineDetail.textContent = `Загружаю языковой пакет: ${percent}%`; },
  });
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
  if (areaName === 'local' && changes[STORAGE_KEY]) void refreshState();
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
