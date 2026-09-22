export type PopupTab = 'translate' | 'history' | 'dictionary' | 'review' | 'settings';

const brandIcon = `
  <svg viewBox="0 0 48 48" aria-hidden="true">
    <path fill="currentColor" d="M9 36c0-5 4-9 10-10-5-1-7-5-5-9 1-4 5-6 9-5-2-3 0-7 4-9 1 5 5 6 8 9 2 3 1 5-1 7 5 1 9 4 9 9 0 4-3 7-5 8 2 1 3 4 3 6H10c-1-2-1-4-1-6Z"/>
    <circle cx="21" cy="27" r="2.2" fill="#221b29"/><circle cx="32" cy="27" r="2.2" fill="#221b29"/>
    <path d="M20 34c4 3 9 3 13 0" stroke="#221b29" stroke-width="2.3" stroke-linecap="round"/>
  </svg>`;

export function mountPopupShell(root: HTMLElement): void {
  root.innerHTML = `
    <main class="app-shell">
      <header class="brand-header">
        <div class="brand-mark">${brandIcon}</div>
        <div class="brand-copy">
          <h1>poop translator</h1>
          <p>карманный переводчик</p>
        </div>
        <div class="engine-pill" data-engine-status title="Состояние локального переводчика">
          <span class="engine-dot"></span><span>Проверяю</span>
        </div>
      </header>

      <nav class="tab-bar" role="tablist" aria-label="Разделы">
        <button id="tab-translate" role="tab" data-tab="translate" aria-controls="panel-translate" aria-selected="true" tabindex="0">Перевод</button>
        <button id="tab-history" role="tab" data-tab="history" aria-controls="panel-history" aria-selected="false" tabindex="-1">История</button>
        <button id="tab-dictionary" role="tab" data-tab="dictionary" aria-controls="panel-dictionary" aria-selected="false" tabindex="-1">Словарь</button>
        <button id="tab-review" role="tab" data-tab="review" aria-controls="panel-review" aria-selected="false" tabindex="-1">Карточки</button>
        <button id="tab-settings" role="tab" data-tab="settings" aria-controls="panel-settings" aria-selected="false" tabindex="-1">Настройки</button>
      </nav>

      <div class="views">
        <section id="panel-translate" class="view" data-view="translate" role="tabpanel" aria-labelledby="tab-translate">
          <div class="language-row">
            <label>Исходный язык
              <select data-control="source-mode">
                <option value="en">Английский</option>
                <option value="ru">Русский</option>
                <option value="uk">Украинский</option>
                <option value="de">Немецкий</option>
                <option value="fr">Французский</option>
                <option value="es">Испанский</option>
                <option value="auto">Авто · 6 языков</option>
              </select>
            </label>
            <span class="language-arrow">→</span>
            <label>Перевод
              <select data-control="target-language"><option value="ru">Русский</option><option value="en">Английский</option></select>
            </label>
          </div>

          <section class="region-tool">
            <div class="region-tool__icon" aria-hidden="true">⌗</div>
            <div><span class="section-kicker">Текст на картинке</span><p>Выделите область страницы — распознаю и переведу её локально.</p></div>
            <button class="button button--accent button--small" type="button" data-action="translate-region">Выбрать область</button>
          </section>

          <section class="pdf-tool">
            <div class="pdf-tool__icon" aria-hidden="true">PDF</div>
            <div><span class="section-kicker">Документы</span><p>Откройте PDF в отдельной вкладке — текст и сканы останутся на устройстве.</p></div>
            <button class="button button--soft button--small" type="button" data-action="open-pdf">Открыть PDF</button>
          </section>

          <form class="translate-form" data-form="translate">
            <label class="sr-only" for="source-text">Текст для перевода</label>
            <textarea id="source-text" aria-label="Текст для перевода" maxlength="10000" placeholder="Напишите что-нибудь на английском…"></textarea>
            <div class="composer-footer">
              <span data-char-count>0 / 10 000</span>
              <span class="enter-hint">Ctrl + Enter</span>
            </div>
            <button class="button button--hero" type="submit"><span>Перевести</span><span aria-hidden="true">↗</span></button>
          </form>

          <article class="result-card" data-result hidden>
            <div class="result-head"><span>Результат</span><span data-result-language></span></div>
            <p class="result-original" data-result-original></p>
            <div class="result-divider"></div>
            <p class="result-translation" data-result-translation></p>
            <section class="result-variants" data-result-variants aria-label="Варианты перевода" hidden>
              <div class="result-variants__head"><span>Другие значения</span><small>локальный словарь</small></div>
              <div class="result-variants__list" data-result-variants-list></div>
            </section>
            <div class="result-actions">
              <button class="button button--soft" type="button" data-action="copy-result">Копировать</button>
              <button class="button button--accent" type="button" data-action="save-result">♡ В словарь</button>
            </div>
          </article>

          <div class="inline-error" data-translate-error role="alert" hidden></div>

          <section class="page-tools">
            <div><span class="section-kicker">Вся страница</span><p data-page-status aria-live="polite">Переведу основной текст, сохранив кнопки и ссылки.</p></div>
            <div class="page-actions">
              <label class="page-target"><span>Язык страницы</span><select data-control="page-target-language" aria-label="Перевести страницу на"><option value="ru">На русский</option><option value="en">На английский</option></select></label>
              <button class="button button--soft" type="button" data-action="translate-page">Перевести страницу</button>
              <button class="icon-button" type="button" aria-label="Вернуть оригинал" title="Вернуть оригинал" data-action="restore-page">↶</button>
            </div>
          </section>
        </section>

        <section id="panel-history" class="view" data-view="history" role="tabpanel" aria-labelledby="tab-history" hidden>
          <div class="section-head"><div><span class="section-kicker">Недавнее</span><h2>История</h2></div><button class="text-button" type="button" data-action="clear-history">Очистить</button></div>
          <label class="search-box"><span aria-hidden="true">⌕</span><input type="search" data-search="history" placeholder="Найти перевод" aria-label="Поиск в истории"></label>
          <div class="item-list" data-history-list></div>
        </section>

        <section id="panel-dictionary" class="view" data-view="dictionary" role="tabpanel" aria-labelledby="tab-dictionary" hidden>
          <div class="section-head"><div><span class="section-kicker">Мои слова</span><h2>Словарь</h2></div><button class="button button--accent button--small" type="button" data-action="add-word">+ Добавить</button></div>
          <label class="search-box"><span aria-hidden="true">⌕</span><input type="search" data-search="dictionary" placeholder="Найти слово" aria-label="Поиск в словаре"></label>
          <div class="item-list" data-dictionary-list></div>
        </section>

        <section id="panel-review" class="view" data-view="review" role="tabpanel" aria-labelledby="tab-review" hidden>
          <div class="section-head"><div><span class="section-kicker">Вспомнить с любовью</span><h2>Карточки</h2></div><span class="review-count" data-review-due aria-live="polite"></span></div>
          <p class="review-intro">Сначала вспомните перевод, затем откройте ответ и выберите, когда повторить слово.</p>
          <div data-review-list></div>
        </section>

        <section id="panel-settings" class="view" data-view="settings" role="tabpanel" aria-labelledby="tab-settings" hidden>
          <div class="section-head"><div><span class="section-kicker">Под себя</span><h2>Настройки</h2></div></div>
          <div class="settings-group">
            <label class="setting-row setting-row--stack"><span><strong>Исходный язык</strong><small>Для текста, выделения и OCR области</small></span>
              <select data-control="settings-source-mode"><option value="en">Английский</option><option value="ru">Русский</option><option value="uk">Украинский</option><option value="de">Немецкий</option><option value="fr">Французский</option><option value="es">Испанский</option><option value="auto">Авто · 6 языков</option></select>
            </label>
            <label class="setting-row setting-row--stack"><span><strong>Язык перевода</strong><small>Русский или английский</small></span>
              <select data-control="settings-target-language"><option value="ru">Русский</option><option value="en">Английский</option></select>
            </label>
            <label class="setting-row"><span><strong>Сохранять историю</strong><small>Ручные, выделенные и OCR-переводы</small></span><input class="switch" type="checkbox" aria-label="Сохранять историю" data-control="save-history"></label>
            <label class="setting-row"><span><strong>Кнопка у выделения</strong><small>Показывать маленького помощника на страницах</small></span><input class="switch" type="checkbox" aria-label="Показывать кнопку возле выделения" data-control="selection-button"></label>
            <label class="setting-row setting-row--stack"><span><strong>Размер текста</strong><small>Меняет popup и подсказки на страницах</small></span>
              <select data-control="text-scale"><option value="100">Обычный</option><option value="115">Крупный</option><option value="130">Очень крупный</option></select>
            </label>
          </div>

          <div class="engine-card">
            <div class="engine-card__icon">${brandIcon}</div>
            <div><strong>Локальный движок Chrome</strong><p data-engine-detail>Проверяю доступность…</p></div>
            <button class="button button--soft button--small" type="button" data-action="prepare-engine">Подготовить</button>
          </div>

          <div class="danger-zone">
            <span class="section-kicker">Данные на устройстве</span>
            <button type="button" data-action="export-data"><span><strong>Экспорт данных</strong><small>Сохранить JSON с историей, словарём и карточками</small></span><span>↓</span></button>
            <button type="button" data-action="import-data"><span><strong>Импорт данных</strong><small>Объединить с данными на устройстве</small></span><span>↑</span></button>
            <input type="file" accept="application/json,.json" data-import-file hidden>
            <button type="button" data-action="clear-history-settings"><span><strong>Очистить историю</strong><small>Словарь останется</small></span><span>›</span></button>
            <button type="button" data-action="clear-dictionary"><span><strong>Очистить словарь</strong><small>История останется</small></span><span>›</span></button>
            <button class="danger" type="button" data-action="clear-all"><span><strong>Сбросить все данные</strong><small>Вернуть начальные настройки</small></span><span>›</span></button>
          </div>
        </section>
      </div>
    </main>

    <dialog class="modal" data-word-modal>
      <form method="dialog" data-form="word">
        <div class="modal-head"><div><span class="section-kicker">Личный словарь</span><h2 data-word-modal-title>Новое слово</h2></div><button class="icon-button" value="cancel" aria-label="Закрыть" type="submit">✕</button></div>
        <input type="hidden" data-word-id>
        <label>Слово или фраза<input required maxlength="500" data-word-original></label>
        <label>Перевод<input required maxlength="500" data-word-translation></label>
        <label>Заметка <span>(необязательно)</span><textarea maxlength="1000" data-word-note></textarea></label>
        <div class="modal-actions"><button class="button button--soft" value="cancel" type="submit">Отмена</button><button class="button button--accent" value="default" type="submit" data-word-save>Сохранить</button></div>
      </form>
    </dialog>

    <dialog class="modal modal--confirm" data-confirm-modal>
      <form method="dialog">
        <div class="confirm-icon">!</div><h2 data-confirm-title>Очистить данные?</h2><p data-confirm-text></p>
        <div class="modal-actions"><button class="button button--soft" value="cancel">Отмена</button><button class="button button--danger" value="confirm" data-confirm-button>Очистить</button></div>
      </form>
    </dialog>
    <div class="toast" data-toast role="status" aria-live="polite" hidden></div>`;
}

export function activateTab(root: ParentNode, tab: PopupTab): void {
  root.querySelectorAll<HTMLElement>('[data-tab]').forEach((element) => {
    const selected = element.dataset.tab === tab;
    element.setAttribute('aria-selected', String(selected));
    element.tabIndex = selected ? 0 : -1;
  });
  root.querySelectorAll<HTMLElement>('[data-view]').forEach((element) => {
    element.hidden = element.dataset.view !== tab;
  });
}
