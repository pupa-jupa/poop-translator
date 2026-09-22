# Large PDF, Expanded Languages, and Draggable Card Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Выпустить poop translator 1.8.0 с безопасной обработкой PDF до 100 МиБ/200 страниц, полным каталогом Chrome Translator, локальным CJK OCR, перемещаемой карточкой и восстановленными вариантами EN ↔ RU.

**Architecture:** Каталоги Translator и OCR разделяются; автоопределение готовит только Language Detector и запрашивает отдельную пользовательскую активацию для ещё не загруженной пары. PDF.js обрабатывает страницы последовательно пакетами и освобождает page/canvas, а карточка хранит только временную пользовательскую позицию. Словарные варианты остаются локальной возможностью строго для EN ↔ RU.

**Tech Stack:** TypeScript 5.9, Manifest V3, Chrome Translator/Language Detector APIs, Tesseract.js 7, PDF.js 6, Vitest 5, Playwright 1.55, Vite 7, GitHub CLI.

**Spec:** `docs/superpowers/specs/2026-09-22-large-pdf-expanded-languages-card-design.md`

## Global Constraints

- Node.js `>=24 <25`; установка только через `npm ci`.
- Пользовательский текст, изображения и PDF не передаются внешним сервисам.
- `Translator.create()` для загружаемой пары начинается синхронно из пользовательского действия до первого `await`.
- OCR-модели входят в расширение; worker держит только выбранную модель или совместимый auto-набор EN+RU.
- Runtime payload валидируется на границе, пользовательский и словарный текст выводится через `textContent`.
- PDF экспортируется одним UTF-8 TXT без попытки восстановить исходную вёрстку.
- Состояние и backup переходят на v4 с явной миграцией v1–v3; импорт объединяет данные через background-очередь.
- Сохраняются русский интерфейс, клавиатурный доступ, фокус и `prefers-reduced-motion`.
- `dist/` генерируется сборкой и проверяется; бандлы вручную не редактируются.
- Финальный релиз: версия `1.8.0`, тег `v1.8.0`, ZIP собранного `dist/`, GitHub Release после всех проверок.

---

### Task 1: Полный каталог языков и схема состояния v4

**Files:**
- Modify: `src/shared/types.ts`
- Modify: `src/core/languages.ts`
- Modify: `src/core/storage.ts`
- Modify: `src/shared/messages.ts`
- Modify: `src/popup/ui.ts`
- Modify: `src/popup/popup.ts`
- Modify: `src/background.ts`
- Modify: `pdf.html`
- Test: `tests/languages.test.ts`
- Test: `tests/storage.test.ts`
- Test: `tests/messages.test.ts`
- Test: `tests/popup-ui.test.ts`

**Interfaces:**
- Produces: `LanguageCode`, `SourceMode`, `TranslationLanguageDefinition`, `TRANSLATION_LANGUAGES`, `isLanguageCode()`, `isSourceMode()`, `isTargetLanguage()`, `languageDefinition()`.
- Produces: `ExtensionState.schemaVersion: 4` and `ExtensionBackup.version: 4`, while importing versions 1–3.
- Produces: `Settings.ocrMode: 'auto' | OcrLanguage`; old states migrate to `auto`.
- Consumes: official Chrome codes fixed in the approved spec.

- [ ] **Step 1: Write failing catalog, validation, UI, and migration tests**

```ts
expect(TRANSLATION_LANGUAGES.map(({ code }) => code)).toEqual(expect.arrayContaining([
  'en', 'ru', 'fr', 'ja', 'ko', 'zh', 'zh-Hant',
]));
expect(isLanguageCode('ko')).toBe(true);
expect(isLanguageCode('xx')).toBe(false);
expect(normalizeState({ schemaVersion: 3, settings: { sourceMode: 'fr', targetLanguage: 'ru' } }))
  .toMatchObject({ schemaVersion: 4, settings: { sourceMode: 'fr', targetLanguage: 'ru', ocrMode: 'auto' } });
expect(createBackup(DEFAULT_STATE).version).toBe(4);
expect(isContentRequest({
  type: 'SHOW_SELECTION_TRANSLATOR', requestId: 'pt-1', text: 'こんにちは',
  source: 'context-menu', sourceMode: 'ja', targetLanguage: 'ru',
})).toBe(true);
```

