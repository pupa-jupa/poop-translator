# Multilingual translation and OCR implementation plan

**Goal:** Add DE, FR, ES and UK sources to manual, selection, page, region and PDF workflows without weakening local privacy or EN/RU compatibility.

**Spec:** `docs/superpowers/specs/2026-09-21-multilingual-ocr-design.md`.

## Task 1 — language contracts and migration

- [x] Add a shared language catalog and schema v3 migration with a persisted RU/EN target.
- [x] Generalize Translator and runtime validation while preserving synchronous user-activation preparation.

## Task 2 — OCR and UI

- [x] Bundle local `ukr`, `deu`, `fra` and `spa` models with notices and smoke checks.
- [x] Add source/target controls to popup and OCR-language control to PDF; update content selection, region and page workflows.

## Task 3 — release

- [x] Add focused migration, translator, message and browser coverage; update docs and version.
- [x] Run the complete verification matrix, update the installed folder, publish a stacked public PR and wait for CI.
