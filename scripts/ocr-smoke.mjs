import { createServer } from 'node:http';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import { chromium } from 'playwright';

const extensionPath = resolve('dist');
const profileRoot = resolve('.tmp-chrome-profile-ocr');
await mkdir(profileRoot, { recursive: true });
const profilePath = await mkdtemp(join(profileRoot, 'run-'));
if (!profilePath.startsWith(`${profileRoot}${sep}`)) throw new Error('Unsafe browser profile path');

const server = createServer((_request, response) => {
  response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  response.end(`<!doctype html><html><body style="margin:80px;background:#fff">
    <div id="ocr-fixture" style="display:inline-block;padding:18px;color:#000;font:700 48px/1 Arial,sans-serif">HELLO OCR</div>
    <div id="ocr-russian" style="display:block;width:max-content;margin-top:28px;padding:18px;color:#000;font:700 48px/1 Arial,sans-serif">ПРИВЕТ</div>
  </body></html>`);
});
await new Promise((resolveServer) => server.listen(0, '127.0.0.1', resolveServer));
const address = server.address();
if (!address || typeof address === 'string') throw new Error('OCR test server did not start');

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
  const page = await context.newPage();
  await page.goto(`http://127.0.0.1:${address.port}`);
  await page.bringToFront();
  const tabId = await worker.evaluate(async (url) => {
    const tabs = await chrome.tabs.query({});
    return tabs.find((tab) => tab.url === url)?.id;
  }, page.url());
  if (!tabId) throw new Error('Could not resolve OCR fixture tab');

  await worker.evaluate((id) => chrome.tabs.sendMessage(id, {
    type: 'START_REGION_SELECTION', requestId: 'pt-ocr-smoke-start',
  }), tabId);
  const overlay = page.locator('[data-poop-translator-root] .pt-region-overlay');
  await overlay.waitFor();
  const fixture = await page.locator('#ocr-fixture').boundingBox();
  if (!fixture) throw new Error('Could not measure OCR fixture');
  await page.mouse.move(fixture.x + 2, fixture.y + 2);
  await page.mouse.down();
  await page.mouse.move(fixture.x + fixture.width - 2, fixture.y + fixture.height - 2, { steps: 4 });
  await page.mouse.up();

  const editor = page.locator('[data-poop-translator-root] .pt-ocr-editor');
  const failure = page.locator('[data-poop-translator-root] .pt-status[data-kind="error"]');
  await Promise.race([
    editor.waitFor({ timeout: 90_000 }),
    failure.waitFor({ timeout: 90_000 }).then(async () => {
      throw new Error(`OCR failed: ${await failure.textContent()}`);
    }),
  ]);
  const text = (await editor.inputValue()).replace(/\s+/g, ' ').trim().toUpperCase();
  if (!text.includes('HELLO OCR')) throw new Error(`Unexpected OCR result: ${JSON.stringify(text)}`);
  await page.keyboard.press('Escape');
  const settingsPage = await context.newPage();
  await settingsPage.goto(`chrome-extension://${new URL(worker.url()).host}/popup.html`);
  const updatedSettings = await settingsPage.evaluate(async () => chrome.runtime.sendMessage({
    type: 'STORAGE_MUTATION',
    requestId: 'pt-ocr-smoke-language',
    operation: 'updateSettings',
    payload: { sourceMode: 'ru' },
  }));
  if (!updatedSettings?.ok) throw new Error(`Could not select Russian OCR: ${JSON.stringify(updatedSettings)}`);
  await settingsPage.close();
  await page.bringToFront();
  await page.waitForTimeout(400);
  await worker.evaluate((id) => chrome.tabs.sendMessage(id, {
    type: 'START_REGION_SELECTION', requestId: 'pt-ocr-smoke-russian-start',
  }), tabId);
  await overlay.waitFor();
  const russianFixture = await page.locator('#ocr-russian').boundingBox();
  if (!russianFixture) throw new Error('Could not measure Russian OCR fixture');
  await page.mouse.move(russianFixture.x + 2, russianFixture.y + 2);
  await page.mouse.down();
  await page.mouse.move(russianFixture.x + russianFixture.width - 2, russianFixture.y + russianFixture.height - 2, { steps: 4 });
  await page.mouse.up();
  await editor.waitFor({ timeout: 90_000 });
  const russianText = (await editor.inputValue()).replace(/\s+/g, ' ').trim().toUpperCase();
  if (!russianText.includes('ПРИВЕТ')) throw new Error(`Unexpected Russian OCR result: ${JSON.stringify(russianText)}`);
  console.log(JSON.stringify({ localOcr: true, english: text, russian: russianText }, null, 2));
} finally {
  await context.close();
  await new Promise((resolveServer) => server.close(resolveServer));
  await rm(profilePath, { recursive: true, force: true });
}
