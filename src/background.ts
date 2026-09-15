import { LocalDictionary } from './core/dictionary';
import { getStorageRepository } from './core/storage';
import { isStorageMutationMessage } from './core/storage-client';
import {
  createRequestId,
  isDictionaryLookupRequest,
  isOcrRecognitionResult,
  isRegionCaptureRequest,
  type OcrRecognitionRequest,
  type RegionCaptureRequest,
  type RuntimeResponse,
} from './shared/messages';
import type { DictionaryInput, HistoryInput, OcrRecognitionResult, Settings } from './shared/types';

const MENU_RU_ID = 'poop-translator-selection-ru';
const MENU_EN_ID = 'poop-translator-selection-en';
const repository = getStorageRepository();
const dictionary = new LocalDictionary();
const OFFSCREEN_DOCUMENT_PATH = 'ocr.html';
let creatingOffscreenDocument: Promise<void> | undefined;

async function ensureOffscreenDocument(): Promise<void> {
  const documentUrl = chrome.runtime.getURL(OFFSCREEN_DOCUMENT_PATH);
  const contexts = await chrome.runtime.getContexts({
    contextTypes: [chrome.runtime.ContextType.OFFSCREEN_DOCUMENT],
    documentUrls: [documentUrl],
  });
  if (contexts.length > 0) return;
  if (!creatingOffscreenDocument) {
    creatingOffscreenDocument = chrome.offscreen.createDocument({
      url: OFFSCREEN_DOCUMENT_PATH,
      reasons: [chrome.offscreen.Reason.WORKERS],
      justification: 'Распознавание выбранной пользователем области локальной OCR-моделью',
    }).finally(() => {
      creatingOffscreenDocument = undefined;
    });
  }
  await creatingOffscreenDocument;
}

async function captureAndRecognizeRegion(
  message: RegionCaptureRequest,
  sender: chrome.runtime.MessageSender,
): Promise<OcrRecognitionResult> {
  if (!isRegionCaptureRequest(message) || sender.id !== chrome.runtime.id || sender.tab?.id === undefined
    || sender.tab.windowId === undefined) {
    throw new Error('Не удалось определить активную вкладку');
  }
  const tab = await chrome.tabs.get(sender.tab.id);
  if (!tab.active) throw new Error('Вернитесь на вкладку и выберите область ещё раз');

  const imageDataUrl = await chrome.tabs.captureVisibleTab(sender.tab.windowId, { format: 'png' });
  const [stillActive] = await chrome.tabs.query({ active: true, windowId: sender.tab.windowId });
  if (stillActive?.id !== sender.tab.id) {
    throw new Error('Вкладка изменилась во время снимка. Выберите область ещё раз');
  }
  void chrome.tabs.sendMessage(sender.tab.id, {
    type: 'REGION_OCR_STARTED', requestId: message.requestId,
  }).catch(() => undefined);
  await ensureOffscreenDocument();
  const request: OcrRecognitionRequest = {
    target: 'offscreen',
    type: 'OCR_RECOGNIZE',
    requestId: message.requestId,
    imageDataUrl,
    region: message.region,
    languages: message.languages,
  };
  const response = await chrome.runtime.sendMessage<OcrRecognitionRequest, RuntimeResponse<OcrRecognitionResult>>(request);
  if (!response?.ok || !isOcrRecognitionResult(response.data)) {
    throw new Error(response?.error || 'Не удалось распознать текст');
  }
  return response.data;
}

async function createContextMenu(): Promise<void> {
  await chrome.contextMenus.removeAll();
  chrome.contextMenus.create({
    id: MENU_RU_ID,
    title: 'poop translator — перевести на русский',
    contexts: ['selection'],
    documentUrlPatterns: ['http://*/*', 'https://*/*'],
  });
  chrome.contextMenus.create({
    id: MENU_EN_ID,
    title: 'poop translator — перевести на английский',
    contexts: ['selection'],
    documentUrlPatterns: ['http://*/*', 'https://*/*'],
  });
}

chrome.runtime.onInstalled.addListener(() => {
  void createContextMenu();
  void repository.updateSettings({});
});

chrome.runtime.onStartup.addListener(() => {
  void createContextMenu();
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if ((info.menuItemId !== MENU_RU_ID && info.menuItemId !== MENU_EN_ID) || !tab?.id || !info.selectionText?.trim()) return;
  void chrome.tabs.sendMessage(tab.id, {
    type: 'SHOW_SELECTION_TRANSLATOR',
    requestId: createRequestId(),
    text: info.selectionText.trim(),
    source: 'context-menu',
    sourceMode: info.menuItemId === MENU_EN_ID ? 'ru' : 'en',
  }).catch(() => undefined);
});

chrome.commands.onCommand.addListener((command, tab) => {
  if (command !== 'translate-region' || tab?.id === undefined || !tab.url?.match(/^https?:\/\//)) return;
  void chrome.tabs.sendMessage(tab.id, {
    type: 'START_REGION_SELECTION', requestId: createRequestId(),
  }).catch(() => undefined);
});

chrome.runtime.onMessage.addListener((message: unknown, sender, sendResponse) => {
  if (isRegionCaptureRequest(message)) {
    void captureAndRecognizeRegion(message, sender)
      .then((data) => sendResponse({ ok: true, data }))
      .catch((error) => sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error) }));
    return true;
  }
  if (isDictionaryLookupRequest(message)) {
    void dictionary.lookup(message.text, message.sourceLanguage)
      .then((data) => sendResponse({ ok: true, data }))
      .catch((error) => sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error) }));
    return true;
  }
  if (!isStorageMutationMessage(message)) return false;
  const execute = async (): Promise<unknown> => {
    switch (message.operation) {
      case 'updateSettings':
        return repository.updateSettings(message.payload as Partial<Settings>);
      case 'addHistory':
        return repository.addHistory(message.payload as HistoryInput);
      case 'removeHistoryEntry':
        return repository.removeHistoryEntry(message.payload as string);
      case 'clearHistory':
        return repository.clearHistory();
      case 'addDictionaryEntry':
        return repository.addDictionaryEntry(message.payload as DictionaryInput);
      case 'updateDictionaryEntry': {
        const payload = message.payload as { id: string; input: DictionaryInput };
        return repository.updateDictionaryEntry(payload.id, payload.input);
      }
      case 'removeDictionaryEntry':
        return repository.removeDictionaryEntry(message.payload as string);
      case 'clearDictionary':
        return repository.clearDictionary();
      case 'clearUserData':
        return repository.clearUserData();
      case 'importBackup':
        return repository.importBackup(message.payload);
    }
  };
  void execute()
    .then((data) => sendResponse({ ok: true, data }))
    .catch((error) => sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error) }));
  return true;
});
