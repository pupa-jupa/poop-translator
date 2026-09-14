# Poop Translator Implementation Plan

> **Архив первоначального плана, проверен 2026-09-13.** Основные функции реализованы в версии 1.1.0. Чекбоксы ниже отражают исходный план, а не текущий список незавершённых задач; историческое выполнение каждого шага red/green здесь не подтверждено. Не запускайте этот план повторно. Текущие инструкции: [AGENTS.md](../../../AGENTS.md); состояние и пробелы: [аудит](../../audit-2026-09-13.md).

Расхождения первоначальных интерфейсов с кодом: `SourceLanguage` заменён на `SourceMode`; вместо `chunkTextNodes` используется `splitText`; команда контекстного меню называется `SHOW_SELECTION_TRANSLATOR`, а не `TRANSLATE_SELECTION`. Состояние изменяется через `StorageClient` и очередь service worker. Подробности — в актуальной спецификации.

**Goal:** Собрать готовое к загрузке расширение Chrome для локального перевода между английским и русским с несколькими словарными значениями.

**Architecture:** Manifest V3 разделяет popup, content script и service worker. Переводчик работает в документном контексте, данные проходят через типизированные модули и сохраняются в `chrome.storage.local`.

**Tech Stack:** TypeScript, Vite, Vitest, jsdom, Chrome Extension APIs.

**Spec:** `docs/superpowers/specs/2026-09-12-poop-translator-design.md`

## Global Constraints

- Интерфейс полностью на русском языке.
- Основной движок бесплатный Chrome Translator API без API-ключей.
- Направления: EN→RU, RU→EN и авто EN↔RU; варианты слов работают из локальных данных FreeDict.
- Постоянные пользовательские данные хранятся только в `chrome.storage.local`.
- Manifest V3, локальные скрипты и иконки, без `eval` и удалённого исполняемого кода.
- Переводы страниц не попадают в историю.

---

### Task 1: Основа проекта и модель данных

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `src/shared/types.ts`, `src/core/storage.ts`
- Test: `tests/storage.test.ts`

**Interfaces:**
- Produces: `loadState()`, `updateSettings()`, `addHistory()`, `addDictionaryEntry()`, `updateDictionaryEntry()`, `removeDictionaryEntry()`, `clearUserData()`.

- [ ] Написать тесты нормализации старого/повреждённого состояния, отключённой истории и защиты от дубликатов.
- [ ] Запустить `npm test -- tests/storage.test.ts` и увидеть ожидаемое падение из-за отсутствующих модулей.
- [ ] Реализовать типы и storage-репозиторий с внедряемым адаптером.
- [ ] Повторить тест и получить PASS.

### Task 2: Адаптер переводчика и перевод страницы

**Files:**
- Create: `src/core/translator.ts`, `src/core/page-translation.ts`
- Test: `tests/translator.test.ts`, `tests/page-translation.test.ts`

**Interfaces:**
- Consumes: `SourceLanguage`.
- Produces: `ChromeTranslator.translate(text, sourceMode, callbacks)`, `collectTextNodes(root)`, `chunkTextNodes(nodes, limit)`, `PageTranslationSession`.

- [ ] Написать тесты доступности API, fallback автодетекта, пакетирования, отмены и восстановления только неизменённых узлов.
- [ ] Запустить целевые тесты и увидеть ожидаемое падение.
- [ ] Реализовать адаптер и сессию перевода минимально для прохождения сценариев.
- [ ] Повторить тесты и получить PASS.

### Task 3: Manifest, фон и интерфейс страницы

**Files:**
- Create: `public/manifest.json`, `src/background.ts`, `src/content.ts`, `src/content.css`, `src/shared/messages.ts`, `public/icons/*`
- Test: `tests/messages.test.ts`

**Interfaces:**
- Consumes: translator, storage, page translation.
- Produces: контекстное меню, `TRANSLATE_SELECTION`, `TRANSLATE_PAGE`, `RESTORE_PAGE`, `GET_PAGE_STATUS`.

- [ ] Написать тесты валидации сообщений и requestId.
- [ ] Запустить тест и увидеть ожидаемое падение.
- [ ] Реализовать service worker, протокол и Shadow DOM интерфейс выделения.
- [ ] Повторить тест и получить PASS.

### Task 4: Popup и визуальная система

**Files:**
- Create: `popup.html`, `src/popup/popup.ts`, `src/popup/popup.css`, `src/popup/ui.ts`
- Test: `tests/popup-ui.test.ts`

**Interfaces:**
- Consumes: storage, translator и протокол сообщений.
- Produces: вкладки перевода, истории, словаря и настроек.

- [ ] Написать DOM-тесты вкладок, пустых состояний и формы словаря.
- [ ] Запустить тест и увидеть ожидаемое падение.
- [ ] Реализовать доступный popup и все действия пользователя.
- [ ] Повторить тест и получить PASS.

### Task 5: Сборка, документация и smoke-проверка

**Files:**
- Create: `README.md`, `scripts/smoke.mjs`
- Modify: `package.json`, `vite.config.ts`

**Interfaces:**
- Consumes: полный исходный код.
- Produces: папку `dist`, которую можно загрузить через `chrome://extensions`.

- [ ] Выполнить `npm test` и исправить реальные дефекты через новые падающие тесты.
- [ ] Выполнить `npm run typecheck` и `npm run build`.
- [ ] Проверить структуру `dist`, валидность manifest и наличие локальных ресурсов.
- [ ] Запустить Chrome с временным профилем и загруженным `dist`, проверить отсутствие ошибок расширения.
- [ ] Описать установку, подготовку модели, ограничения и ручной чек-лист в README.
