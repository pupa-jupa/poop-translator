# Review Cards Implementation Plan

Состояние на 2026-09-16: версия 1.4.0 реализована и проверена; этот план фиксирует выполненные шаги, а не очередь следующих функций.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Добавить локальные карточки повторения на основе личного словаря.

**Architecture:** Чистая функция считает сроки и выбирает доступные карточки. Storage v2 хранит только прогресс словарных ID в background-очереди, popup показывает вопрос, открывает ответ и отправляет оценку.

**Tech Stack:** TypeScript, Chrome MV3, `chrome.storage.local`, Vitest, Playwright, Vite.

**Spec:** `docs/superpowers/specs/2026-09-15-review-cards-design.md`

## Global Constraints

- История и словарь v1 должны пережить миграцию; JSON-импорт v1 и v2 объединяет данные.
- Все записи через `StorageClient` и `StorageRepository`; runtime payload проверяется перед приведением типа.
- Текст ответов выводится через `textContent`; масштаб, клавиатура и `prefers-reduced-motion` сохраняются.
- Нет новых разрешений, сетевых моделей, отправки пользовательских слов наружу или записи перевода страниц в историю.

---

### Task 1: Чистое расписание

**Files:** Create `src/core/review.ts`, `tests/review.test.ts`; modify `src/shared/types.ts`.

**Interfaces:** `ReviewRating = 'again' | 'hard' | 'good'`; `scheduleReview(dictionaryId, previous, rating, now): ReviewProgress`; `dueCards(state, now): DictionaryEntry[]`.

- [x] Написать тест: новый `cat` доступен сразу; `good` даёт сроки через 1, 3, 7 дней; `again` через 10 минут; `hard` через день и уменьшает серию.
- [x] Запустить `npm test -- tests/review.test.ts` и увидеть отсутствие функций.
- [x] Добавить чистые функции и типы с конечными timestamp и ограниченной серией.
- [x] Повторить тест и `npm run typecheck`.

### Task 2: Миграция, запись, резервная копия

**Files:** Modify `src/core/storage.ts`, `src/core/storage-client.ts`, `src/background.ts`; tests `tests/storage.test.ts`, `tests/storage-client.test.ts`.

**Interfaces:** `ExtensionState.schemaVersion: 2`, `ExtensionState.review: ReviewProgress[]`; `StorageRepository.rateReview(id, rating, now?)`; `StorageClient.rateReview(id, rating)`; `ExtensionBackup.version: 2`.

- [x] Написать тесты миграции v1 с сохранением словаря/истории, v1/v2-импорта, remap одинаковой пары, удаления прогресса и отказа записи.
- [x] Запустить `npm test -- tests/storage.test.ts tests/storage-client.test.ts` и увидеть корректные падения.
- [x] Добавить v2-нормализацию, расписание через `scheduleReview`, remap ID при импорте и проверенный runtime payload `rateReview`.
- [x] Запустить целевые тесты и `npm run typecheck`.

### Task 3: Карточка в popup

**Files:** Modify `src/popup/ui.ts`, `src/popup/popup.ts`, `src/popup/popup.css`; tests `tests/popup-ui.test.ts`.

**Interfaces:** `data-tab="review"`, `data-view="review"`, `data-review-card`, `data-review-reveal`, `data-review-rating`.

- [x] Добавить тест вкладки, панели и существующего стрелочного управления вкладками.
- [x] Запустить `npm test -- tests/popup-ui.test.ts` и увидеть отсутствие элементов.
- [x] Сделать вопрос/ответ нативными элементами, обеспечить фокус после оценки и понятную ошибку записи.
- [x] Запустить тесты и `npm run typecheck`.

### Task 4: Браузер и документация

**Files:** Modify `scripts/browser-smoke.mjs`, `README.md`, `CHANGELOG.md`, `docs/testing.md`, `AGENTS.md`, `public/manifest.json`, `package.json` и lock; rebuild `dist/`.

**Interfaces:** В browser smoke добавленная словарная пара переходит в «Карточки» и после `good` получает срок завтра; v1 JSON-импорт остаётся рабочим.

- [x] Добавить проверку раскрытия, оценки, хранения и повторного открытия popup к браузерному сценарию.
- [x] Обновить русские инструкции, схему данных и версию 1.4.0 вместе с собранным manifest.
- [x] Выполнить `npm test`, `npm run typecheck`, `npm run build`, `npm run smoke`, `npm run smoke:browser`, `npm run smoke:ocr`, `git diff --check`.
- [x] Просмотреть `dist/`, коммит и публичную ветку только после зелёных проверок.
