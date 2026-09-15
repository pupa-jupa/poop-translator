# Region OCR Translation Implementation Plan

Состояние на 2026-09-15: выпуск 1.3.0 проверен и подготовлен к публикации. Этот план фиксирует путь реализации и не является очередью следующих функций.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Добавить локальный перевод выделенной области страницы или изображения для английского и русского текста.

**Architecture:** Content script рисует доступный оверлей и отправляет нормализованную область в service worker. Service worker снимает активную вкладку и передаёт screenshot в offscreen document, где локальный Tesseract.js обрезает изображение и распознаёт текст; content script показывает редактируемый результат и запускает уже подготовленный Chrome Translator.

**Tech Stack:** TypeScript, Chrome MV3 `tabs.captureVisibleTab` и `offscreen`, Shadow DOM, Canvas, Tesseract.js 7, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-14-region-ocr-design.md`

## Global Constraints

- Обработка снимка и текста остаётся локальной; никаких CDN и внешних API.
- OCR-модели первой версии: `eng`, `rus`, режим `eng+rus`.
- `Translator.create()` запускается синхронно из пользовательского `pointerup` до первого `await`.
- Screenshot не сохраняется; история получает только текст и перевод.
- Пользовательский текст выводится через `textContent` или `value`.
- Интерфейс русский, тёмно-розовый, клавиатурный и учитывает `prefers-reduced-motion`.

---

### Task 1: Геометрия области и протокол сообщений

**Files:**
- Create: `src/core/region-capture.ts`
- Modify: `src/shared/messages.ts`
- Modify: `src/shared/types.ts`
- Test: `tests/region-capture.test.ts`
- Test: `tests/messages.test.ts`

**Interfaces:**
- Produces: `normalizeRegionSelection(start, end, viewport): RegionRect | null`
- Produces: `mapRegionToBitmap(region, bitmap): BitmapRegion`
- Produces: сообщения `START_REGION_SELECTION` и `CAPTURE_REGION`.

- [x] **Step 1: Write failing geometry and validation tests**

```ts
expect(normalizeRegionSelection({ x: 500, y: 300 }, { x: 100, y: 50 }, { width: 800, height: 600 }))
  .toEqual({ left: 100, top: 50, width: 400, height: 250, viewportWidth: 800, viewportHeight: 600 });
expect(mapRegionToBitmap(region, { width: 1600, height: 1200 }))
  .toEqual({ left: 200, top: 100, width: 800, height: 500 });
