import { getStorageRepository } from './core/storage';
import { createRequestId } from './shared/messages';

const MENU_ID = 'poop-translator-selection';

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
  void getStorageRepository().loadState().then((state) => (
    chrome.storage.local.set({ poopTranslatorState: state })
  ));
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