- [ ] **Step 2: Run focused tests and confirm RED**

Run: `npm test -- tests/languages.test.ts tests/storage.test.ts tests/messages.test.ts tests/popup-ui.test.ts`

Expected: FAIL because CJK codes, v4, generalized targets, and generated options do not exist.

- [ ] **Step 3: Implement exact catalogs and v4 normalization**

```ts
export type LanguageCode =
  | 'ar' | 'bg' | 'bn' | 'cs' | 'da' | 'de' | 'el' | 'en' | 'es' | 'fi'
  | 'fr' | 'he' | 'hi' | 'hr' | 'hu' | 'id' | 'it' | 'ja' | 'kn' | 'ko'
  | 'lt' | 'mr' | 'nl' | 'no' | 'pl' | 'pt' | 'ro' | 'ru' | 'sk' | 'sl'
  | 'sv' | 'ta' | 'te' | 'th' | 'tr' | 'uk' | 'vi' | 'zh' | 'zh-Hant';
export type SourceMode = LanguageCode | 'auto';
export type TargetLanguage = LanguageCode;
export type PageTargetLanguage = LanguageCode;
```

Create the `TRANSLATION_LANGUAGES` array with all 39 codes and stable Russian names. Generate source/target/page `<option>` elements from the catalog, with RU and EN first, instead of duplicating hard-coded markup. Reject equal explicit source/target by switching the source to `auto`; preserve all other valid pairs. Add `ocrMode: 'auto'` while normalizing old state. Normalize every valid v1–v3 backup to schema v4 and write v4 only.

- [ ] **Step 4: Run focused tests and confirm GREEN**

