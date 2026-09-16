# Page Target Implementation Plan

**Goal:** Дать пользователю явный целевой язык для перевода всей страницы и не менять фрагменты уже на этом языке.

**Spec:** `docs/superpowers/specs/2026-09-16-page-target-design.md`.

**Architecture:** Добавить `pageTargetLanguage` в настройки v2 с нормализацией прежних сохранений. Popup передаёт target в сообщение; content script подтверждает цель и запускает до первого `await` нужный Chrome Translator и detector. PageTranslationSession продолжает управлять DOM и отменой.

## Task 1 — модель и настройка

- [x] Тесты: старые v1/v2 данные получают target RU; сохранение EN переживает backup; неверный runtime patch отклоняется.
- [x] Реализация типа, нормализации и валидатора; целевые тесты и typecheck.

## Task 2 — перевод только к цели

- [x] Тесты: подготовка EN→RU или RU→EN начинается синхронно; текст уже на цели возвращается без создания обратной пары.
- [x] Реализация `prepareForPageTarget` и `translatePageText`; целевые тесты и typecheck.

## Task 3 — popup, сообщение и подтверждение

- [x] Тесты русского select и runtime target; browser smoke проверяет выбор и текст подтверждения.
- [x] Popup сохраняет target; content script показывает цель, запускает подготовку и передаёт фрагменты новому методу.
- [x] Browser smoke и typecheck.

## Task 4 — выпуск

- [x] Обновить manifest/package до 1.5.0, README, CHANGELOG, testing, архитектуру и AGENTS.md.
- [x] `npm test`, `npm run typecheck`, `npm run build`, `npm run smoke`, `npm run smoke:browser`, `git diff --check`; просмотреть `dist`.
- [x] Обновить установленную папку, публичный коммит и отдельный PR на базе `codex/review-cards` после зелёных проверок.
