import"./modulepreload-polyfill-B5Qt9EMX.js";import{s as Dt,c as _t,S as Mt,g as $t,d as It}from"./storage-client-BkMEiVA9.js";import{c as k}from"./messages-CIt8YtwY.js";import{C as Ot}from"./translator-VgFvE-8-.js";async function Ut(t,a,e){if(e!=="en"&&e!=="ru")return[];try{const n=await chrome.runtime.sendMessage({type:"LOOKUP_DICTIONARY",requestId:k(),text:t,sourceLanguage:e});return!n.ok||!Array.isArray(n.data)?[]:Dt(n.data,a)}catch{return[]}}async function Ht(t){try{return await t()?{status:"saved"}:{status:"skipped"}}catch(a){return{status:"failed",message:a instanceof Error?a.message:"Не удалось сохранить историю"}}}const dt=`
  <svg viewBox="0 0 48 48" aria-hidden="true">
    <path fill="currentColor" d="M9 36c0-5 4-9 10-10-5-1-7-5-5-9 1-4 5-6 9-5-2-3 0-7 4-9 1 5 5 6 8 9 2 3 1 5-1 7 5 1 9 4 9 9 0 4-3 7-5 8 2 1 3 4 3 6H10c-1-2-1-4-1-6Z"/>
    <circle cx="21" cy="27" r="2.2" fill="#221b29"/><circle cx="32" cy="27" r="2.2" fill="#221b29"/>
    <path d="M20 34c4 3 9 3 13 0" stroke="#221b29" stroke-width="2.3" stroke-linecap="round"/>
  </svg>`;function Pt(t){t.innerHTML=`
    <main class="app-shell">
      <header class="brand-header">
        <div class="brand-mark">${dt}</div>
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
                <option value="auto">Авто EN ↔ RU</option>
              </select>
            </label>
            <span class="language-arrow">→</span>
            <div class="target-language"><small>Перевод</small><strong data-target-language>Русский</strong></div>
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
            <label class="setting-row setting-row--stack"><span><strong>Направление перевода</strong><small>Английский ↔ русский или автоматический выбор</small></span>
              <select data-control="settings-source-mode"><option value="en">EN → RU</option><option value="ru">RU → EN</option><option value="auto">Авто EN ↔ RU</option></select>
            </label>
            <label class="setting-row"><span><strong>Сохранять историю</strong><small>Ручные, выделенные и OCR-переводы</small></span><input class="switch" type="checkbox" aria-label="Сохранять историю" data-control="save-history"></label>
            <label class="setting-row"><span><strong>Кнопка у выделения</strong><small>Показывать маленького помощника на страницах</small></span><input class="switch" type="checkbox" aria-label="Показывать кнопку возле выделения" data-control="selection-button"></label>
            <label class="setting-row setting-row--stack"><span><strong>Размер текста</strong><small>Меняет popup и подсказки на страницах</small></span>
              <select data-control="text-scale"><option value="100">Обычный</option><option value="115">Крупный</option><option value="130">Очень крупный</option></select>
            </label>
          </div>

          <div class="engine-card">
            <div class="engine-card__icon">${dt}</div>
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
    <div class="toast" data-toast role="status" aria-live="polite" hidden></div>`}function yt(t,a){t.querySelectorAll("[data-tab]").forEach(e=>{const n=e.dataset.tab===a;e.setAttribute("aria-selected",String(n)),e.tabIndex=n?0:-1}),t.querySelectorAll("[data-view]").forEach(e=>{e.hidden=e.dataset.view!==a})}const R=document.querySelector("#app");Pt(R);function o(t){const a=document.querySelector(t);if(!a)throw new Error(`Missing UI element: ${t}`);return a}const d=$t(),x=new Ot;let l,g,ut=0,K=!1,S=0,pt=0,q,f=!1,N=0;const E=o("#source-text"),Bt=o("[data-char-count]"),ot=o('[data-form="translate"]'),vt=ot.querySelector('button[type="submit"]'),L=o('[data-control="source-mode"]'),Q=o('[data-control="settings-source-mode"]'),D=o('[data-control="page-target-language"]'),Ft=o("[data-target-language]"),X=o('[data-control="save-history"]'),tt=o('[data-control="selection-button"]'),U=o('[data-control="text-scale"]'),H=o("[data-import-file]"),it=o("[data-result]"),jt=o("[data-result-original]"),Gt=o("[data-result-translation]"),Vt=o("[data-result-language]"),bt=o("[data-result-variants]"),gt=o("[data-result-variants-list]"),T=o("[data-translate-error]"),mt=o("[data-engine-status]"),_=o("[data-engine-detail]"),J=o("[data-history-list]"),W=o("[data-dictionary-list]"),p=o("[data-review-list]"),ht=o("[data-review-due]"),O=o("#panel-review h2"),wt=o('[data-search="history"]'),ft=o('[data-search="dictionary"]'),A=o("[data-page-status]"),Et=o("[data-word-modal]"),Kt=o('[data-form="word"]'),et=o("[data-word-id]"),at=o("[data-word-original]"),xt=o("[data-word-translation]"),Lt=o("[data-word-note]"),Jt=o("[data-word-modal-title]"),z=o("[data-confirm-modal]"),Wt=o("[data-confirm-title]"),zt=o("[data-confirm-text]"),Y=o("[data-toast]");function i(t){window.clearTimeout(ut),Y.textContent=t,Y.hidden=!1,ut=window.setTimeout(()=>{Y.hidden=!0},1900)}function Z(t,a="Перевести"){vt.disabled=t,vt.querySelector("span").textContent=t?"Перевожу…":a}function Yt(){L.value=l.settings.sourceMode,Q.value=l.settings.sourceMode,D.value=l.settings.pageTargetLanguage,X.checked=l.settings.saveHistory,tt.checked=l.settings.showSelectionButton,U.value=String(l.settings.textScale),document.documentElement.dataset.textScale=String(l.settings.textScale),Ft.textContent=l.settings.sourceMode==="ru"?"Английский":l.settings.sourceMode==="auto"?"EN ↔ RU":"Русский"}function Zt(t){return{manual:"вручную",selection:"выделение","context-menu":"контекстное меню","ocr-region":"область экрана"}[t.source]}function P(t){return new Intl.DateTimeFormat("ru-RU",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"}).format(t)}function B(t,a,e){const n=document.createElement("div");return n.className="empty-state",n.innerHTML='<div class="empty-state__face"></div><strong></strong><p></p>',n.querySelector(".empty-state__face").textContent=t,n.querySelector("strong").textContent=a,n.querySelector("p").textContent=e,n}function M(t,a){const e=document.createElement("button");return e.type="button",e.className="mini-action",e.textContent=t,e.addEventListener("click",()=>{a()}),e}function kt(){const t=wt.value.trim().toLocaleLowerCase(),a=l.history.filter(e=>!t||e.original.toLocaleLowerCase().includes(t)||e.translation.toLocaleLowerCase().includes(t));if(J.replaceChildren(),!a.length){J.append(B("◷",t?"Ничего не нашлось":"Пока пусто",t?"Попробуйте другой запрос.":"Ваши ручные переводы и переводы выделений появятся здесь."));return}for(const e of a){const n=document.createElement("article");n.className="item-card",n.innerHTML=`
      <div class="item-main"><p></p><span class="item-arrow">→</span><p></p></div>
      <div class="item-meta"><span></span><div class="item-buttons"></div></div>`;const s=n.querySelectorAll("p");s[0].textContent=e.original,s[1].textContent=e.translation,n.querySelector(".item-meta > span").textContent=`${Zt(e)} · ${P(e.createdAt)}`,n.querySelector(".item-buttons").append(M("♡ В словарь",async()=>{const v=await d.addDictionaryEntry(e);await c(),i(v.added?"Добавлено в словарь":"Уже в словаре")}),M("Удалить",async()=>{await d.removeHistoryEntry(e.id),await c()})),J.append(n)}}function Ct(t){et.value=t?.id??"",at.value=t?.original??"",xt.value=t?.translation??"",Lt.value=t?.note??"",Jt.textContent=t?"Изменить запись":"Новое слово",Et.showModal(),window.setTimeout(()=>at.focus(),0)}function St(){const t=ft.value.trim().toLocaleLowerCase(),a=l.dictionary.filter(e=>!t||e.original.toLocaleLowerCase().includes(t)||e.translation.toLocaleLowerCase().includes(t)||e.note.toLocaleLowerCase().includes(t));if(W.replaceChildren(),!a.length){W.append(B("♡",t?"Ничего не нашлось":"Ваш словарь ждёт",t?"Проверьте написание или заметку.":"Добавляйте сюда полезные слова и фразы одним нажатием."));return}for(const e of a){const n=document.createElement("article");n.className="item-card",n.innerHTML=`
      <div class="item-main"><p></p><span class="item-arrow">→</span><p></p></div>
      <div class="item-meta"><span></span><div class="item-buttons"></div></div>`;const s=n.querySelectorAll("p");s[0].textContent=e.original,s[1].textContent=e.translation,n.querySelector(".item-meta > span").textContent=e.note||P(e.updatedAt),n.querySelector(".item-buttons").append(M("Изменить",()=>Ct(e)),M("Удалить",async()=>{await d.removeDictionaryEntry(e.id),await c()})),W.append(n)}}function nt(){const t=It(l,Date.now()),a=`${t.length} сейчас`,e=t[0],n=p.querySelector("[data-review-card]");if(e&&n?.dataset.reviewCard===e.id&&ht.textContent===a&&n.querySelector(".review-question")?.textContent===e.original&&n.querySelector(".review-answer p")?.textContent===e.translation&&n.querySelector(".review-answer")?.hidden===(q!==e.id))return;if(ht.textContent=a,p.replaceChildren(),!e){if(q=void 0,l.dictionary.length){const u=Math.min(...l.review.map(V=>V.dueAt));p.append(B("✿","Все карточки пройдены",Number.isFinite(u)?`Следующее повторение: ${P(u)}.`:"Загляните позже."))}else{p.append(B("♡","Слов пока нет","Добавьте первую пару в словарь, чтобы начать повторение."));const u=M("Открыть словарь",()=>{yt(R,"dictionary"),o('[data-action="add-word"]').focus()});u.className="button button--accent review-empty-action",p.append(u)}return}const s=document.createElement("article");s.className="review-card",s.dataset.reviewCard=e.id;const r=document.createElement("span");r.className="section-kicker",r.textContent="Как это переводится?";const v=document.createElement("p");v.className="review-question",v.textContent=e.original;const b=document.createElement("button");b.type="button",b.className="button button--accent review-reveal",b.dataset.reviewReveal="",b.textContent="Показать перевод";const m=document.createElement("div");m.className="review-answer",m.hidden=q!==e.id;const G=document.createElement("span");G.className="section-kicker",G.textContent="Ответ";const st=document.createElement("p");st.textContent=e.translation,m.append(G,st);const h=document.createElement("div");h.className="review-actions",h.hidden=m.hidden;const At=[["again","Повторить","через 10 минут"],["hard","Сложно","завтра"],["good","Знаю","дольше"]];for(const[u,V,Rt]of At){const y=document.createElement("button");y.type="button",y.className="review-rating",y.dataset.reviewRating=u;const rt=document.createElement("strong");rt.textContent=V;const lt=document.createElement("small");lt.textContent=Rt,y.append(rt,lt),y.disabled=f,y.addEventListener("click",()=>{f||(f=!0,N+=1,h.querySelectorAll("button").forEach(C=>{C.disabled=!0}),(async()=>{let C;try{C=await d.rateReview(e.id,u)}catch(w){f=!1,N+=1,nt(),p.querySelectorAll("[data-review-rating]").forEach(Nt=>{Nt.disabled=!1});const ct=p.querySelector(`[data-review-rating="${u}"]`);ct?ct.focus():(O.tabIndex=-1,O.focus()),i(w instanceof Error?w.message:"Не удалось сохранить повторение"),c().catch(()=>{});return}q=void 0,f=!1,N+=1,l.review=[...l.review.filter(w=>w.dictionaryId!==e.id),C];try{nt(),i(`Повторим: ${P(C.dueAt)}`);const w=p.querySelector("[data-review-reveal]");w?w.focus():(O.tabIndex=-1,O.focus()),c().catch(()=>{})}catch{i("Повторение сохранено. Откройте карточки снова.")}})())}),h.append(y)}b.hidden=!m.hidden,b.addEventListener("click",()=>{q=e.id,b.hidden=!0,m.hidden=!1,h.hidden=!1,h.querySelector("button")?.focus()}),s.append(r,v,b,m,h),p.append(s)}async function c(){const t=++N,a=await d.loadState();t!==N||f||(l=a,Yt(),kt(),St(),f||nt())}async function qt(t){await d.updateSettings({sourceMode:t}),await c()}function Qt(t){return{n:"сущ.",v:"гл.",adj:"прил.",adv:"нареч.",pn:"имя",pronoun:"мест.",preposition:"предл.",conjunction:"союз",interjection:"межд.",proverb:"посл.",phraseologicalUnit:"фраза"}[t??""]??""}function Xt(t,a){const e=document.createElement("button");e.className="result-variant",e.type="button",e.setAttribute("aria-label",`Добавить «${a.translation}» в словарь`);const n=document.createElement("span");n.className="result-variant__meaning",n.textContent=a.translation;const s=document.createElement("span");return s.className="result-variant__meta",s.textContent=`${Qt(a.partOfSpeech)} ＋`.trim(),e.append(n,s),e.addEventListener("click",()=>{e.disabled=!0,d.addDictionaryEntry({original:t.original,translation:a.translation}).then(async({added:r})=>{await c(),s.textContent=r?"добавлено ✓":"уже есть ✓",i(r?"Вариант добавлен в словарь":"Уже в словаре")}).catch(()=>{e.disabled=!1,i("Не удалось добавить вариант")})}),e}async function te(t){if(bt.hidden=!0,gt.replaceChildren(),t.alreadyRussian)return;const a=await Ut(t.original,t.translation,t.sourceLanguage);g!==t||!a.length||(gt.append(...a.map(e=>Xt(t,e))),bt.hidden=!1)}function ee(t){g=t,jt.textContent=t.original,Gt.textContent=t.alreadyRussian?"Текст уже на русском":t.translation,Vt.textContent=`${t.sourceLanguage.toUpperCase()} → ${t.targetLanguage.toUpperCase()}`,it.hidden=!1,o('[data-action="save-result"]').disabled=t.alreadyRussian,te(t)}async function I(){const t=L.value,a=++pt,e=t==="auto"?await Promise.all([x.getAvailability("en"),x.getAvailability("ru")]):[await x.getAvailability(t)],n=e.includes("unavailable")?"unavailable":e.includes("downloadable")?"downloadable":e.includes("downloading")?"downloading":"available";if(a!==pt||L.value!==t)return;mt.dataset.state=n;const s={available:"Готов",downloadable:"Нужна загрузка",downloading:"Загрузка",unavailable:"Недоступен"}[n],r={available:t==="auto"?"Обе языковые пары готовы на устройстве.":"Языковой пакет готов. Перевод выполняется на устройстве.",downloadable:"Нажмите «Подготовить», чтобы бесплатно скачать языковой пакет.",downloading:"Chrome загружает языковой пакет.",unavailable:"Нужен настольный Google Chrome 138 или новее."}[n];mt.querySelector("span:last-child").textContent=s,_.textContent=r}async function F(t){const[a]=await chrome.tabs.query({active:!0,currentWindow:!0});if(!a?.id||!a.url?.match(/^https?:\/\//))throw new Error("На этой странице перевод недоступен. Откройте обычный сайт http/https.");try{return await chrome.tabs.sendMessage(a.id,t)}catch{throw new Error("Обновите страницу после установки расширения и повторите.")}}function $(t){switch(t.state){case"awaiting-activation":A.textContent="Подтвердите запуск внизу открытой страницы.";break;case"translating":A.textContent=t.total?`Переведено ${t.completed} из ${t.total} фрагментов…`:"Подготавливаю локальный переводчик…";break;case"translated":A.textContent=t.error??`Готово: ${t.completed} фрагментов.`;break;case"error":A.textContent=t.error??"Не удалось перевести страницу.";break;default:A.textContent="Переведу основной текст, сохранив кнопки и ссылки."}}function j(t,a,e){return Wt.textContent=t,zt.textContent=a,o("[data-confirm-button]").textContent=e,z.showModal(),new Promise(n=>{z.addEventListener("close",()=>n(z.returnValue==="confirm"),{once:!0})})}R.querySelectorAll('[role="tab"]').forEach(t=>{t.addEventListener("click",()=>{yt(R,t.dataset.tab),window.scrollTo({top:0,behavior:"instant"})}),t.addEventListener("keydown",a=>{const e=Array.from(R.querySelectorAll('[role="tab"]')),n=e.indexOf(t),s=a.key==="ArrowRight"?(n+1)%e.length:a.key==="ArrowLeft"?(n-1+e.length)%e.length:a.key==="Home"?0:a.key==="End"?e.length-1:-1;s<0||(a.preventDefault(),e[s]?.click(),e[s]?.focus())})});E.addEventListener("input",()=>{Bt.textContent=`${E.value.length.toLocaleString("ru-RU")} / 10 000`});E.addEventListener("keydown",t=>{t.key==="Enter"&&(t.ctrlKey||t.metaKey)&&(t.preventDefault(),ot.requestSubmit())});ot.addEventListener("submit",t=>{if(t.preventDefault(),K)return;const a=E.value.trim();if(!a){T.textContent="Напишите текст, который нужно перевести.",T.hidden=!1,E.focus();return}const e=L.value,n=++S;K=!0;const s=x.prepareForMode(e,{onProgress(r){n===S&&(Z(!0,`Загрузка ${r}%`),_.textContent=`Загружаю языковой пакет: ${r}%`)}});(async()=>{T.hidden=!0,it.hidden=!0,Z(!0);try{await s;const r=await x.translate(a,e);if(n!==S)return;if(ee(r),!r.alreadyRussian){const v=await Ht(()=>d.addHistory({requestId:k(),original:r.original,translation:r.translation,sourceLanguage:r.sourceLanguage,targetLanguage:r.targetLanguage,source:"manual"}));v.status==="failed"?i("Перевод готов, историю сохранить не удалось"):v.status==="saved"&&await c().catch(()=>i("Перевод готов, историю обновить не удалось"))}await I()}catch(r){if(n!==S)return;T.textContent=r instanceof Error?r.message:"Не удалось выполнить перевод.",T.hidden=!1}finally{n===S&&(K=!1,Z(!1))}})()});L.addEventListener("change",()=>{qt(L.value).then(I).catch(()=>i("Не удалось сохранить направление"))});Q.addEventListener("change",()=>{qt(Q.value).then(I).catch(()=>i("Не удалось сохранить направление"))});X.addEventListener("change",()=>{d.updateSettings({saveHistory:X.checked}).then(c).catch(()=>{i("Не удалось сохранить настройку"),c().catch(()=>{})})});tt.addEventListener("change",()=>{d.updateSettings({showSelectionButton:tt.checked}).then(c).catch(()=>{i("Не удалось сохранить настройку"),c().catch(()=>{})})});U.addEventListener("change",()=>{const t=Number(U.value);document.documentElement.dataset.textScale=U.value,d.updateSettings({textScale:t}).then(c).catch(()=>i("Не удалось сохранить размер текста"))});wt.addEventListener("input",kt);ft.addEventListener("input",St);o('[data-action="copy-result"]').addEventListener("click",()=>{g&&navigator.clipboard.writeText(g.translation).then(()=>i("Перевод скопирован")).catch(()=>i("Не удалось скопировать перевод"))});o('[data-action="save-result"]').addEventListener("click",()=>{!g||g.alreadyRussian||d.addDictionaryEntry(g).then(async t=>{await c(),i(t.added?"Добавлено в словарь":"Уже в словаре")}).catch(()=>i("Не удалось добавить перевод в словарь"))});o('[data-action="export-data"]').addEventListener("click",()=>{try{const t=_t(l),a=new Blob([JSON.stringify(t,null,2)],{type:"application/json"}),e=URL.createObjectURL(a),n=document.createElement("a");n.href=e,n.download=`poop-translator-backup-${new Date().toISOString().slice(0,10)}.json`,n.click(),window.setTimeout(()=>URL.revokeObjectURL(e),0),i("Резервная копия сохранена")}catch{i("Не удалось создать резервную копию")}});o('[data-action="import-data"]').addEventListener("click",()=>H.click());H.addEventListener("change",()=>{(async()=>{const t=H.files?.[0];if(H.value="",!!t){if(t.size>1e7){i("Файл слишком большой");return}try{const a=JSON.parse(await t.text());if(!await j("Импортировать данные?","История и словарь объединятся с текущими, настройки будут взяты из файла.","Импортировать"))return;const n=await d.importBackup(a);await c(),i(`Добавлено: ${n.dictionaryAdded} слов, ${n.historyAdded} переводов`)}catch(a){i(a instanceof Error?a.message:"Не удалось прочитать резервную копию")}}})()});o('[data-action="translate-page"]').addEventListener("click",()=>{F({type:"TRANSLATE_PAGE",requestId:k(),targetLanguage:D.value==="en"?"en":"ru"}).then(t=>{if(!t.ok||!t.data)throw new Error(t.error??"Страница не ответила.");$(t.data),i("Подтвердите перевод на странице")}).catch(t=>{$({state:"error",completed:0,total:0,error:t.message})})});D.addEventListener("change",()=>{const t=D.value==="en"?"en":"ru";d.updateSettings({pageTargetLanguage:t}).then(()=>{l.settings.pageTargetLanguage=t,i("Язык страницы сохранён")}).catch(a=>{D.value=l.settings.pageTargetLanguage,i(a instanceof Error?a.message:"Не удалось сохранить настройку")})});o('[data-action="translate-region"]').addEventListener("click",()=>{F({type:"START_REGION_SELECTION",requestId:k()}).then(t=>{if(!t.ok)throw new Error(t.error??"Страница не ответила.");window.close()}).catch(t=>i(t instanceof Error?t.message:"Не удалось начать выбор области"))});o('[data-action="open-pdf"]').addEventListener("click",()=>{chrome.tabs.create({url:chrome.runtime.getURL("pdf.html")}).then(()=>window.close()).catch(()=>i("Не удалось открыть перевод PDF"))});o('[data-action="restore-page"]').addEventListener("click",()=>{F({type:"RESTORE_PAGE",requestId:k()}).then(t=>t.data&&$(t.data)).catch(t=>i(t.message))});o('[data-action="prepare-engine"]').addEventListener("click",()=>{const t=x.prepareForMode(l.settings.sourceMode,{onProgress(a){_.textContent=`Загружаю языковой пакет: ${a}%`}});_.textContent="Подготавливаю локальный переводчик…",t.then(async()=>{await I(),i("Переводчик готов")}).catch(a=>{_.textContent=a instanceof Error?a.message:"Не удалось подготовить переводчик."})});o('[data-action="add-word"]').addEventListener("click",()=>Ct());Kt.addEventListener("submit",t=>{if(t.submitter?.value==="cancel")return;t.preventDefault();const e={original:at.value,translation:xt.value,note:Lt.value};(et.value?d.updateDictionaryEntry(et.value,e).then(()=>({added:!0})):d.addDictionaryEntry(e)).then(async s=>{Et.close(),await c(),i("added"in s&&!s.added?"Уже в словаре":"Словарь обновлён")}).catch(s=>i(s instanceof Error?s.message:"Не удалось сохранить запись"))});async function Tt(){await j("Очистить историю?","Все сохранённые переводы будут удалены. Личный словарь останется.","Очистить историю")&&(await d.clearHistory(),await c(),i("История очищена"))}o('[data-action="clear-history"]').addEventListener("click",()=>{Tt()});o('[data-action="clear-history-settings"]').addEventListener("click",()=>{Tt()});o('[data-action="clear-dictionary"]').addEventListener("click",()=>{(async()=>{await j("Очистить словарь?","Все личные слова, переводы и заметки будут удалены. История останется.","Очистить словарь")&&(await d.clearDictionary(),await c(),i("Словарь очищен"))})()});o('[data-action="clear-all"]').addEventListener("click",()=>{(async()=>{await j("Сбросить все данные?","История, словарь и ваши настройки будут удалены с этого устройства.","Сбросить всё")&&(await d.clearUserData(),g=void 0,it.hidden=!0,E.value="",E.dispatchEvent(new Event("input")),await c(),i("Данные сброшены"))})()});chrome.runtime.onMessage.addListener(t=>{typeof t=="object"&&t!==null&&"type"in t&&t.type==="PAGE_STATUS_CHANGED"&&"status"in t&&$(t.status)});chrome.storage.onChanged.addListener((t,a)=>{a==="local"&&t[Mt]&&c().catch(()=>{})});(async()=>{await c(),await I();try{const t=await F({type:"GET_PAGE_STATUS",requestId:k()});t.data&&$(t.data)}catch{}})();