Run: `npm test -- tests/languages.test.ts tests/storage.test.ts tests/messages.test.ts tests/popup-ui.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit the catalog and migration**

```powershell
git add src/shared/types.ts src/core/languages.ts src/core/storage.ts src/shared/messages.ts src/popup/ui.ts src/popup/popup.ts src/background.ts pdf.html tests/languages.test.ts tests/storage.test.ts tests/messages.test.ts tests/popup-ui.test.ts
git commit -m "feat: expand local translation languages"
```

### Task 2: Масштабируемый auto-flow без массовой загрузки пар

**Files:**
- Modify: `src/core/translator.ts`
- Modify: `src/core/user-activated-translation.ts`
- Modify: `src/popup/popup.ts`
- Modify: `src/content.ts`
- Modify: `src/pdf/pdf.ts`
- Test: `tests/translator.test.ts`
- Test: `tests/popup-ui.test.ts`
- Test: `scripts/browser-smoke.mjs`

**Interfaces:**
- Consumes: `LanguageCode`, `SourceMode`, `TargetLanguage` from Task 1.
- Produces: `TranslationAttempt = { status: 'translated'; result: TranslationResult } | { status: 'needs-activation'; sourceLanguage: LanguageCode; targetLanguage: LanguageCode; activate(callbacks?: TranslationCallbacks): Promise<TranslationResult> }`.
- Produces: `beginTranslationFromUserActivation(engine, text, sourceMode, targetLanguage, callbacks): Promise<TranslationAttempt>`; the call itself must occur synchronously in the click handler.

- [ ] **Step 1: Write failing tests for explicit, ready-auto, and downloadable-auto paths**

```ts
const pending = beginTranslationFromUserActivation(engine, 'こんにちは', 'auto', 'ru');
expect(detectorApi.create).toHaveBeenCalledOnce();
expect(translatorApi.create).not.toHaveBeenCalled();
releaseDetection([{ detectedLanguage: 'ja', confidence: 0.99 }]);
const attempt = await pending;
expect(attempt).toMatchObject({ status: 'needs-activation', sourceLanguage: 'ja', targetLanguage: 'ru' });
expect(translatorApi.create).not.toHaveBeenCalled();
const translated = attempt.status === 'needs-activation' ? attempt.activate() : Promise.reject();
expect(translatorApi.create).toHaveBeenCalledOnce();
await expect(translated).resolves.toMatchObject({ sourceLanguage: 'ja', targetLanguage: 'ru' });
```

Also assert that auto mode never creates translators for unrelated languages and that an `available` detected pair proceeds without a second button.

- [ ] **Step 2: Run translator/UI tests and confirm RED**

Run: `npm test -- tests/translator.test.ts tests/popup-ui.test.ts`

Expected: FAIL because auto currently calls `create()` for every source candidate.

- [ ] **Step 3: Implement `TranslationAttempt` and activation UI**

Start detector creation synchronously for auto. After detection call `availability({sourceLanguage, targetLanguage})`; return `needs-activation` only for `downloadable`/`downloading`. The `activate()` closure must call `createTranslator()` before its first `await`. Explicit source mode starts exactly one translator immediately. Popup, selection card, OCR card, page prompt, and PDF show «Определён язык: …» plus «Подготовить и перевести» when the attempt requires a second gesture; stale operation generations invalidate late attempts.

- [ ] **Step 4: Run focused and browser tests**

Run: `npm test -- tests/translator.test.ts tests/popup-ui.test.ts`

Expected: PASS, including the assertion that auto creates zero speculative translators.

Run: `npm run smoke:browser`

Expected: PASS for explicit translation and the stubbed two-stage auto path.

- [ ] **Step 5: Commit scalable model activation**

```powershell
git add src/core/translator.ts src/core/user-activated-translation.ts src/popup/popup.ts src/content.ts src/pdf/pdf.ts tests/translator.test.ts tests/popup-ui.test.ts scripts/browser-smoke.mjs
git commit -m "feat: prepare detected language pairs on demand"
```

### Task 3: Японский, корейский и китайский OCR

**Files:**
- Modify: `src/shared/types.ts`
- Modify: `src/core/languages.ts`
- Modify: `src/shared/messages.ts`
- Modify: `src/ocr/tesseract-engine.ts`
- Modify: `src/popup/ui.ts`
- Modify: `src/popup/popup.ts`
- Modify: `src/content.ts`
- Modify: `src/pdf/pdf.ts`
- Modify: `pdf.html`
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `scripts/copy-ocr-assets.mjs`
- Modify: `scripts/smoke.mjs`
- Modify: `scripts/ocr-smoke.mjs`
- Modify: `THIRD_PARTY_NOTICES.md`
- Modify: `public/THIRD_PARTY_NOTICES.txt`
- Test: `tests/languages.test.ts`
- Test: `tests/messages.test.ts`
- Test: `tests/ocr-engine.test.ts`

**Interfaces:**
- Produces: `OcrLanguage = 'eng' | 'rus' | 'ukr' | 'deu' | 'fra' | 'spa' | 'jpn' | 'kor' | 'chi_sim' | 'chi_tra'`.
- Produces: `OcrMode = OcrLanguage | 'auto'`; popup settings persist it as `Settings.ocrMode`, while the PDF tab keeps its selector local to that tab.
- Produces: `OCR_LANGUAGES` and `ocrLanguageForTranslationLanguage(code)`.
- Consumes: local packages `@tesseract.js-data/jpn`, `kor`, `chi_sim`, `chi_tra` version `1.0.0`.

- [ ] **Step 1: Write failing mapping and runtime-boundary tests**

```ts
expect(ocrLanguageForTranslationLanguage('ja')).toBe('jpn');
expect(ocrLanguageForTranslationLanguage('ko')).toBe('kor');
expect(ocrLanguageForTranslationLanguage('zh')).toBe('chi_sim');
expect(ocrLanguageForTranslationLanguage('zh-Hant')).toBe('chi_tra');
expect(isOcrRecognitionRequest(validRequest(['chi_sim']))).toBe(true);
expect(isOcrRecognitionRequest(validRequest(['jpn', 'kor', 'chi_sim']))).toBe(false);
```

- [ ] **Step 2: Run tests and confirm RED**

Run: `npm test -- tests/languages.test.ts tests/messages.test.ts tests/ocr-engine.test.ts`

Expected: FAIL because CJK OCR codes and assets are absent.

- [ ] **Step 3: Install and wire local models**

Run:

```powershell
npm install --save-exact "@tesseract.js-data/jpn@1.0.0" "@tesseract.js-data/kor@1.0.0" "@tesseract.js-data/chi_sim@1.0.0" "@tesseract.js-data/chi_tra@1.0.0"
```

Extend the copy script to copy exactly the ten declared models. Populate OCR selectors from `OCR_LANGUAGES`; retain auto EN+RU only. Add a separate popup/settings OCR selector bound to `Settings.ocrMode`; region capture uses this value rather than `sourceMode`. Continue terminating the previous worker on a language change so no CJK models coexist in memory. Update notices with the same Tesseract data attribution already used by existing traineddata.

- [ ] **Step 4: Extend real OCR smoke and asset verification**

Add generated canvas fixtures containing `日本語`, `한국어`, `简体中文`, and `繁體中文`. Assert a non-empty matching-script result for each selected model, not an English transliteration. `scripts/smoke.mjs` must verify every `dist/ocr/lang/<code>.traineddata.gz` exists and is non-empty.

- [ ] **Step 5: Run OCR tests and build smoke**

Run: `npm test -- tests/languages.test.ts tests/messages.test.ts tests/ocr-engine.test.ts`

Expected: PASS.

Run: `npm run build && npm run smoke && npm run smoke:ocr`

Expected: PASS with all ten local models and four CJK fixtures.

- [ ] **Step 6: Commit CJK OCR**

```powershell
git add src package.json package-lock.json scripts/copy-ocr-assets.mjs scripts/smoke.mjs scripts/ocr-smoke.mjs pdf.html THIRD_PARTY_NOTICES.md public/THIRD_PARTY_NOTICES.txt tests/languages.test.ts tests/messages.test.ts tests/ocr-engine.test.ts dist
git commit -m "feat: add local CJK OCR models"
```

### Task 4: Безопасная обработка PDF до 100 МиБ и 200 страниц

**Files:**
- Modify: `src/core/pdf.ts`
- Modify: `src/pdf/pdf.ts`
- Modify: `src/pdf/pdf.css`
- Modify: `pdf.html`
- Modify: `scripts/browser-smoke.mjs`
- Test: `tests/pdf.test.ts`

**Interfaces:**
- Produces: `PDF_LIMITS` with `warningBytes`, `warningPages`, `maxBytes`, `maxPages`, `maxTotalCharacters`.
- Produces: `classifyPdfInput(file, pageCount?): { warnings: Array<'large-file' | 'many-pages'> }` that throws only for the hard limit or invalid input.
- Produces: `processPageBatches(pageCount, batchSize, process, yieldToBrowser, isCancelled)` for sequential, cancellable page work.

- [ ] **Step 1: Write failing budget and batching tests**

```ts
expect(classifyPdfInput(pdf(21 * MIB)).warnings).toContain('large-file');
expect(() => classifyPdfInput(pdf(101 * MIB))).toThrow('100 МБ');
expect(classifyPdfInput(pdf(1 * MIB), 51).warnings).toContain('many-pages');
expect(() => classifyPdfInput(pdf(1 * MIB), 201)).toThrow('200 страниц');
await processPageBatches(12, 5, async (page) => seen.push(page), async () => yields++, () => false);
expect(seen).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
expect(yields).toBe(2);
```

- [ ] **Step 2: Run PDF tests and confirm RED**

Run: `npm test -- tests/pdf.test.ts`

Expected: FAIL because soft thresholds and batching helper do not exist.

- [ ] **Step 3: Implement limits, dialog, cleanup, yielding, and cancellation**

Use 20 MiB/50 pages as warnings, 100 MiB/200 pages as hard limits, 4,000,000 total characters, and retain existing image/canvas/page-character limits. Use a native `<dialog>` with «Продолжить» and «Отмена» before expensive extraction when any warning is known. Wrap each `getPage()` use in `try/finally { page.cleanup(); }`; zero OCR canvases in their existing `finally`; yield after every five pages with `requestAnimationFrame`. Add an extraction cancel action tied to `documentGeneration`. Keep the previous successful `loadedPages` until the replacement document completes.

- [ ] **Step 4: Verify TXT composition and browser behavior**

Extend browser smoke with a generated 51-page lightweight PDF: approve the warning, verify pages are processed in order, cancel a second load, translate through the stub, and assert the single downloaded TXT contains first and last page markers.

Run: `npm test -- tests/pdf.test.ts && npm run smoke:browser`

Expected: PASS.

- [ ] **Step 5: Commit large PDF support**

```powershell
git add src/core/pdf.ts src/pdf/pdf.ts src/pdf/pdf.css pdf.html scripts/browser-smoke.mjs tests/pdf.test.ts
git commit -m "feat: process larger PDFs in bounded batches"
```

### Task 5: Перетаскиваемая и клавиатурно управляемая карточка

**Files:**
- Modify: `src/core/floating-card.ts`
- Modify: `src/content.ts`
- Modify: `src/content.css`
- Modify: `scripts/browser-smoke.mjs`
- Test: `tests/floating-card.test.ts`

**Interfaces:**
- Produces: `clampFloatingCardPosition(position, size, viewport, margin?): Point`.
- Produces: `moveFloatingCardByKey(position, key, fine, size, viewport): Point | undefined`.
- Consumes: existing `placeFloatingCard()` for the initial anchored position.

- [ ] **Step 1: Write failing clamp and keyboard tests**

```ts
expect(clampFloatingCardPosition(
  { x: 790, y: -20 }, { width: 350, height: 480 }, { width: 800, height: 600 }, 12,
)).toEqual({ x: 438, y: 12 });
expect(moveFloatingCardByKey(
  { x: 100, y: 100 }, 'ArrowRight', false,
  { width: 350, height: 300 }, { width: 800, height: 600 },
)).toEqual({ x: 110, y: 100 });
expect(moveFloatingCardByKey(
  { x: 100, y: 100 }, 'ArrowUp', true,
  { width: 350, height: 300 }, { width: 800, height: 600 },
)).toEqual({ x: 100, y: 99 });
```

- [ ] **Step 2: Run unit tests and confirm RED**

Run: `npm test -- tests/floating-card.test.ts`

Expected: FAIL because clamp and keyboard movement are absent.

- [ ] **Step 3: Implement the drag handle and pointer lifecycle**

Add a real `button.pt-card-drag` with `aria-label="Переместить окно перевода"`. On `pointerdown`, record the pointer offset and call `setPointerCapture`; on `pointermove`, clamp and set `--pt-left/--pt-top`; on `pointerup` and `pointercancel`, release capture and clear drag state. The handle gets `touch-action: none`, `cursor: grab`, and a visible focus ring. Arrow keys call `moveFloatingCardByKey`; Shift selects the 1 px step. Mark the card user-positioned after pointer or keyboard movement.

When translation, variants, editor, or viewport size changes, re-clamp the current point if user-positioned; otherwise call `placeFloatingCard()` with the selection anchor. Remove window listeners and release capture when the card closes.

- [ ] **Step 4: Extend browser smoke for drag, keyboard, growth, and edges**

Open a selection card near the bottom, drag the handle to the upper-right edge, assert the bounding rect remains within 12 px margins, move it with ArrowLeft and Shift+ArrowUp, then reveal variants and assert the card stays visible rather than snapping back.

Run: `npm test -- tests/floating-card.test.ts && npm run smoke:browser`

Expected: PASS.

- [ ] **Step 5: Commit draggable card support**

```powershell
git add src/core/floating-card.ts src/content.ts src/content.css scripts/browser-smoke.mjs tests/floating-card.test.ts
git commit -m "feat: make translation card movable"
```

### Task 6: Гарантированные варианты EN ↔ RU

**Files:**
- Modify: `src/core/dictionary-client.ts`
- Modify: `src/popup/popup.ts`
- Modify: `src/content.ts`
- Modify: `src/popup/ui.ts`
- Modify: `src/popup/popup.css`
- Modify: `src/content.css`
- Modify: `scripts/browser-smoke.mjs`
- Test: `tests/dictionary.test.ts`
- Test: `tests/popup-ui.test.ts`

**Interfaces:**
- Produces: `lookupAlternativeVariants(text, primaryTranslation, sourceLanguage, targetLanguage)`; returns values only for `en→ru` or `ru→en`.
- Consumes: existing `LocalDictionary.lookup()` and `selectAlternativeVariants()`.

- [ ] **Step 1: Write failing pair-aware and DOM behavior tests**

```ts
await expect(lookupAlternativeVariants('bank', 'банк', 'en', 'ru')).resolves.toEqual(
  expect.arrayContaining([{ translation: 'берег', partOfSpeech: 'n' }]),
);
await expect(lookupAlternativeVariants('bank', '銀行', 'en', 'ja')).resolves.toEqual([]);
```

In popup DOM tests, translate `bank`, resolve the dictionary RPC with `банк`, `берег`, `отмель`, and assert three unique visible meanings plus the copy «без ранжирования по контексту». Add the symmetric `банк` case.

- [ ] **Step 2: Run dictionary/UI tests and confirm RED**

Run: `npm test -- tests/dictionary.test.ts tests/popup-ui.test.ts`

Expected: FAIL because lookup is not target-aware and the explanatory copy is absent.

- [ ] **Step 3: Implement pair-aware variants in all three surfaces**

Pass `result.targetLanguage` from popup, selection card, and OCR card. Preserve the primary Chrome translation and append up to eight deduplicated meanings with part-of-speech labels. Use `textContent`; keep dictionary failure isolated from translation success. Set the heading to «Другие значения» and the note to «локальный словарь · без ранжирования по контексту».

- [ ] **Step 4: Verify with unit and browser smoke**

Run: `npm test -- tests/dictionary.test.ts tests/popup-ui.test.ts && npm run smoke:browser`

Expected: PASS; `bank` and `банк` show multiple values in popup and selection card.

- [ ] **Step 5: Commit variant restoration**

```powershell
git add src/core/dictionary-client.ts src/popup/popup.ts src/content.ts src/popup/ui.ts src/popup/popup.css src/content.css scripts/browser-smoke.mjs tests/dictionary.test.ts tests/popup-ui.test.ts
git commit -m "fix: restore local translation variants"
```

### Task 7: Документация, версия, полная верификация и GitHub Release 1.8.0

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `public/manifest.json`
- Modify: `README.md`
- Modify: `CHANGELOG.md`
- Modify: `docs/testing.md`
- Modify: `docs/dictionary.md`
- Modify: `AGENTS.md` only if commands or architecture changed
- Regenerate: `dist/**`
- Create outside repository: `D:\Temp\poop-translator-1.8.0.zip`
- Create outside repository: `D:\Temp\poop-translator-1.8.0-release-notes.md`

**Interfaces:**
- Consumes: every completed task and its tests.
- Produces: release commit, `v1.8.0`, pushed `main`, and GitHub Release with installable ZIP.

- [ ] **Step 1: Update user and developer documentation**

Set package, lockfile, source manifest, and generated manifest to `1.8.0`. Document: full Translator catalog with runtime availability; explicit CJK OCR selection and increased install size; 20 MiB/50 page warning and 100 MiB/200 page hard limit; single TXT export; draggable handle and keyboard controls; EN ↔ RU scope of local variants. Add a dated 1.8.0 changelog entry.

- [ ] **Step 2: Run the complete verification matrix from a clean install**

Run:

```powershell
npm ci
npm test
npm run typecheck
npm run build
npm run smoke
npx.cmd playwright install chromium
npm run smoke:browser
npm run smoke:ocr
git diff --check
git status --short
```

Expected: all commands exit 0; Vitest reports zero failures; tracked `dist/` matches the source build; status contains only intended source, docs, lockfile, test, and generated dist changes.

- [ ] **Step 3: Perform the release audit**

Check every objective against authoritative evidence:

- PDF warning/hard caps, batching, cleanup, cancellation, and one TXT: tests plus browser smoke.
- Expanded languages and no eager all-pair creation: catalog/translator tests and built UI.
- CJK OCR: bundled asset smoke plus real OCR smoke.
- Movable card: unit placement plus browser pointer/keyboard scenario.
- Multiple meanings: `bank`/`банк` DOM and browser scenarios.
- Privacy and runtime validation: source inspection, message tests, and manifest smoke.

- [ ] **Step 4: Commit the release build**

```powershell
git add package.json package-lock.json public/manifest.json README.md CHANGELOG.md docs AGENTS.md dist
git commit -m "chore: release poop translator 1.8.0"
```

- [ ] **Step 5: Build the installable ZIP and inspect it**

Use PowerShell `Compress-Archive` on the contents of the resolved `dist` directory into a temporary directory outside the repository. List the ZIP entries and verify `manifest.json`, popup, PDF, workers, notices, icons, dictionaries, and all ten OCR models are present; verify `.git`, source maps, profiles, fixtures, and environment files are absent.

Write these release notes to `D:\Temp\poop-translator-1.8.0-release-notes.md`:

```markdown
## Что нового

- Перевод между всеми языками, официально поддерживаемыми Chrome Translator API, с загрузкой только выбранной пары.
- Локальный OCR японского, корейского, упрощённого и традиционного китайского; язык распознавания выбирается явно.
- PDF до 100 МиБ и 200 страниц обрабатываются последовательными пакетами; после 20 МиБ или 50 страниц показывается предупреждение.
- Плавающее окно перевода перемещается мышью, касанием и стрелками клавиатуры.
- Для EN ↔ RU снова показываются несколько локальных словарных значений.

PDF экспортируется единым TXT без исходной вёрстки. Текст, изображения и PDF не передаются внешним сервисам. CJK OCR-модели входят в ZIP, поэтому его размер увеличился; одновременно в память загружается только выбранная модель.

Проверено командами `npm test`, `npm run typecheck`, `npm run build`, `npm run smoke`, `npm run smoke:browser` и `npm run smoke:ocr`.
```

- [ ] **Step 6: Push and publish only after fresh verification remains green**

```powershell
git push -u origin codex/large-pdf-expanded-languages
git switch main
git merge --ff-only codex/large-pdf-expanded-languages
git push origin main
git tag -a v1.8.0 -m "poop translator 1.8.0"
git push origin v1.8.0
gh release create v1.8.0 D:\Temp\poop-translator-1.8.0.zip --title "poop translator 1.8.0 — большие PDF и новые языки" --notes-file D:\Temp\poop-translator-1.8.0-release-notes.md
```

The release notes summarize user-visible behavior, offline/privacy guarantees, CJK install-size tradeoff, verification commands, and the limitation that PDF export is TXT. After creation, run `gh release view v1.8.0 --json url,tagName,isLatest,assets` and attach the resulting pull request artifact only if a PR was created; a direct fast-forward release has no PR artifact.

- [ ] **Step 7: Final repository and release readback**

Run:

```powershell
git status --short
git log -3 --oneline --decorate
gh release view v1.8.0 --json url,tagName,isLatest,assets
```

Expected: clean worktree; `main`, `origin/main`, and `v1.8.0` point at the release commit; GitHub reports the ZIP asset and the release URL.
