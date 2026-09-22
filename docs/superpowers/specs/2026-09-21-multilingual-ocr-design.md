# Multilingual translation and OCR design

## Goal

Extend the local translator with German, French, Spanish and Ukrainian while preserving English and Russian as the primary targets. The same source-language choice applies to manual text, page selections and region OCR; PDF scans get their own OCR-language selector.

## Supported languages

The source selector offers auto-detection, English, Russian, Ukrainian, German, French and Spanish. Translation targets remain Russian or English so the existing product focus, dictionary variants and context-menu shortcuts remain clear. Chrome Translator receives BCP 47 codes; Tesseract receives the matching `eng`, `rus`, `ukr`, `deu`, `fra` or `spa` model.

Auto OCR remains EN + RU because combining every Latin model reduces recognition quality and increases memory use. To recognize Ukrainian, German, French or Spanish, the user chooses that source explicitly. Auto translation detection considers all six languages.

## State and compatibility

State schema v3 adds `settings.targetLanguage`. Migration from v1/v2 keeps all history, dictionary and review progress. Existing RU source settings migrate to EN target; EN and auto migrate to RU target. Backup format v3 remains able to import v1 and v2.

History continues to store only completed non-page translations. The source code may be any supported language; the target remains `ru` or `en`. Local dictionary variants remain EN ↔ RU only; other pairs still save normally to the personal dictionary and cards.

## Activation and failure handling

All `Translator.create()` calls needed by the selected mode start synchronously in the user click task. Explicit source mode prepares one pair. Auto mode prepares each supported source except the selected target before the first await. Unsupported Chrome pairs fail with a Russian message naming both languages.

OCR models and code ship inside the extension. No user text, image or PDF is sent to a server. Runtime payloads validate language codes at every boundary.
