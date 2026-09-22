# Сторонние данные

## FreeDict + WikDict dictionaries

Файлы `public/dictionary/eng-rus/*.json` и `public/dictionary/rus-eng/*.json` созданы из работ **English-Русский FreeDict+WikDict dictionary** и **Русский-English FreeDict+WikDict dictionary**, версия 2025.11.23.

- Издатель и сопровождающий обеих работ: Karl Bartel
- Автоматическое создание двуязычных словарей: [WikDict](http://www.wikdict.com/)
- Исходные данные: [Wiktionary](https://www.wiktionary.org/) через [DBnary](http://kaiko.getalp.org/about-dbnary/)

- Источник: https://download.freedict.org/generated/eng-rus/eng-rus.tei
- Источник обратного словаря: https://download.freedict.org/generated/rus-eng/rus-eng.tei
- Проект: https://freedict.org/
- Лицензия данных: Creative Commons Attribution-ShareAlike 3.0 Unported
- Текст лицензии: https://creativecommons.org/licenses/by-sa/3.0/legalcode

Данные преобразованы в компактные JSON-файлы, разбитые по направлению и первой букве. Ударения U+0301 и служебная разметка источника удалены для более чистого отображения; значения и обозначения частей речи сохранены. Преобразованные данные распространяются на тех же условиях CC BY-SA 3.0.

## Tesseract.js и OCR-модели

Локальное распознавание использует следующие пакеты, включённые в собранное расширение:

- `tesseract.js` 7.0.0 и `tesseract.js-core` 7.0.0 — Apache License 2.0, проект [naptha/tesseract.js](https://github.com/naptha/tesseract.js);
- `@tesseract.js-data/eng`, `rus`, `ukr`, `deu`, `fra`, `spa`, `jpn`, `kor`, `chi_sim` и `chi_tra` 1.0.0 — в метаданных npm-пакетов указана MIT; сами модели `4.0.0_best_int` основаны на [tessdata_best](https://github.com/tesseract-ocr/tessdata_best), где данные лицензированы под Apache-2.0.

Worker, WebAssembly core и сжатые модели поставляются локально в `dist/ocr/`. Они не загружаются с CDN во время работы расширения. В `dist/ocr/LICENSE-APACHE-2.0.txt` включён полный текст Apache-2.0; уведомления о стороннем коде в worker лежат рядом с ним.

## PDF.js

Локальное чтение PDF использует `pdfjs-dist` / Mozilla PDF.js 6.3.289 под Apache License 2.0. Код библиотеки и module worker входят в сборку расширения и не загружаются с CDN. Полный текст лицензии копируется в `dist/pdf/LICENSE-APACHE-2.0.txt`.
