import { getStorageRepository } from './core/storage';
import { isStorageMutationMessage } from './core/storage-client';
import { createRequestId } from './shared/messages';
import type { DictionaryInput, HistoryInput, Settings } from './shared/types';

const MENU_ID = 'poop-translator-selection';
const repository = getStorageRepository();

async function createContextMenu(): Promise<void> {
  await chrome.contextMenus.removeAll();
  chrome.contextMenus.create({
    id: MENU_ID,
    title: 'poop translator — перевести на русский',
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
  if (info.menuItemId !== MENU_ID || !tab?.id || !info.selectionText?.trim()) return;
  void chrome.tabs.sendMessage(tab.id, {
    type: 'SHOW_SELECTION_TRANSLATOR',
    requestId: createRequestId(),
    text: info.selectionText.trim(),
    source: 'context-menu',
  }).catch(() => undefined);
});

chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
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
    }
  };
  void execute()
    .then((data) => sendResponse({ ok: true, data }))
    .catch((error) => sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error) }));
  return true;
});
