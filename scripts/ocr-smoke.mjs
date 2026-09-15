import { createServer } from 'node:http';
import { mkdir, mkdtemp, rm, readFile } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import { chromium } from 'playwright';
import sharp from 'sharp';

const extensionPath = resolve('dist');
const imageFixture = process.env.POOP_OCR_FIXTURE_PATH
  ? await readFile(process.env.POOP_OCR_FIXTURE_PATH)
  : await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="660" height="180">
      <rect width="660" height="180" fill="#785e6d"/>
      <path d="M0 0H220V180H0Z" fill="#a17d88"/><path d="M440 0H660V180H440Z" fill="#536c62"/>
      <circle cx="95" cy="65" r="45" fill="#b8bb84"/><rect x="275" y="25" width="115" height="80" rx="18" fill="#cebec0"/>
      <circle cx="550" cy="65" r="45" fill="#bf9eae"/>
      <g fill="white" font-family="Arial, sans-serif" font-size="26">
        <text x="18" y="150">Read this image</text><text x="238" y="150">Keep learning</text><text x="463" y="150">Small steps</text>
      </g></svg>`)).png().toBuffer();
const profileRoot = resolve('.tmp-chrome-profile-ocr');
await mkdir(profileRoot, { recursive: true });
const profilePath = await mkdtemp(join(profileRoot, 'run-'));
if (!profilePath.startsWith(`${profileRoot}${sep}`)) throw new Error('Unsafe browser profile path');

const server = createServer((request, response) => {
  if (request.url === '/fixture.png' && imageFixture) {
    response.writeHead(200, { 'content-type': 'image/png' });
    response.end(imageFixture);
    return;
  }
  response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  response.end(`<!doctype html><html><body style="margin:80px;background:#fff">
    <div id="ocr-fixture" style="display:inline-block;padding:18px;color:#000;font:700 48px/1 Arial,sans-serif">HELLO OCR</div>
    <div id="ocr-russian" style="display:block;width:max-content;margin-top:28px;padding:18px;color:#000;font:700 48px/1 Arial,sans-serif">ПРИВЕТ</div>
    ${imageFixture ? '<img id="ocr-image" src="/fixture.png" style="display:block;margin-top:20px" />' : ''}
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
  let imageText;
  if (imageFixture) {
    await page.keyboard.press('Escape');
    const options = await context.newPage();
    await options.goto(`chrome-extension://${new URL(worker.url()).host}/popup.html`);
    await options.evaluate(() => chrome.runtime.sendMessage({
      type: 'STORAGE_MUTATION', requestId: 'pt-ocr-image-mode',
      operation: 'updateSettings', payload: { sourceMode: 'auto' },
    }));
    await options.close();
    await page.bringToFront();
    await worker.evaluate((id) => chrome.tabs.sendMessage(id, {
      type: 'START_REGION_SELECTION', requestId: 'pt-ocr-image-start',
    }), tabId);
    await overlay.waitFor();
    const imageBox = await page.locator('#ocr-image').boundingBox();
    if (!imageBox) throw new Error('Image fixture missing');
    await page.mouse.move(imageBox.x, imageBox.y);
    await page.mouse.down();
    await page.mouse.move(imageBox.x + imageBox.width, imageBox.y + imageBox.height, { steps: 4 });
    await page.mouse.up();
    await editor.waitFor({ timeout: 90_000 });
    imageText = (await editor.inputValue()).replace(/\s+/g, ' ').trim();
    const expected = process.env.POOP_OCR_EXPECTED_TEXT
      ?? (process.env.POOP_OCR_FIXTURE_PATH ? '' : 'Read this image|Keep learning|Small steps');
    for (const phrase of expected.split('|').filter(Boolean)) {
      if (!imageText.toLowerCase().includes(phrase.toLowerCase())) {
        throw new Error(`Image OCR missed ${JSON.stringify(phrase)}: ${JSON.stringify(imageText)}`);
      }
    }
  }
  console.log(JSON.stringify({ localOcr: true, english: text, russian: russianText, imageText }, null, 2));
} finally {
  await context.close();
  await new Promise((resolveServer) => server.close(resolveServer));
  await rm(profilePath, { recursive: true, force: true });
}
