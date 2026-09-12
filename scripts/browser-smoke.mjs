import { createServer } from 'node:http';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

const extensionPath = resolve('dist');
const profilePath = resolve('.tmp-chrome-profile-playwright');
const outputPath = resolve('output/playwright');
await mkdir(profilePath, { recursive: true });
await mkdir(outputPath, { recursive: true });

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
  await popup.locator('[data-tab="settings"]').click();
  if (!await popup.locator('[data-view="settings"]').isVisible()) throw new Error('Settings tab did not open');
  await popup.locator('[data-tab="translate"]').click();
  await popup.waitForTimeout(250);
  await popup.screenshot({ path: resolve(outputPath, 'poop-translator-popup.png') });

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

  if (errors.length) throw new Error(`Popup console errors: ${errors.join(' | ')}`);
  const translatorType = await popup.evaluate(() => typeof globalThis.Translator);
  console.log(JSON.stringify({ extensionId, tabs: tabNames.length, selectionButton: true, translatorType }, null, 2));
} finally {
  await context.close();
  await new Promise((resolveServer) => server.close(resolveServer));
}