expect(isRegionCaptureRequest({ type: 'CAPTURE_REGION', requestId: 'pt-1', region, languages: ['eng'] })).toBe(true);
```

- [x] **Step 2: Run tests and verify missing APIs fail**

Run: `npm test -- --run tests/region-capture.test.ts tests/messages.test.ts`

- [x] **Step 3: Implement the pure functions and strict payload validators**

```ts
export function normalizeRegionSelection(start: Point, end: Point, viewport: Size): RegionRect | null;
export function mapRegionToBitmap(region: RegionRect, bitmap: Size): BitmapRegion;
export function isRegionCaptureRequest(value: unknown): value is RegionCaptureRequest;
```

- [x] **Step 4: Run targeted tests until green**

Run: `npm test -- --run tests/region-capture.test.ts tests/messages.test.ts`

### Task 2: Локальный OCR runtime

**Files:**
- Create: `ocr.html`
- Create: `src/ocr/offscreen.ts`
- Create: `src/core/ocr.ts`
- Create: `scripts/copy-ocr-assets.mjs`
- Modify: `vite.config.ts`
- Modify: `package.json`
- Modify: `public/manifest.json`
- Modify: `scripts/smoke.mjs`
- Modify: `THIRD_PARTY_NOTICES.md`
- Test: `tests/ocr.test.ts`

**Interfaces:**
- Consumes: `BitmapRegion` from Task 1.
- Produces: `normalizeRecognizedText(text): string`.
- Produces: offscreen request `{ target: 'offscreen', type: 'OCR_RECOGNIZE', imageDataUrl, region, languages }`.

- [x] **Step 1: Write failing text-normalization tests**

```ts
expect(normalizeRecognizedText('  Hello  \n\n world \f')).toBe('Hello\nworld');
expect(normalizeRecognizedText('   ')).toBe('');
```

- [x] **Step 2: Run the test and verify the module is missing**

Run: `npm test -- --run tests/ocr.test.ts`

- [x] **Step 3: Add bundled Tesseract dependencies and build assets**

Run: `npm install tesseract.js@7.0.0 tesseract.js-core@7.0.0 @tesseract.js-data/eng@1.0.0 @tesseract.js-data/rus@1.0.0`

The build copies `worker.min.js`, the three LSTM core variants and `4.0.0_best_int/{eng,rus}.traineddata.gz` into `dist/ocr/`. No runtime URL may start with `http:` or `https:`.

- [x] **Step 4: Implement reusable worker and offscreen message handler**

Реализация использует `recognizeCanvas(canvas, languages)` в `src/ocr/tesseract-engine.ts`; crop и разбор сообщения выполняются в `src/ocr/offscreen.ts`.

Use `workerBlobURL: false`, `chrome.runtime.getURL('ocr/worker.min.js')`, local `corePath` and `langPath`.

- [x] **Step 5: Verify unit test and production asset completeness**

Run: `npm test -- --run tests/ocr.test.ts && npm run build && npm run smoke`

### Task 3: Захват вкладки в service worker

**Files:**
- Modify: `src/background.ts`
- Test: `tests/messages.test.ts`

**Interfaces:**
- Consumes: validated `RegionCaptureRequest` and `sender.tab.windowId`.
- Produces: `RuntimeResponse<OcrResult>` returned to the requesting content script.

- [x] **Step 1: Add failing malformed-request cases**

```ts
expect(isRegionCaptureRequest({ type: 'CAPTURE_REGION', requestId: 'pt-1', region: { width: -1 } })).toBe(false);
```

- [x] **Step 2: Implement one in-flight offscreen creation promise and capture handler**

```ts
const screenshot = await chrome.tabs.captureVisibleTab(sender.tab.windowId, { format: 'png' });
const result = await recognizeInOffscreen(screenshot, message.region, ['eng', 'rus']);
sendResponse({ ok: true, data: result });
```

- [x] **Step 3: Run message tests and typecheck**

Run: `npm test -- --run tests/messages.test.ts && npm run typecheck`

### Task 4: Оверлей и карточка OCR в content script

**Files:**
- Modify: `src/content.ts`
- Modify: `src/content.css`
- Modify: `src/core/storage-client.ts` and `src/core/storage.ts`
- Test: `tests/region-capture.test.ts`

**Interfaces:**
- Consumes: `START_REGION_SELECTION`, `normalizeRegionSelection`, `RuntimeResponse<OcrResult>`.
- Produces: доступный selection overlay и редактируемую OCR-карточку.

- [x] **Step 1: Add failing state tests for stale operation and small selection**

```ts
expect(normalizeRegionSelection({ x: 10, y: 10 }, { x: 18, y: 18 }, viewport)).toBeNull();
```

- [x] **Step 2: Implement overlay lifecycle**

The overlay uses Pointer Events, pointer capture, `Escape`, a native cancel button, `touch-action: none`, and removes itself before awaiting capture.

- [x] **Step 3: Start translation preparation from pointerup and render editable result**

```ts
const preparation = engine.prepareForMode(settings.sourceMode);
const response = await chrome.runtime.sendMessage({ type: 'CAPTURE_REGION', requestId, region });
```

Only the current operation id may update the card. Re-translation starts from the card button click.

- [x] **Step 4: Save successful translations with source `ocr-region`**

Update runtime validation, labels, and normalization so older entries remain valid.

- [x] **Step 5: Run all unit tests and typecheck**

Run: `npm test && npm run typecheck`

### Task 5: Popup trigger and keyboard command

**Files:**
- Modify: `src/popup/ui.ts`
- Modify: `src/popup/popup.ts`
- Modify: `src/popup/popup.css`
- Modify: `src/background.ts`
- Modify: `public/manifest.json`
- Test: `tests/popup-ui.test.ts`

**Interfaces:**
- Produces: button `[data-action="translate-region"]` and command `translate-region`.

- [x] **Step 1: Add a failing popup shell assertion for the trigger**

```ts
expect(root.querySelector('[data-action="translate-region"]')?.textContent).toContain('Выбрать область');
```

- [x] **Step 2: Add the button, close popup after successful start, and handle failures visibly**

- [x] **Step 3: Add `Alt+Shift+P` command and route it to the active tab**

- [x] **Step 4: Run popup tests and typecheck**

Run: `npm test -- --run tests/popup-ui.test.ts tests/messages.test.ts && npm run typecheck`

### Task 6: Browser verification and documentation

**Files:**
- Create: `scripts/ocr-smoke.mjs`
- Modify: `scripts/browser-smoke.mjs`
- Modify: `docs/testing.md`
- Modify: `README.md`
- Modify: `AGENTS.md`
- Modify: `CHANGELOG.md`

**Interfaces:**
- Produces: `npm run smoke:ocr` that uses real capture and real bundled OCR without a translator stub requirement.

- [x] **Step 1: Extend deterministic browser smoke with overlay open/cancel checks**

- [x] **Step 2: Add real OCR smoke over a large high-contrast `HELLO OCR` fixture**

The script drags a region, waits for editable OCR text, and fails if normalized output lacks `HELLO OCR`.

- [x] **Step 3: Update docs with permissions, privacy, supported surfaces and honest test limits**

- [x] **Step 4: Run the complete verification matrix**

Run: `npm test`, `npm run typecheck`, `npm run build`, `npm run smoke`, `npm run smoke:browser`, `npm run smoke:ocr`, `npm audit`, `git diff --check`.

- [x] **Step 5: Review generated `dist` and prepare the completed release commit**
