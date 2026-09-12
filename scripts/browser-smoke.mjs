import { createServer } from 'node:http';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
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
  await popup.locator('[data-tab="dictionary"]').click();
  if (!await popup.locator('[data-view="dictionary"]').isVisible()) throw new Error('Dictionary tab did not open');
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
  await popup.locator('[data-tab="translate"]').click();
  await popup.waitForTimeout(250);
  await popup.screenshot({ path: join(profilePath, 'poop-translator-popup.png') });

  if (process.env.POOP_TRANSLATION_SMOKE === '1') {
    await popup.locator('#source-text').fill('Hello, how are you?');
    await popup.locator('[data-form="translate"] button[type="submit"]').click();
    await popup.locator('[data-result-translation]').waitFor({ state: 'visible', timeout: 180_000 });
    const translatedText = (await popup.locator('[data-result-translation]').textContent())?.trim();
    if (!translatedText || translatedText === 'Hello, how are you?') {
      throw new Error(`Real translation did not produce Russian text: ${translatedText}`);
    }
    console.log(`Real translation: Hello, how are you? → ${translatedText}`);
  }

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
  const translatorType = await popup.evaluate(() => typeof globalThis.Translator);
  console.log(JSON.stringify({ extensionId, tabs: tabNames.length, selectionButton: true, translatorType }, null, 2));
} finally {
  await context.close();
  await new Promise((resolveServer) => server.close(resolveServer));
  await rm(profilePath, { recursive: true, force: true });
}
