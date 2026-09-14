import { createServer } from 'node:http';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import { chromium } from 'playwright';

const extensionPath = resolve('dist');
const translationTimeoutMs = Number(process.env.POOP_TRANSLATOR_REAL_TIMEOUT_MS ?? 190_000);
const profileRoot = resolve('.tmp-chrome-profile-real');
await mkdir(profileRoot, { recursive: true });
const profilePath = await mkdtemp(join(profileRoot, 'run-'));
if (!profilePath.startsWith(`${profileRoot}${sep}`)) throw new Error('Unsafe Chrome profile path');

const server = createServer((_request, response) => {
  response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  response.end('<!doctype html><html><body><main><h1>Translation check</h1><p id="sample">The cat is sleeping on the chair.</p></main></body></html>');
});
await new Promise((resolveServer) => server.listen(0, '127.0.0.1', resolveServer));
const address = server.address();
if (!address || typeof address === 'string') throw new Error('Test server did not start');

const context = await chromium.launchPersistentContext(profilePath, {
  channel: 'chromium',
  ignoreDefaultArgs: ['--disable-component-update', '--disable-background-networking'],
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
  await popup.goto(`chrome-extension://${extensionId}/popup.html`);

  const support = await popup.evaluate(async () => {
    if (!('Translator' in globalThis)) return { available: false, reason: 'Translator API отсутствует' };
    const [enRu, ruEn] = await Promise.all([
      Translator.availability({ sourceLanguage: 'en', targetLanguage: 'ru' }),
      Translator.availability({ sourceLanguage: 'ru', targetLanguage: 'en' }),
    ]);
    return { available: true, enRu, ruEn, userAgent: navigator.userAgent };
  });
  console.log(JSON.stringify({ extensionId, support }, null, 2));
  if (!support.available) throw new Error(`${support.reason}. Нужен поддерживаемый Google Chrome.`);

  async function translate(sourceMode, text, targetPattern) {
    await popup.locator('[data-control="source-mode"]').selectOption(sourceMode);
    await popup.locator('#source-text').fill(text);
    await popup.locator('[data-form="translate"] button[type="submit"]').click();
    const output = popup.locator('[data-result-translation]');
    const error = popup.locator('[data-translate-error]');
    const outcome = await Promise.race([
      output.waitFor({ state: 'visible', timeout: translationTimeoutMs }).then(() => 'translation'),
      error.waitFor({ state: 'visible', timeout: translationTimeoutMs }).then(() => 'error'),
    ]).catch(async () => {
      const detail = (await popup.locator('[data-engine-detail]').textContent())?.trim();
      throw new Error(`Перевод не завершился за ${translationTimeoutMs} мс. Состояние: ${detail || 'неизвестно'}`);
    });
    if (outcome === 'error') {
      throw new Error(`Chrome AI: ${(await error.textContent())?.trim() || 'неизвестная ошибка'}`);
    }
    const value = (await output.textContent())?.trim() ?? '';
    if (!value || !targetPattern.test(value)) throw new Error(`Unexpected ${sourceMode} translation: ${value}`);
    return value;
  }

  const englishToRussian = await translate('en', 'The cat is sleeping on the chair.', /[а-яё]/i);
  const russianToEnglish = await translate('ru', 'Кошка спит на стуле.', /[a-z]/i);

  const page = await context.newPage();
  await page.goto(`http://127.0.0.1:${address.port}`);
  await page.locator('#sample').evaluate((element) => {
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(element);
    selection?.removeAllRanges();
    selection?.addRange(range);
    element.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
  });
  const selectionButton = page.locator('[data-poop-translator-root] .pt-selection-button');
  await selectionButton.click();
  const selectedTranslation = page.locator('[data-poop-translator-root] .pt-translation');
  await selectedTranslation.waitFor({ state: 'visible', timeout: 190_000 });
  const selectedValue = (await selectedTranslation.textContent())?.trim() ?? '';
  if (!/[а-яё]/i.test(selectedValue)) throw new Error(`Selection was not translated to Russian: ${selectedValue}`);

  console.log(JSON.stringify({ englishToRussian, russianToEnglish, selectedValue }, null, 2));
} finally {
  await context.close();
  await new Promise((resolveServer) => server.close(resolveServer));
  await rm(profilePath, { recursive: true, force: true });
}
