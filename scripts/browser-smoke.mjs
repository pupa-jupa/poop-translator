import { createServer } from 'node:http';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';
import { chromium } from 'playwright';

const extensionPath = resolve('dist');
const profileRoot = resolve('.tmp-chrome-profile-playwright');
await mkdir(profileRoot, { recursive: true });
const profilePath = await mkdtemp(join(profileRoot, 'run-'));
if (!profilePath.startsWith(`${profileRoot}${sep}`)) throw new Error('Unsafe browser profile path');

const server = createServer((_request, response) => {
  response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  response.end(`<!doctype html><html><body><main style="max-width:600px;margin:80px auto;font:18px sans-serif">
    <h1>Test article</h1><p id="select-me">Hello world from the translation smoke test.</p>
    <button id="site-button">Site button</button></main></body></html>`);
});
await new Promise((resolveServer) => server.listen(0, '127.0.0.1', resolveServer));
const address = server.address();
if (!address || typeof address === 'string') throw new Error('Test server did not start');

const context = await chromium.launchPersistentContext(profilePath, {
  channel: 'chromium',
  headless: false,
  args: [
    `--disable-extensions-except=${extensionPath}`,
    `--load-extension=${extensionPath}`,
    '--no-first-run',
  ],
});

try {
  let worker = context.serviceWorkers()[0];
  worker ??= await context.waitForEvent('serviceworker', { timeout: 15_000 });
  const extensionId = new URL(worker.url()).host;
  const workerMessages = [];
  worker.on('console', (message) => workerMessages.push(`${message.type()}: ${message.text()}`));
  const popup = await context.newPage();
  await popup.addInitScript(() => {
    globalThis.__poopTranslatorSmoke = { translations: [] };
    class SmokeTranslator {
      static async availability() { return 'available'; }
      static async create(options) {
        return {
          async translate(text) {
            globalThis.__poopTranslatorSmoke.translations.push({
              sourceLanguage: options.sourceLanguage,
              targetLanguage: options.targetLanguage,
              text,
            });
            if (text.trim().toLowerCase() === 'bank') {
              await new Promise((resolveDelay) => setTimeout(resolveDelay, 250));
            }
            if (options.sourceLanguage === 'en' && text.trim().toLowerCase() === 'bank') return 'банк';
            if (options.targetLanguage === 'en') return 'test translation';
            return 'тестовый перевод';
          },
          destroy() {},
        };
      }
    }
    class SmokeLanguageDetector {
      static async availability() { return 'available'; }
      static async create() {
        return { async detect() { return [{ detectedLanguage: 'en', confidence: 1 }]; }, destroy() {} };
      }
    }
    Object.defineProperty(globalThis, 'Translator', { value: SmokeTranslator, configurable: true });
    Object.defineProperty(globalThis, 'LanguageDetector', { value: SmokeLanguageDetector, configurable: true });
  });
  const errors = [];
  popup.on('pageerror', (error) => errors.push(error.message));
  popup.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await popup.goto(`chrome-extension://${extensionId}/popup.html`);
  await popup.setViewportSize({ width: 404, height: 650 });
  await popup.locator('.brand-copy h1').waitFor();

  const tabNames = await popup.locator('[role="tab"]').allTextContents();
  if (tabNames.join('|') !== 'Перевод|История|Словарь|Настройки') {
    throw new Error(`Unexpected popup tabs: ${tabNames.join(', ')}`);
  }
  const directionValues = await popup.locator('[data-control="source-mode"] option').evaluateAll(
    (options) => options.map((option) => option.value),
  );
  if (directionValues.join('|') !== 'en|ru|auto') throw new Error(`Unexpected directions: ${directionValues.join(', ')}`);
  await popup.locator('[data-control="source-mode"]').selectOption('ru');
  await popup.locator('[data-target-language]').getByText('Английский').waitFor();
  await popup.locator('#source-text').fill('банк');
  await popup.locator('[data-form="translate"] button[type="submit"]').click();
  await popup.locator('[data-result-translation]').getByText('test translation', { exact: true }).waitFor();
  const lookup = await popup.evaluate(async () => chrome.runtime.sendMessage({
    type: 'LOOKUP_DICTIONARY', requestId: 'pt-smoke-dictionary', text: 'bank', sourceLanguage: 'en',
  }));
  if (!lookup.ok || !Array.isArray(lookup.data) || lookup.data.length < 3) {
    throw new Error(`Local dictionary lookup failed: ${JSON.stringify(lookup)}`);
  }
  const reverseLookup = await popup.evaluate(async () => chrome.runtime.sendMessage({
    type: 'LOOKUP_DICTIONARY', requestId: 'pt-smoke-reverse-dictionary', text: 'банк', sourceLanguage: 'ru',
  }));
  if (!reverseLookup.ok || !Array.isArray(reverseLookup.data) || reverseLookup.data[0]?.translation !== 'bank') {
    throw new Error(`Reverse local dictionary lookup failed: ${JSON.stringify(reverseLookup)}`);
  }
  const typeScale = await popup.evaluate(() => ({
    tabs: Number.parseFloat(getComputedStyle(document.querySelector('[role="tab"]')).fontSize),
    input: Number.parseFloat(getComputedStyle(document.querySelector('#source-text')).fontSize),
  }));
  if (typeScale.tabs < 11 || typeScale.input < 17) throw new Error(`Popup type is too small: ${JSON.stringify(typeScale)}`);
  await popup.locator('[data-control="source-mode"]').selectOption('en');
  await popup.locator('[data-target-language]').getByText('Русский').waitFor();
  await popup.evaluate(() => { globalThis.__poopTranslatorSmoke.translations = []; });
  await popup.locator('#source-text').fill('bank');
  await popup.locator('[data-form="translate"] button[type="submit"]').click();
  await popup.locator('[data-control="source-mode"]').selectOption('ru');
  await popup.locator('#source-text').press('Control+Enter');
  await popup.locator('[data-result-translation]').getByText('банк', { exact: true }).waitFor();
  const submittedTranslations = await popup.evaluate(() => globalThis.__poopTranslatorSmoke.translations);
  if (submittedTranslations.length !== 1
    || submittedTranslations[0].sourceLanguage !== 'en'
    || submittedTranslations[0].targetLanguage !== 'ru') {
    throw new Error(`Manual translation race was not contained: ${JSON.stringify(submittedTranslations)}`);
  }
  if (await popup.locator('[data-result-language]').textContent() !== 'EN → RU') {
    throw new Error(`Wrong result direction: ${await popup.locator('[data-result-language]').textContent()}`);
  }
  await popup.locator('[data-control="source-mode"]').selectOption('en');
  await popup.locator('[data-target-language]').getByText('Русский').waitFor();
  const riverBankVariant = popup.getByRole('button', { name: 'Добавить «берег» в словарь' });
  await riverBankVariant.waitFor();
  await riverBankVariant.click();
  await riverBankVariant.getByText('добавлено ✓').waitFor();
  await popup.locator('[data-tab="dictionary"]').click();
  if (!await popup.locator('[data-view="dictionary"]').isVisible()) throw new Error('Dictionary tab did not open');
  const variantCard = popup.locator('.item-card', { hasText: 'берег' });
  await variantCard.waitFor();
  await variantCard.getByRole('button', { name: 'Удалить' }).click();
  await variantCard.waitFor({ state: 'detached' });
  const smokeWord = `smoke-${Date.now()}`;
  await worker.evaluate(() => chrome.runtime.id);
  await popup.locator('[data-action="add-word"]').click();
  await popup.locator('[data-word-original]').fill(smokeWord);
  await popup.locator('[data-word-translation]').fill('проверка');
  await popup.locator('[data-word-save]').click();
  const storedCard = popup.locator('.item-card', { hasText: smokeWord });
  try {
    await storedCard.waitFor({ timeout: 5_000 });
  } catch {
    const diagnostics = await popup.evaluate(async () => ({
      toast: document.querySelector('[data-toast]')?.textContent,
      dialogOpen: document.querySelector('[data-word-modal]')?.hasAttribute('open'),
      storage: await chrome.storage.local.get(),
    }));
    throw new Error(`Dictionary RPC failed: ${JSON.stringify(diagnostics)}; worker=${worker.url()}; workerConsole=${workerMessages.join(' | ')}; console=${errors.join(' | ')}`);
  }
  await storedCard.getByRole('button', { name: 'Удалить' }).click();
  await storedCard.waitFor({ state: 'detached' });
  await popup.locator('[data-tab="settings"]').click();
  if (!await popup.locator('[data-view="settings"]').isVisible()) throw new Error('Settings tab did not open');
  await popup.locator('[data-control="text-scale"]').selectOption('130');
  await popup.locator('html[data-text-scale="130"]').waitFor();

  const backupWord = `backup-${Date.now()}`;
  const backup = {
    format: 'poop-translator-backup',
    version: 1,
    exportedAt: '2026-09-13T10:00:00.000Z',
    data: {
      schemaVersion: 1,
      settings: { sourceMode: 'en', saveHistory: true, showSelectionButton: true, textScale: 115 },
      history: [],
      dictionary: [{
        id: 'backup-entry', original: backupWord, translation: 'резерв', note: '',
        createdAt: 1_789_290_000_000, updatedAt: 1_789_290_000_000,
      }],
    },
  };
  await popup.locator('[data-import-file]').setInputFiles({
    name: 'poop-translator-backup.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(backup)),
  });
  await popup.locator('[data-confirm-button]').click();
  await popup.locator('[data-toast]').getByText('Добавлено: 1 слов, 0 переводов').waitFor();
  if (await popup.locator('html').getAttribute('data-text-scale') !== '115') {
    throw new Error('Imported text scale was not applied');
  }
  await popup.locator('[data-tab="dictionary"]').click();
  const backupCard = popup.locator('.item-card', { hasText: backupWord });
  await backupCard.waitFor();
  await backupCard.getByRole('button', { name: 'Удалить' }).click();
  await backupCard.waitFor({ state: 'detached' });
  await popup.locator('[data-tab="translate"]').click();
  await popup.waitForTimeout(250);
  await popup.locator('[data-toast]').evaluate((element) => { element.hidden = true; });
  const screenshotPath = process.env.POOP_TRANSLATOR_SCREENSHOT_PATH
    ? resolve(process.env.POOP_TRANSLATOR_SCREENSHOT_PATH)
    : join(profilePath, 'poop-translator-popup.png');
  await mkdir(dirname(screenshotPath), { recursive: true });
  await popup.screenshot({ path: screenshotPath });

  const page = await context.newPage();
  await page.goto(`http://127.0.0.1:${address.port}`);
  await page.locator('#select-me').evaluate((element) => {
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(element);
    selection?.removeAllRanges();
    selection?.addRange(range);
    element.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
  });
  const selectionButton = page.locator('[data-poop-translator-root] .pt-selection-button');
  await selectionButton.waitFor({ timeout: 5_000 });
  const hiddenStatusDisplay = await page.locator('[data-poop-translator-root]').evaluate((host) => {
    const status = document.createElement('div');
    status.className = 'pt-status';
    status.hidden = true;
    host.shadowRoot.append(status);
    const display = getComputedStyle(status).display;
    status.remove();
    return display;
  });
  if (hiddenStatusDisplay !== 'none') {
    throw new Error(`Hidden translation status remains visible as ${hiddenStatusDisplay}`);
  }
  const box = await selectionButton.boundingBox();
  if (!box || box.x < 0 || box.y < 0 || box.x + box.width > 1280) {
    throw new Error('Selection button is outside the viewport');
  }
  if (!await page.locator('#site-button').isEnabled()) throw new Error('Page interaction was damaged');

  const tabId = await worker.evaluate(async (url) => {
    const tabs = await chrome.tabs.query({});
    return tabs.find((tab) => tab.url === url)?.id;
  }, page.url());
  if (!tabId) throw new Error('Could not resolve the test page tab');
  await worker.evaluate(async (id) => {
    await chrome.tabs.sendMessage(id, { type: 'TRANSLATE_PAGE', requestId: 'pt-smoke-page-1', sourceMode: 'en' });
    await chrome.tabs.sendMessage(id, { type: 'TRANSLATE_PAGE', requestId: 'pt-smoke-page-2', sourceMode: 'en' });
  }, tabId);
  if (await page.locator('[data-poop-translator-root] .pt-page-prompt').count() !== 1) {
    throw new Error('Overlapping page requests created more than one confirmation prompt');
  }
  await worker.evaluate((id) => chrome.tabs.sendMessage(id, {
    type: 'RESTORE_PAGE', requestId: 'pt-smoke-restore',
  }), tabId);
  await page.locator('[data-poop-translator-root] .pt-page-prompt').waitFor({ state: 'detached' });

  if (errors.length) throw new Error(`Popup console errors: ${errors.join(' | ')}`);
  const translatorType = await worker.evaluate(() => typeof globalThis.Translator);
  console.log(JSON.stringify({ extensionId, tabs: tabNames.length, selectionButton: true, translatorType }, null, 2));
} finally {
  await context.close();
  await new Promise((resolveServer) => server.close(resolveServer));
  await rm(profilePath, { recursive: true, force: true });
}
