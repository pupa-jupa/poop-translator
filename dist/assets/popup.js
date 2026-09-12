import{c as C,S as ot,g as rt}from"./storage-client-DzTXVBbx.js";(function(){const a=document.createElement("link").relList;if(a&&a.supports&&a.supports("modulepreload"))return;for(const o of document.querySelectorAll('link[rel="modulepreload"]'))n(o);new MutationObserver(o=>{for(const i of o)if(i.type==="childList")for(const d of i.addedNodes)d.tagName==="LINK"&&d.rel==="modulepreload"&&n(d)}).observe(document,{childList:!0,subtree:!0});function e(o){const i={};return o.integrity&&(i.integrity=o.integrity),o.referrerPolicy&&(i.referrerPolicy=o.referrerPolicy),o.crossOrigin==="use-credentials"?i.credentials="include":o.crossOrigin==="anonymous"?i.credentials="omit":i.credentials="same-origin",i}function n(o){if(o.ep)return;o.ep=!0;const i=e(o);fetch(o.href,i)}})();class u extends Error{constructor(a,e){super(e),this.code=a,this.name="TranslationEngineError"}code}function it(t){return t==="available"||t==="readily"?"available":t==="downloadable"||t==="after-download"?"downloadable":t==="downloading"?"downloading":"unavailable"}function T(t){if(t instanceof u)return t;const a=t instanceof DOMException?t.name:"";return a==="NotAllowedError"?new u("ACTIVATION_REQUIRED","Chrome ждёт ваш клик, чтобы подготовить переводчик. Нажмите «Повторить»."):a==="NetworkError"?new u("DOWNLOAD_FAILED","Не удалось загрузить языковой пакет. Проверьте интернет и повторите."):a==="NotSupportedError"?new u("PAIR_UNAVAILABLE","Перевод с английского на русский недоступен в этом Chrome."):new u("TRANSLATION_FAILED","Не удалось выполнить перевод. Попробуйте ещё раз.")}class st{constructor(a=globalThis,e=18e4){this.creationTimeoutMs=e,this.environment=a}creationTimeoutMs;environment;translators=new Map;detector;async getAvailability(a){const e=this.environment.Translator;if(!e)return"unavailable";try{return it(await e.availability({sourceLanguage:a,targetLanguage:"ru"}))}catch{return"unavailable"}}withCreationTimeout(a){let e;const n=new Promise((o,i)=>{e=setTimeout(()=>i(new u("DOWNLOAD_FAILED","Подготовка переводчика заняла слишком много времени. Нажмите «Повторить».")),this.creationTimeoutMs)});return Promise.race([a,n]).finally(()=>{e!==void 0&&clearTimeout(e)})}createTranslator(a,e){const n=this.environment.Translator;if(!n)return Promise.reject(new u("API_UNAVAILABLE","Встроенный переводчик недоступен. Нужен Google Chrome 138 или новее."));const o=this.translators.get(a);if(o)return o;const i=n.create({sourceLanguage:a,targetLanguage:"ru",monitor(b){b.addEventListener("downloadprogress",nt=>{e.onProgress?.(Math.round(Math.max(0,Math.min(1,nt.loaded))*100))})}}),d=this.withCreationTimeout(i).catch(b=>{throw this.translators.delete(a),T(b)});return this.translators.set(a,d),d}createDetector(a){const e=this.environment.LanguageDetector;if(!e)return;if(this.detector)return this.detector;const n=e.create({expectedInputLanguages:["en","ru"],monitor(o){o.addEventListener("downloadprogress",i=>{a.onProgress?.(Math.round(Math.max(0,Math.min(1,i.loaded))*100))})}});return this.detector=this.withCreationTimeout(n).catch(o=>{throw this.detector=void 0,o}),this.detector}async prepare(a="en",e={}){await this.createTranslator(a,e)}async prepareForMode(a,e={}){const n=[this.createTranslator("en",e)];if(a==="auto"){const o=this.createDetector(e);o&&n.push(o)}try{await Promise.all(n)}catch(o){throw T(o)}}async detectSource(a,e){if(a.length<8)return"en";const n=this.createDetector(e);if(!n)return"en";try{const o=await n,[i]=await o.detect(a);return!i||i.confidence<.65||i.detectedLanguage==="und"?"en":i.detectedLanguage}catch{return"en"}}async translate(a,e,n={}){const o=a.trim();if(!o)throw new u("TRANSLATION_FAILED","Введите текст для перевода.");if(!this.environment.Translator)throw new u("API_UNAVAILABLE","Встроенный переводчик недоступен. Нужен Google Chrome 138 или новее.");try{const i=e==="auto"?await this.detectSource(o,n):"en";if(i==="ru")return{original:o,translation:o,sourceLanguage:i,targetLanguage:"ru",alreadyRussian:!0};const b=(await(await this.createTranslator(i,n)).translate(o)).trim();if(!b)throw new Error("Empty translation");return{original:o,translation:b,sourceLanguage:i,targetLanguage:"ru",alreadyRussian:!1}}catch(i){throw T(i)}}destroy(){for(const a of this.translators.values())a.then(e=>e.destroy?.()).catch(()=>{});this.translators.clear(),this.detector?.then(a=>a.destroy?.()).catch(()=>{}),this.detector=void 0}}const U=`
  <svg viewBox="0 0 48 48" aria-hidden="true">
    <path fill="currentColor" d="M9 36c0-5 4-9 10-10-5-1-7-5-5-9 1-4 5-6 9-5-2-3 0-7 4-9 1 5 5 6 8 9 2 3 1 5-1 7 5 1 9 4 9 9 0 4-3 7-5 8 2 1 3 4 3 6H10c-1-2-1-4-1-6Z"/>
    <circle cx="21" cy="27" r="2.2" fill="#221b29"/><circle cx="32" cy="27" r="2.2" fill="#221b29"/>
    <path d="M20 34c4 3 9 3 13 0" stroke="#221b29" stroke-width="2.3" stroke-linecap="round"/>
  </svg>`;function lt(t){t.innerHTML=`
    <main class="app-shell">
      <header class="brand-header">
        <div class="brand-mark">${U}</div>
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
        <button id="tab-settings" role="tab" data-tab="settings" aria-controls="panel-settings" aria-selected="false" tabindex="-1">Настройки</button>
      </nav>

      <div class="views">
        <section id="panel-translate" class="view" data-view="translate" role="tabpanel" aria-labelledby="tab-translate">
          <div class="language-row">
            <label>Исходный язык
              <select data-control="source-mode">
                <option value="en">Английский</option>
                <option value="auto">Авто</option>
              </select>
            </label>
            <span class="language-arrow">→</span>
            <div class="target-language"><small>Перевод</small><strong>Русский</strong></div>
          </div>

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
            <div class="result-actions">
              <button class="button button--soft" type="button" data-action="copy-result">Копировать</button>
              <button class="button button--accent" type="button" data-action="save-result">♡ В словарь</button>
            </div>
          </article>

          <div class="inline-error" data-translate-error role="alert" hidden></div>

          <section class="page-tools">
            <div><span class="section-kicker">Вся страница</span><p data-page-status aria-live="polite">Переведу основной текст, сохранив кнопки и ссылки.</p></div>
            <div class="page-actions">
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

        <section id="panel-settings" class="view" data-view="settings" role="tabpanel" aria-labelledby="tab-settings" hidden>
          <div class="section-head"><div><span class="section-kicker">Под себя</span><h2>Настройки</h2></div></div>
          <div class="settings-group">
            <label class="setting-row setting-row--stack"><span><strong>Исходный язык</strong><small>Основное направление — английский → русский</small></span>
              <select data-control="settings-source-mode"><option value="en">Английский</option><option value="auto">Автоопределение</option></select>
            </label>
            <label class="setting-row"><span><strong>Сохранять историю</strong><small>Только ручные и выделенные переводы</small></span><input class="switch" type="checkbox" aria-label="Сохранять историю" data-control="save-history"></label>
            <label class="setting-row"><span><strong>Кнопка у выделения</strong><small>Показывать маленького помощника на страницах</small></span><input class="switch" type="checkbox" aria-label="Показывать кнопку возле выделения" data-control="selection-button"></label>
          </div>

          <div class="engine-card">
            <div class="engine-card__icon">${U}</div>
            <div><strong>Локальный движок Chrome</strong><p data-engine-detail>Проверяю доступность…</p></div>
            <button class="button button--soft button--small" type="button" data-action="prepare-engine">Подготовить</button>
          </div>

          <div class="danger-zone">
            <span class="section-kicker">Данные на устройстве</span>
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
    <div class="toast" data-toast role="status" aria-live="polite" hidden></div>`}function ct(t,a){t.querySelectorAll("[data-tab]").forEach(e=>{const n=e.dataset.tab===a;e.setAttribute("aria-selected",String(n)),e.tabIndex=n?0:-1}),t.querySelectorAll("[data-view]").forEach(e=>{e.hidden=e.dataset.view!==a})}const E=document.querySelector("#app");lt(E);function r(t){const a=document.querySelector(t);if(!a)throw new Error(`Missing UI element: ${t}`);return a}const s=rt(),L=new st;let p,h,B=0;const m=r("#source-text"),dt=r("[data-char-count]"),_=r('[data-form="translate"]'),G=_.querySelector('button[type="submit"]'),f=r('[data-control="source-mode"]'),q=r('[data-control="settings-source-mode"]'),I=r('[data-control="save-history"]'),P=r('[data-control="selection-button"]'),O=r("[data-result]"),ut=r("[data-result-original]"),pt=r("[data-result-translation]"),ht=r("[data-result-language]"),v=r("[data-translate-error]"),V=r("[data-engine-status]"),y=r("[data-engine-detail]"),S=r("[data-history-list]"),A=r("[data-dictionary-list]"),W=r('[data-search="history"]'),K=r('[data-search="dictionary"]'),g=r("[data-page-status]"),j=r("[data-word-modal]"),mt=r('[data-form="word"]'),N=r("[data-word-id]"),R=r("[data-word-original]"),z=r("[data-word-translation]"),Q=r("[data-word-note]"),bt=r("[data-word-modal-title]"),k=r("[data-confirm-modal]"),vt=r("[data-confirm-title]"),gt=r("[data-confirm-text]"),M=r("[data-toast]");function c(t){window.clearTimeout(B),M.textContent=t,M.hidden=!1,B=window.setTimeout(()=>{M.hidden=!0},1900)}function D(t,a="Перевести"){G.disabled=t,G.querySelector("span").textContent=t?"Перевожу…":a}function yt(){f.value=p.settings.sourceMode,q.value=p.settings.sourceMode,I.checked=p.settings.saveHistory,P.checked=p.settings.showSelectionButton}function ft(t){return{manual:"вручную",selection:"выделение","context-menu":"контекстное меню"}[t.source]}function Y(t){return new Intl.DateTimeFormat("ru-RU",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"}).format(t)}function Z(t,a,e){const n=document.createElement("div");return n.className="empty-state",n.innerHTML='<div class="empty-state__face"></div><strong></strong><p></p>',n.querySelector(".empty-state__face").textContent=t,n.querySelector("strong").textContent=a,n.querySelector("p").textContent=e,n}function x(t,a){const e=document.createElement("button");return e.type="button",e.className="mini-action",e.textContent=t,e.addEventListener("click",()=>{a()}),e}function J(){const t=W.value.trim().toLocaleLowerCase(),a=p.history.filter(e=>!t||e.original.toLocaleLowerCase().includes(t)||e.translation.toLocaleLowerCase().includes(t));if(S.replaceChildren(),!a.length){S.append(Z("◷",t?"Ничего не нашлось":"Пока пусто",t?"Попробуйте другой запрос.":"Ваши ручные переводы и переводы выделений появятся здесь."));return}for(const e of a){const n=document.createElement("article");n.className="item-card",n.innerHTML=`
      <div class="item-main"><p></p><span class="item-arrow">→</span><p></p></div>
      <div class="item-meta"><span></span><div class="item-buttons"></div></div>`;const o=n.querySelectorAll("p");o[0].textContent=e.original,o[1].textContent=e.translation,n.querySelector(".item-meta > span").textContent=`${ft(e)} · ${Y(e.createdAt)}`,n.querySelector(".item-buttons").append(x("♡ В словарь",async()=>{const d=await s.addDictionaryEntry(e);await l(),c(d.added?"Добавлено в словарь":"Уже в словаре")}),x("Удалить",async()=>{await s.removeHistoryEntry(e.id),await l()})),S.append(n)}}function X(t){N.value=t?.id??"",R.value=t?.original??"",z.value=t?.translation??"",Q.value=t?.note??"",bt.textContent=t?"Изменить запись":"Новое слово",j.showModal(),window.setTimeout(()=>R.focus(),0)}function tt(){const t=K.value.trim().toLocaleLowerCase(),a=p.dictionary.filter(e=>!t||e.original.toLocaleLowerCase().includes(t)||e.translation.toLocaleLowerCase().includes(t)||e.note.toLocaleLowerCase().includes(t));if(A.replaceChildren(),!a.length){A.append(Z("♡",t?"Ничего не нашлось":"Ваш словарь ждёт",t?"Проверьте написание или заметку.":"Добавляйте сюда полезные слова и фразы одним нажатием."));return}for(const e of a){const n=document.createElement("article");n.className="item-card",n.innerHTML=`
      <div class="item-main"><p></p><span class="item-arrow">→</span><p></p></div>
      <div class="item-meta"><span></span><div class="item-buttons"></div></div>`;const o=n.querySelectorAll("p");o[0].textContent=e.original,o[1].textContent=e.translation,n.querySelector(".item-meta > span").textContent=e.note||Y(e.updatedAt),n.querySelector(".item-buttons").append(x("Изменить",()=>X(e)),x("Удалить",async()=>{await s.removeDictionaryEntry(e.id),await l()})),A.append(n)}}async function l(){p=await s.loadState(),yt(),J(),tt()}async function et(t){await s.updateSettings({sourceMode:t}),await l()}function wt(t){h=t,ut.textContent=t.original,pt.textContent=t.alreadyRussian?"Текст уже на русском":t.translation,ht.textContent=`${t.sourceLanguage.toUpperCase()} → RU`,O.hidden=!1,r('[data-action="save-result"]').disabled=t.alreadyRussian}async function H(){const t=await L.getAvailability("en");V.dataset.state=t;const a={available:"Готов",downloadable:"Нужна загрузка",downloading:"Загрузка",unavailable:"Недоступен"}[t],e={available:"Языковой пакет готов. Перевод выполняется на устройстве.",downloadable:"Нажмите «Подготовить», чтобы бесплатно скачать языковой пакет.",downloading:"Chrome загружает языковой пакет.",unavailable:"Нужен настольный Google Chrome 138 или новее."}[t];V.querySelector("span:last-child").textContent=a,y.textContent=e}async function $(t){const[a]=await chrome.tabs.query({active:!0,currentWindow:!0});if(!a?.id||!a.url?.match(/^https?:\/\//))throw new Error("На этой странице перевод недоступен. Откройте обычный сайт http/https.");try{return await chrome.tabs.sendMessage(a.id,t)}catch{throw new Error("Обновите страницу после установки расширения и повторите.")}}function w(t){switch(t.state){case"awaiting-activation":g.textContent="Подтвердите запуск внизу открытой страницы.";break;case"translating":g.textContent=t.total?`Переведено ${t.completed} из ${t.total} фрагментов…`:"Подготавливаю локальный переводчик…";break;case"translated":g.textContent=t.error??`Готово: ${t.completed} фрагментов.`;break;case"error":g.textContent=t.error??"Не удалось перевести страницу.";break;default:g.textContent="Переведу основной текст, сохранив кнопки и ссылки."}}function F(t,a,e){return vt.textContent=t,gt.textContent=a,r("[data-confirm-button]").textContent=e,k.showModal(),new Promise(n=>{k.addEventListener("close",()=>n(k.returnValue==="confirm"),{once:!0})})}E.querySelectorAll('[role="tab"]').forEach(t=>{t.addEventListener("click",()=>{ct(E,t.dataset.tab),window.scrollTo({top:0,behavior:"instant"})}),t.addEventListener("keydown",a=>{const e=Array.from(E.querySelectorAll('[role="tab"]')),n=e.indexOf(t),o=a.key==="ArrowRight"?(n+1)%e.length:a.key==="ArrowLeft"?(n-1+e.length)%e.length:a.key==="Home"?0:a.key==="End"?e.length-1:-1;o<0||(a.preventDefault(),e[o]?.click(),e[o]?.focus())})});m.addEventListener("input",()=>{dt.textContent=`${m.value.length.toLocaleString("ru-RU")} / 10 000`});m.addEventListener("keydown",t=>{t.key==="Enter"&&(t.ctrlKey||t.metaKey)&&(t.preventDefault(),_.requestSubmit())});_.addEventListener("submit",t=>{t.preventDefault();const a=m.value.trim();if(!a){v.textContent="Напишите текст, который нужно перевести.",v.hidden=!1,m.focus();return}const e=L.prepareForMode(f.value,{onProgress(n){D(!0,`Загрузка ${n}%`),y.textContent=`Загружаю языковой пакет: ${n}%`}});(async()=>{v.hidden=!0,O.hidden=!0,D(!0);try{await e;const n=await L.translate(a,f.value);wt(n),n.alreadyRussian||(await s.addHistory({requestId:C(),original:n.original,translation:n.translation,sourceLanguage:n.sourceLanguage,targetLanguage:"ru",source:"manual"}),await l()),await H()}catch(n){v.textContent=n instanceof Error?n.message:"Не удалось выполнить перевод.",v.hidden=!1}finally{D(!1)}})()});f.addEventListener("change",()=>{et(f.value)});q.addEventListener("change",()=>{et(q.value)});I.addEventListener("change",()=>{s.updateSettings({saveHistory:I.checked}).then(l)});P.addEventListener("change",()=>{s.updateSettings({showSelectionButton:P.checked}).then(l)});W.addEventListener("input",J);K.addEventListener("input",tt);r('[data-action="copy-result"]').addEventListener("click",()=>{h&&navigator.clipboard.writeText(h.translation).then(()=>c("Перевод скопирован"))});r('[data-action="save-result"]').addEventListener("click",()=>{!h||h.alreadyRussian||s.addDictionaryEntry(h).then(async t=>{await l(),c(t.added?"Добавлено в словарь":"Уже в словаре")})});r('[data-action="translate-page"]').addEventListener("click",()=>{$({type:"TRANSLATE_PAGE",requestId:C(),sourceMode:p.settings.sourceMode}).then(t=>{if(!t.ok||!t.data)throw new Error(t.error??"Страница не ответила.");w(t.data),c("Подтвердите перевод на странице")}).catch(t=>{w({state:"error",completed:0,total:0,error:t.message})})});r('[data-action="restore-page"]').addEventListener("click",()=>{$({type:"RESTORE_PAGE",requestId:C()}).then(t=>t.data&&w(t.data)).catch(t=>c(t.message))});r('[data-action="prepare-engine"]').addEventListener("click",()=>{const t=L.prepareForMode(p.settings.sourceMode,{onProgress(a){y.textContent=`Загружаю языковой пакет: ${a}%`}});y.textContent="Подготавливаю локальный переводчик…",t.then(async()=>{await H(),c("Переводчик готов")}).catch(a=>{y.textContent=a instanceof Error?a.message:"Не удалось подготовить переводчик."})});r('[data-action="add-word"]').addEventListener("click",()=>X());mt.addEventListener("submit",t=>{if(t.submitter?.value==="cancel")return;t.preventDefault();const e={original:R.value,translation:z.value,note:Q.value};(N.value?s.updateDictionaryEntry(N.value,e).then(()=>({added:!0})):s.addDictionaryEntry(e)).then(async o=>{j.close(),await l(),c("added"in o&&!o.added?"Уже в словаре":"Словарь обновлён")}).catch(o=>c(o instanceof Error?o.message:"Не удалось сохранить запись"))});async function at(){await F("Очистить историю?","Все сохранённые переводы будут удалены. Личный словарь останется.","Очистить историю")&&(await s.clearHistory(),await l(),c("История очищена"))}r('[data-action="clear-history"]').addEventListener("click",()=>{at()});r('[data-action="clear-history-settings"]').addEventListener("click",()=>{at()});r('[data-action="clear-dictionary"]').addEventListener("click",()=>{(async()=>{await F("Очистить словарь?","Все личные слова, переводы и заметки будут удалены. История останется.","Очистить словарь")&&(await s.clearDictionary(),await l(),c("Словарь очищен"))})()});r('[data-action="clear-all"]').addEventListener("click",()=>{(async()=>{await F("Сбросить все данные?","История, словарь и ваши настройки будут удалены с этого устройства.","Сбросить всё")&&(await s.clearUserData(),h=void 0,O.hidden=!0,m.value="",m.dispatchEvent(new Event("input")),await l(),c("Данные сброшены"))})()});chrome.runtime.onMessage.addListener(t=>{typeof t=="object"&&t!==null&&"type"in t&&t.type==="PAGE_STATUS_CHANGED"&&"status"in t&&w(t.status)});chrome.storage.onChanged.addListener((t,a)=>{a==="local"&&t[ot]&&l()});(async()=>{await l(),await H();try{const t=await $({type:"GET_PAGE_STATUS",requestId:C()});t.data&&w(t.data)}catch{}})();
