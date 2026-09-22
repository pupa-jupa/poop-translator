import"./modulepreload-polyfill-B5Qt9EMX.js";import{s as Ht,D as Pt,c as Ut,S as Bt,g as Ft,d as jt}from"./storage-client-BtIZuK7C.js";import{c as S}from"./messages-DPPa0ZHg.js";import{C as Gt}from"./translator-Dq9POm8-.js";import{s as Vt}from"./languages-D6_hPaBp.js";async function Kt(t,a,e){if(e!=="en"&&e!=="ru")return[];try{const n=await chrome.runtime.sendMessage({type:"LOOKUP_DICTIONARY",requestId:S(),text:t,sourceLanguage:e});return!n.ok||!Array.isArray(n.data)?[]:Ht(n.data,a)}catch{return[]}}async function Jt(t){try{return await t()?{status:"saved"}:{status:"skipped"}}catch(a){return{status:"failed",message:a instanceof Error?a.message:"Не удалось сохранить историю"}}}const gt=`
  <svg viewBox="0 0 48 48" aria-hidden="true">
    <path fill="currentColor" d="M9 36c0-5 4-9 10-10-5-1-7-5-5-9 1-4 5-6 9-5-2-3 0-7 4-9 1 5 5 6 8 9 2 3 1 5-1 7 5 1 9 4 9 9 0 4-3 7-5 8 2 1 3 4 3 6H10c-1-2-1-4-1-6Z"/>
    <circle cx="21" cy="27" r="2.2" fill="#221b29"/><circle cx="32" cy="27" r="2.2" fill="#221b29"/>
    <path d="M20 34c4 3 9 3 13 0" stroke="#221b29" stroke-width="2.3" stroke-linecap="round"/>
  </svg>`;function Wt(t){t.innerHTML=`
    <main class="app-shell">
      <header class="brand-header">
        <div class="brand-mark">${gt}</div>
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
            <div class="engine-card__icon">${gt}</div>
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
    <div class="toast" data-toast role="status" aria-live="polite" hidden></div>`}function xt(t,a){t.querySelectorAll("[data-tab]").forEach(e=>{const n=e.dataset.tab===a;e.setAttribute("aria-selected",String(n)),e.tabIndex=n?0:-1}),t.querySelectorAll("[data-view]").forEach(e=>{e.hidden=e.dataset.view!==a})}const N=document.querySelector("#app");Wt(N);function o(t){const a=document.querySelector(t);if(!a)throw new Error(`Missing UI element: ${t}`);return a}const d=Ft(),O=new Gt;let r=structuredClone(Pt),b,bt=0,J=!1,q=0,mt=0,A,w=!1,C=0,W=0;const E=o("#source-text"),zt=o("[data-char-count]"),lt=o('[data-form="translate"]'),ht=lt.querySelector('button[type="submit"]'),x=o('[data-control="source-mode"]'),tt=o('[data-control="settings-source-mode"]'),L=o('[data-control="target-language"]'),et=o('[data-control="settings-target-language"]'),R=o('[data-control="page-target-language"]'),at=o('[data-control="save-history"]'),nt=o('[data-control="selection-button"]'),P=o('[data-control="text-scale"]'),U=o("[data-import-file]"),ct=o("[data-result]"),Yt=o("[data-result-original]"),Zt=o("[data-result-translation]"),Qt=o("[data-result-language]"),ft=o("[data-result-variants]"),yt=o("[data-result-variants-list]"),D=o("[data-translate-error]"),wt=o("[data-engine-status]"),M=o("[data-engine-detail]"),z=o("[data-history-list]"),Y=o("[data-dictionary-list]"),g=o("[data-review-list]"),Et=o("[data-review-due]"),H=o("#panel-review h2"),Lt=o('[data-search="history"]'),kt=o('[data-search="dictionary"]'),_=o("[data-page-status]"),Ct=o("[data-word-modal]"),Xt=o('[data-form="word"]'),ot=o("[data-word-id]"),it=o("[data-word-original]"),St=o("[data-word-translation]"),Tt=o("[data-word-note]"),te=o("[data-word-modal-title]"),Z=o("[data-confirm-modal]"),ee=o("[data-confirm-title]"),ae=o("[data-confirm-text]"),Q=o("[data-toast]");function i(t){window.clearTimeout(bt),Q.textContent=t,Q.hidden=!1,bt=window.setTimeout(()=>{Q.hidden=!0},1900)}function X(t,a="Перевести"){ht.disabled=t,ht.querySelector("span").textContent=t?"Перевожу…":a}function st(){x.value=r.settings.sourceMode,tt.value=r.settings.sourceMode,L.value=r.settings.targetLanguage,et.value=r.settings.targetLanguage,R.value=r.settings.pageTargetLanguage,at.checked=r.settings.saveHistory,nt.checked=r.settings.showSelectionButton,P.value=String(r.settings.textScale),document.documentElement.dataset.textScale=String(r.settings.textScale)}function ne(t){return{manual:"вручную",selection:"выделение","context-menu":"контекстное меню","ocr-region":"область экрана"}[t.source]}function B(t){return new Intl.DateTimeFormat("ru-RU",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"}).format(t)}function F(t,a,e){const n=document.createElement("div");return n.className="empty-state",n.innerHTML='<div class="empty-state__face"></div><strong></strong><p></p>',n.querySelector(".empty-state__face").textContent=t,n.querySelector("strong").textContent=a,n.querySelector("p").textContent=e,n}function $(t,a){const e=document.createElement("button");return e.type="button",e.className="mini-action",e.textContent=t,e.addEventListener("click",()=>{a()}),e}function qt(){const t=Lt.value.trim().toLocaleLowerCase(),a=r.history.filter(e=>!t||e.original.toLocaleLowerCase().includes(t)||e.translation.toLocaleLowerCase().includes(t));if(z.replaceChildren(),!a.length){z.append(F("◷",t?"Ничего не нашлось":"Пока пусто",t?"Попробуйте другой запрос.":"Ваши ручные переводы и переводы выделений появятся здесь."));return}for(const e of a){const n=document.createElement("article");n.className="item-card",n.innerHTML=`
      <div class="item-main"><p></p><span class="item-arrow">→</span><p></p></div>
      <div class="item-meta"><span></span><div class="item-buttons"></div></div>`;const s=n.querySelectorAll("p");s[0].textContent=e.original,s[1].textContent=e.translation,n.querySelector(".item-meta > span").textContent=`${ne(e)} · ${B(e.createdAt)}`,n.querySelector(".item-buttons").append($("♡ В словарь",async()=>{const c=await d.addDictionaryEntry(e);await l(),i(c.added?"Добавлено в словарь":"Уже в словаре")}),$("Удалить",async()=>{await d.removeHistoryEntry(e.id),await l()})),z.append(n)}}function At(t){ot.value=t?.id??"",it.value=t?.original??"",St.value=t?.translation??"",Tt.value=t?.note??"",te.textContent=t?"Изменить запись":"Новое слово",Ct.showModal(),window.setTimeout(()=>it.focus(),0)}function Dt(){const t=kt.value.trim().toLocaleLowerCase(),a=r.dictionary.filter(e=>!t||e.original.toLocaleLowerCase().includes(t)||e.translation.toLocaleLowerCase().includes(t)||e.note.toLocaleLowerCase().includes(t));if(Y.replaceChildren(),!a.length){Y.append(F("♡",t?"Ничего не нашлось":"Ваш словарь ждёт",t?"Проверьте написание или заметку.":"Добавляйте сюда полезные слова и фразы одним нажатием."));return}for(const e of a){const n=document.createElement("article");n.className="item-card",n.innerHTML=`
      <div class="item-main"><p></p><span class="item-arrow">→</span><p></p></div>
      <div class="item-meta"><span></span><div class="item-buttons"></div></div>`;const s=n.querySelectorAll("p");s[0].textContent=e.original,s[1].textContent=e.translation,n.querySelector(".item-meta > span").textContent=e.note||B(e.updatedAt),n.querySelector(".item-buttons").append($("Изменить",()=>At(e)),$("Удалить",async()=>{await d.removeDictionaryEntry(e.id),await l()})),Y.append(n)}}function rt(){const t=jt(r,Date.now()),a=`${t.length} сейчас`,e=t[0],n=g.querySelector("[data-review-card]");if(e&&n?.dataset.reviewCard===e.id&&Et.textContent===a&&n.querySelector(".review-question")?.textContent===e.original&&n.querySelector(".review-answer p")?.textContent===e.translation&&n.querySelector(".review-answer")?.hidden===(A!==e.id))return;if(Et.textContent=a,g.replaceChildren(),!e){if(A=void 0,r.dictionary.length){const v=Math.min(...r.review.map(K=>K.dueAt));g.append(F("✿","Все карточки пройдены",Number.isFinite(v)?`Следующее повторение: ${B(v)}.`:"Загляните позже."))}else{g.append(F("♡","Слов пока нет","Добавьте первую пару в словарь, чтобы начать повторение."));const v=$("Открыть словарь",()=>{xt(N,"dictionary"),o('[data-action="add-word"]').focus()});v.className="button button--accent review-empty-action",g.append(v)}return}const s=document.createElement("article");s.className="review-card",s.dataset.reviewCard=e.id;const p=document.createElement("span");p.className="section-kicker",p.textContent="Как это переводится?";const c=document.createElement("p");c.className="review-question",c.textContent=e.original;const u=document.createElement("button");u.type="button",u.className="button button--accent review-reveal",u.dataset.reviewReveal="",u.textContent="Показать перевод";const m=document.createElement("div");m.className="review-answer",m.hidden=A!==e.id;const V=document.createElement("span");V.className="section-kicker",V.textContent="Ответ";const dt=document.createElement("p");dt.textContent=e.translation,m.append(V,dt);const h=document.createElement("div");h.className="review-actions",h.hidden=m.hidden;const Ot=[["again","Повторить","через 10 минут"],["hard","Сложно","завтра"],["good","Знаю","дольше"]];for(const[v,K,$t]of Ot){const f=document.createElement("button");f.type="button",f.className="review-rating",f.dataset.reviewRating=v;const ut=document.createElement("strong");ut.textContent=K;const pt=document.createElement("small");pt.textContent=$t,f.append(ut,pt),f.disabled=w,f.addEventListener("click",()=>{w||(w=!0,C+=1,h.querySelectorAll("button").forEach(T=>{T.disabled=!0}),(async()=>{let T;try{T=await d.rateReview(e.id,v)}catch(y){w=!1,C+=1,rt(),g.querySelectorAll("[data-review-rating]").forEach(It=>{It.disabled=!1});const vt=g.querySelector(`[data-review-rating="${v}"]`);vt?vt.focus():(H.tabIndex=-1,H.focus()),i(y instanceof Error?y.message:"Не удалось сохранить повторение"),l().catch(()=>{});return}A=void 0,w=!1,C+=1,r.review=[...r.review.filter(y=>y.dictionaryId!==e.id),T];try{rt(),i(`Повторим: ${B(T.dueAt)}`);const y=g.querySelector("[data-review-reveal]");y?y.focus():(H.tabIndex=-1,H.focus()),l().catch(()=>{})}catch{i("Повторение сохранено. Откройте карточки снова.")}})())}),h.append(f)}u.hidden=!m.hidden,u.addEventListener("click",()=>{A=e.id,u.hidden=!0,m.hidden=!1,h.hidden=!1,h.querySelector("button")?.focus()}),s.append(p,c,u,m,h),g.append(s)}async function l(){const t=++C,a=await d.loadState();t!==C||w||(r=a,st(),qt(),Dt(),w||rt())}async function _t(t){const a=L.value;await Rt(t,t!=="auto"&&t===a?t==="ru"?"en":"ru":a)}async function Nt(t){const a=x.value;await Rt(a===t?"auto":a,t)}async function Rt(t,a){const e=++W;C+=1,r={...r,settings:{...r.settings,sourceMode:t,targetLanguage:a}},st();try{const n=await d.updateSettings({sourceMode:t,targetLanguage:a});if(e!==W)return;r={...r,settings:n},st()}catch(n){throw e===W&&await l().catch(()=>{}),n}}function oe(t){return{n:"сущ.",v:"гл.",adj:"прил.",adv:"нареч.",pn:"имя",pronoun:"мест.",preposition:"предл.",conjunction:"союз",interjection:"межд.",proverb:"посл.",phraseologicalUnit:"фраза"}[t??""]??""}function ie(t,a){const e=document.createElement("button");e.className="result-variant",e.type="button",e.setAttribute("aria-label",`Добавить «${a.translation}» в словарь`);const n=document.createElement("span");n.className="result-variant__meaning",n.textContent=a.translation;const s=document.createElement("span");return s.className="result-variant__meta",s.textContent=`${oe(a.partOfSpeech)} ＋`.trim(),e.append(n,s),e.addEventListener("click",()=>{e.disabled=!0,d.addDictionaryEntry({original:t.original,translation:a.translation}).then(async({added:p})=>{await l(),s.textContent=p?"добавлено ✓":"уже есть ✓",i(p?"Вариант добавлен в словарь":"Уже в словаре")}).catch(()=>{e.disabled=!1,i("Не удалось добавить вариант")})}),e}async function se(t){if(ft.hidden=!0,yt.replaceChildren(),t.alreadyTarget)return;const a=await Kt(t.original,t.translation,t.sourceLanguage);b!==t||!a.length||(yt.append(...a.map(e=>ie(t,e))),ft.hidden=!1)}function re(t){b=t,Yt.textContent=t.original,Zt.textContent=t.alreadyTarget?"Текст уже на выбранном языке":t.translation,Qt.textContent=`${t.sourceLanguage.toUpperCase()} → ${t.targetLanguage.toUpperCase()}`,ct.hidden=!1,o('[data-action="save-result"]').disabled=t.alreadyTarget,se(t)}async function k(){const t=x.value,a=L.value,e=++mt,n=t==="auto"?await Promise.all(Vt(a).map(u=>O.getAvailability(u,a))):[await O.getAvailability(t,a)],s=n.includes("unavailable")?"unavailable":n.includes("downloadable")?"downloadable":n.includes("downloading")?"downloading":"available";if(e!==mt||x.value!==t||L.value!==a)return;wt.dataset.state=s;const p={available:"Готов",downloadable:"Нужна загрузка",downloading:"Загрузка",unavailable:"Недоступен"}[s],c={available:t==="auto"?"Обе языковые пары готовы на устройстве.":"Языковой пакет готов. Перевод выполняется на устройстве.",downloadable:"Нажмите «Подготовить», чтобы бесплатно скачать языковой пакет.",downloading:"Chrome загружает языковой пакет.",unavailable:"Нужен настольный Google Chrome 138 или новее."}[s];wt.querySelector("span:last-child").textContent=p,M.textContent=c}async function j(t){const[a]=await chrome.tabs.query({active:!0,currentWindow:!0});if(!a?.id||!a.url?.match(/^https?:\/\//))throw new Error("На этой странице перевод недоступен. Откройте обычный сайт http/https.");try{return await chrome.tabs.sendMessage(a.id,t)}catch{throw new Error("Обновите страницу после установки расширения и повторите.")}}function I(t){switch(t.state){case"awaiting-activation":_.textContent="Подтвердите запуск внизу открытой страницы.";break;case"translating":_.textContent=t.total?`Переведено ${t.completed} из ${t.total} фрагментов…`:"Подготавливаю локальный переводчик…";break;case"translated":_.textContent=t.error??`Готово: ${t.completed} фрагментов.`;break;case"error":_.textContent=t.error??"Не удалось перевести страницу.";break;default:_.textContent="Переведу основной текст, сохранив кнопки и ссылки."}}function G(t,a,e){return ee.textContent=t,ae.textContent=a,o("[data-confirm-button]").textContent=e,Z.showModal(),new Promise(n=>{Z.addEventListener("close",()=>n(Z.returnValue==="confirm"),{once:!0})})}N.querySelectorAll('[role="tab"]').forEach(t=>{t.addEventListener("click",()=>{xt(N,t.dataset.tab),window.scrollTo({top:0,behavior:"instant"})}),t.addEventListener("keydown",a=>{const e=Array.from(N.querySelectorAll('[role="tab"]')),n=e.indexOf(t),s=a.key==="ArrowRight"?(n+1)%e.length:a.key==="ArrowLeft"?(n-1+e.length)%e.length:a.key==="Home"?0:a.key==="End"?e.length-1:-1;s<0||(a.preventDefault(),e[s]?.click(),e[s]?.focus())})});E.addEventListener("input",()=>{zt.textContent=`${E.value.length.toLocaleString("ru-RU")} / 10 000`});E.addEventListener("keydown",t=>{t.key==="Enter"&&(t.ctrlKey||t.metaKey)&&(t.preventDefault(),lt.requestSubmit())});lt.addEventListener("submit",t=>{if(t.preventDefault(),J)return;const a=E.value.trim();if(!a){D.textContent="Напишите текст, который нужно перевести.",D.hidden=!1,E.focus();return}const e=x.value,n=++q;J=!0;const s=L.value,p=O.prepareForMode(e,{onProgress(c){n===q&&(X(!0,`Загрузка ${c}%`),M.textContent=`Загружаю языковой пакет: ${c}%`)}},s);(async()=>{D.hidden=!0,ct.hidden=!0,X(!0);try{await p;const c=await O.translate(a,e,{},s);if(n!==q)return;if(re(c),!c.alreadyTarget){const u=await Jt(()=>d.addHistory({requestId:S(),original:c.original,translation:c.translation,sourceLanguage:c.sourceLanguage,targetLanguage:c.targetLanguage,source:"manual"}));u.status==="failed"?i("Перевод готов, историю сохранить не удалось"):u.status==="saved"&&await l().catch(()=>i("Перевод готов, историю обновить не удалось"))}await k()}catch(c){if(n!==q)return;D.textContent=c instanceof Error?c.message:"Не удалось выполнить перевод.",D.hidden=!1}finally{n===q&&(J=!1,X(!1))}})()});x.addEventListener("change",()=>{_t(x.value).then(k).catch(t=>i(t instanceof Error?t.message:"Не удалось сохранить направление"))});tt.addEventListener("change",()=>{_t(tt.value).then(k).catch(t=>i(t instanceof Error?t.message:"Не удалось сохранить направление"))});L.addEventListener("change",()=>{Nt(L.value).then(k).catch(t=>i(t instanceof Error?t.message:"Не удалось сохранить язык перевода"))});et.addEventListener("change",()=>{Nt(et.value).then(k).catch(t=>i(t instanceof Error?t.message:"Не удалось сохранить язык перевода"))});at.addEventListener("change",()=>{d.updateSettings({saveHistory:at.checked}).then(l).catch(()=>{i("Не удалось сохранить настройку"),l().catch(()=>{})})});nt.addEventListener("change",()=>{d.updateSettings({showSelectionButton:nt.checked}).then(l).catch(()=>{i("Не удалось сохранить настройку"),l().catch(()=>{})})});P.addEventListener("change",()=>{const t=Number(P.value);document.documentElement.dataset.textScale=P.value,d.updateSettings({textScale:t}).then(l).catch(()=>i("Не удалось сохранить размер текста"))});Lt.addEventListener("input",qt);kt.addEventListener("input",Dt);o('[data-action="copy-result"]').addEventListener("click",()=>{b&&navigator.clipboard.writeText(b.translation).then(()=>i("Перевод скопирован")).catch(()=>i("Не удалось скопировать перевод"))});o('[data-action="save-result"]').addEventListener("click",()=>{!b||b.alreadyTarget||d.addDictionaryEntry(b).then(async t=>{await l(),i(t.added?"Добавлено в словарь":"Уже в словаре")}).catch(()=>i("Не удалось добавить перевод в словарь"))});o('[data-action="export-data"]').addEventListener("click",()=>{try{const t=Ut(r),a=new Blob([JSON.stringify(t,null,2)],{type:"application/json"}),e=URL.createObjectURL(a),n=document.createElement("a");n.href=e,n.download=`poop-translator-backup-${new Date().toISOString().slice(0,10)}.json`,n.click(),window.setTimeout(()=>URL.revokeObjectURL(e),0),i("Резервная копия сохранена")}catch{i("Не удалось создать резервную копию")}});o('[data-action="import-data"]').addEventListener("click",()=>U.click());U.addEventListener("change",()=>{(async()=>{const t=U.files?.[0];if(U.value="",!!t){if(t.size>1e7){i("Файл слишком большой");return}try{const a=JSON.parse(await t.text());if(!await G("Импортировать данные?","История и словарь объединятся с текущими, настройки будут взяты из файла.","Импортировать"))return;const n=await d.importBackup(a);await l(),i(`Добавлено: ${n.dictionaryAdded} слов, ${n.historyAdded} переводов`)}catch(a){i(a instanceof Error?a.message:"Не удалось прочитать резервную копию")}}})()});o('[data-action="translate-page"]').addEventListener("click",()=>{j({type:"TRANSLATE_PAGE",requestId:S(),targetLanguage:R.value==="en"?"en":"ru"}).then(t=>{if(!t.ok||!t.data)throw new Error(t.error??"Страница не ответила.");I(t.data),i("Подтвердите перевод на странице")}).catch(t=>{I({state:"error",completed:0,total:0,error:t.message})})});R.addEventListener("change",()=>{const t=R.value==="en"?"en":"ru";d.updateSettings({pageTargetLanguage:t}).then(()=>{r.settings.pageTargetLanguage=t,i("Язык страницы сохранён")}).catch(a=>{R.value=r.settings.pageTargetLanguage,i(a instanceof Error?a.message:"Не удалось сохранить настройку")})});o('[data-action="translate-region"]').addEventListener("click",()=>{j({type:"START_REGION_SELECTION",requestId:S()}).then(t=>{if(!t.ok)throw new Error(t.error??"Страница не ответила.");window.close()}).catch(t=>i(t instanceof Error?t.message:"Не удалось начать выбор области"))});o('[data-action="open-pdf"]').addEventListener("click",()=>{chrome.tabs.create({url:chrome.runtime.getURL("pdf.html")}).then(()=>window.close()).catch(()=>i("Не удалось открыть перевод PDF"))});o('[data-action="restore-page"]').addEventListener("click",()=>{j({type:"RESTORE_PAGE",requestId:S()}).then(t=>t.data&&I(t.data)).catch(t=>i(t.message))});o('[data-action="prepare-engine"]').addEventListener("click",()=>{const t=O.prepareForMode(r.settings.sourceMode,{onProgress(a){M.textContent=`Загружаю языковой пакет: ${a}%`}},r.settings.targetLanguage);M.textContent="Подготавливаю локальный переводчик…",t.then(async()=>{await k(),i("Переводчик готов")}).catch(a=>{M.textContent=a instanceof Error?a.message:"Не удалось подготовить переводчик."})});o('[data-action="add-word"]').addEventListener("click",()=>At());Xt.addEventListener("submit",t=>{if(t.submitter?.value==="cancel")return;t.preventDefault();const e={original:it.value,translation:St.value,note:Tt.value};(ot.value?d.updateDictionaryEntry(ot.value,e).then(()=>({added:!0})):d.addDictionaryEntry(e)).then(async s=>{Ct.close(),await l(),i("added"in s&&!s.added?"Уже в словаре":"Словарь обновлён")}).catch(s=>i(s instanceof Error?s.message:"Не удалось сохранить запись"))});async function Mt(){await G("Очистить историю?","Все сохранённые переводы будут удалены. Личный словарь останется.","Очистить историю")&&(await d.clearHistory(),await l(),i("История очищена"))}o('[data-action="clear-history"]').addEventListener("click",()=>{Mt()});o('[data-action="clear-history-settings"]').addEventListener("click",()=>{Mt()});o('[data-action="clear-dictionary"]').addEventListener("click",()=>{(async()=>{await G("Очистить словарь?","Все личные слова, переводы и заметки будут удалены. История останется.","Очистить словарь")&&(await d.clearDictionary(),await l(),i("Словарь очищен"))})()});o('[data-action="clear-all"]').addEventListener("click",()=>{(async()=>{await G("Сбросить все данные?","История, словарь и ваши настройки будут удалены с этого устройства.","Сбросить всё")&&(await d.clearUserData(),b=void 0,ct.hidden=!0,E.value="",E.dispatchEvent(new Event("input")),await l(),i("Данные сброшены"))})()});chrome.runtime.onMessage.addListener(t=>{typeof t=="object"&&t!==null&&"type"in t&&t.type==="PAGE_STATUS_CHANGED"&&"status"in t&&I(t.status)});chrome.storage.onChanged.addListener((t,a)=>{a==="local"&&t[Bt]&&l().catch(()=>{})});(async()=>{await l(),await k();try{const t=await j({type:"GET_PAGE_STATUS",requestId:S()});t.data&&I(t.data)}catch{}})();
