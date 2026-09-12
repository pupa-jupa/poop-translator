import{c as C,S as st,g as it}from"./messages-U-GAzmqE.js";(function(){const e=document.createElement("link").relList;if(e&&e.supports&&e.supports("modulepreload"))return;for(const r of document.querySelectorAll('link[rel="modulepreload"]'))n(r);new MutationObserver(r=>{for(const s of r)if(s.type==="childList")for(const d of s.addedNodes)d.tagName==="LINK"&&d.rel==="modulepreload"&&n(d)}).observe(document,{childList:!0,subtree:!0});function a(r){const s={};return r.integrity&&(s.integrity=r.integrity),r.referrerPolicy&&(s.referrerPolicy=r.referrerPolicy),r.crossOrigin==="use-credentials"?s.credentials="include":r.crossOrigin==="anonymous"?s.credentials="omit":s.credentials="same-origin",s}function n(r){if(r.ep)return;r.ep=!0;const s=a(r);fetch(r.href,s)}})();class u extends Error{constructor(e,a){super(a),this.code=e,this.name="TranslationEngineError"}code}function ct(t){return t==="available"||t==="readily"?"available":t==="downloadable"||t==="after-download"?"downloadable":t==="downloading"?"downloading":"unavailable"}function F(t){if(t instanceof u)return t;const e=t instanceof DOMException?t.name:"";return e==="NotAllowedError"?new u("ACTIVATION_REQUIRED","Chrome ждёт ваш клик, чтобы подготовить переводчик. Нажмите «Повторить»."):e==="NetworkError"?new u("DOWNLOAD_FAILED","Не удалось загрузить языковой пакет. Проверьте интернет и повторите."):e==="NotSupportedError"?new u("PAIR_UNAVAILABLE","Перевод с английского на русский недоступен в этом Chrome."):new u("TRANSLATION_FAILED","Не удалось выполнить перевод. Попробуйте ещё раз.")}class lt{constructor(e=globalThis,a=18e4){this.creationTimeoutMs=a,this.environment=e}creationTimeoutMs;environment;translators=new Map;detector;async getAvailability(e){const a=this.environment.Translator;if(!a)return"unavailable";try{return ct(await a.availability({sourceLanguage:e,targetLanguage:"ru"}))}catch{return"unavailable"}}createTranslator(e,a){const n=this.environment.Translator;if(!n)return Promise.reject(new u("API_UNAVAILABLE","Встроенный переводчик недоступен. Нужен Google Chrome 138 или новее."));const r=this.translators.get(e);if(r)return r;const s=n.create({sourceLanguage:e,targetLanguage:"ru",monitor(w){w.addEventListener("downloadprogress",S=>{a.onProgress?.(Math.round(Math.max(0,Math.min(1,S.loaded))*100))})}});let d;const y=new Promise((w,S)=>{d=setTimeout(()=>S(new u("DOWNLOAD_FAILED","Подготовка переводчика заняла слишком много времени. Нажмите «Повторить».")),this.creationTimeoutMs)}),G=Promise.race([s,y]).finally(()=>{d!==void 0&&clearTimeout(d)}).catch(w=>{throw this.translators.delete(e),F(w)});return this.translators.set(e,G),G}createDetector(e){const a=this.environment.LanguageDetector;if(a)return this.detector??=a.create({expectedInputLanguages:["en","ru"],monitor(n){n.addEventListener("downloadprogress",r=>{e.onProgress?.(Math.round(Math.max(0,Math.min(1,r.loaded))*100))})}}).catch(n=>{throw this.detector=void 0,n}),this.detector}async prepare(e="en",a={}){await this.createTranslator(e,a)}async detectSource(e,a){if(e.length<8)return"en";const n=this.createDetector(a);if(!n)return"en";try{const r=await n,[s]=await r.detect(e);return!s||s.confidence<.65||s.detectedLanguage==="und"?"en":s.detectedLanguage}catch{return"en"}}async translate(e,a,n={}){const r=e.trim();if(!r)throw new u("TRANSLATION_FAILED","Введите текст для перевода.");if(!this.environment.Translator)throw new u("API_UNAVAILABLE","Встроенный переводчик недоступен. Нужен Google Chrome 138 или новее.");try{const s=a==="auto"?await this.detectSource(r,n):"en";if(s==="ru")return{original:r,translation:r,sourceLanguage:s,targetLanguage:"ru",alreadyRussian:!0};const y=(await(await this.createTranslator(s,n)).translate(r)).trim();if(!y)throw new Error("Empty translation");return{original:r,translation:y,sourceLanguage:s,targetLanguage:"ru",alreadyRussian:!1}}catch(s){throw F(s)}}destroy(){for(const e of this.translators.values())e.then(a=>a.destroy?.()).catch(()=>{});this.translators.clear(),this.detector?.then(e=>e.destroy?.()).catch(()=>{}),this.detector=void 0}}const V=`
  <svg viewBox="0 0 48 48" aria-hidden="true">
    <path fill="currentColor" d="M9 36c0-5 4-9 10-10-5-1-7-5-5-9 1-4 5-6 9-5-2-3 0-7 4-9 1 5 5 6 8 9 2 3 1 5-1 7 5 1 9 4 9 9 0 4-3 7-5 8 2 1 3 4 3 6H10c-1-2-1-4-1-6Z"/>
    <circle cx="21" cy="27" r="2.2" fill="#221b29"/><circle cx="32" cy="27" r="2.2" fill="#221b29"/>
    <path d="M20 34c4 3 9 3 13 0" stroke="#221b29" stroke-width="2.3" stroke-linecap="round"/>
  </svg>`;function dt(t){t.innerHTML=`
    <main class="app-shell">
      <header class="brand-header">
        <div class="brand-mark">${V}</div>
        <div class="brand-copy">
          <h1>poop translator</h1>
          <p>карманный переводчик</p>
        </div>
        <div class="engine-pill" data-engine-status title="Состояние локального переводчика">
          <span class="engine-dot"></span><span>Проверяю</span>
        </div>
      </header>

      <nav class="tab-bar" role="tablist" aria-label="Разделы">
        <button role="tab" data-tab="translate" aria-selected="true">Перевод</button>
        <button role="tab" data-tab="history" aria-selected="false">История</button>
        <button role="tab" data-tab="dictionary" aria-selected="false">Словарь</button>
        <button role="tab" data-tab="settings" aria-selected="false">Настройки</button>
      </nav>

      <div class="views">
        <section class="view" data-view="translate" role="tabpanel">
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

          <div class="inline-error" data-translate-error hidden></div>

          <section class="page-tools">
            <div><span class="section-kicker">Вся страница</span><p data-page-status>Переведу основной текст, сохранив кнопки и ссылки.</p></div>
            <div class="page-actions">
              <button class="button button--soft" type="button" data-action="translate-page">Перевести страницу</button>
              <button class="icon-button" type="button" aria-label="Вернуть оригинал" title="Вернуть оригинал" data-action="restore-page">↶</button>
            </div>
          </section>
        </section>

        <section class="view" data-view="history" role="tabpanel" hidden>
          <div class="section-head"><div><span class="section-kicker">Недавнее</span><h2>История</h2></div><button class="text-button" type="button" data-action="clear-history">Очистить</button></div>
          <label class="search-box"><span aria-hidden="true">⌕</span><input type="search" data-search="history" placeholder="Найти перевод" aria-label="Поиск в истории"></label>
          <div class="item-list" data-history-list></div>
        </section>

        <section class="view" data-view="dictionary" role="tabpanel" hidden>
          <div class="section-head"><div><span class="section-kicker">Мои слова</span><h2>Словарь</h2></div><button class="button button--accent button--small" type="button" data-action="add-word">+ Добавить</button></div>
          <label class="search-box"><span aria-hidden="true">⌕</span><input type="search" data-search="dictionary" placeholder="Найти слово" aria-label="Поиск в словаре"></label>
          <div class="item-list" data-dictionary-list></div>
        </section>

        <section class="view" data-view="settings" role="tabpanel" hidden>
          <div class="section-head"><div><span class="section-kicker">Под себя</span><h2>Настройки</h2></div></div>
          <div class="settings-group">
            <label class="setting-row setting-row--stack"><span><strong>Исходный язык</strong><small>Основное направление — английский → русский</small></span>
              <select data-control="settings-source-mode"><option value="en">Английский</option><option value="auto">Автоопределение</option></select>
            </label>
            <label class="setting-row"><span><strong>Сохранять историю</strong><small>Только ручные и выделенные переводы</small></span><input class="switch" type="checkbox" aria-label="Сохранять историю" data-control="save-history"></label>
            <label class="setting-row"><span><strong>Кнопка у выделения</strong><small>Показывать маленького помощника на страницах</small></span><input class="switch" type="checkbox" aria-label="Показывать кнопку возле выделения" data-control="selection-button"></label>
          </div>

          <div class="engine-card">
            <div class="engine-card__icon">${V}</div>
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
    <div class="toast" data-toast hidden></div>`}function ut(t,e){t.querySelectorAll("[data-tab]").forEach(a=>{const n=a.dataset.tab===e;a.setAttribute("aria-selected",String(n)),a.tabIndex=n?0:-1}),t.querySelectorAll("[data-view]").forEach(a=>{a.hidden=a.dataset.view!==e})}const q=document.querySelector("#app");dt(q);function o(t){const e=document.querySelector(t);if(!e)throw new Error(`Missing UI element: ${t}`);return e}const i=it(),E=new lt;let p,v,W=0;const h=o("#source-text"),pt=o("[data-char-count]"),O=o('[data-form="translate"]'),K=O.querySelector('button[type="submit"]'),L=o('[data-control="source-mode"]'),I=o('[data-control="settings-source-mode"]'),N=o('[data-control="save-history"]'),P=o('[data-control="selection-button"]'),H=o("[data-result]"),vt=o("[data-result-original]"),ht=o("[data-result-translation]"),mt=o("[data-result-language]"),m=o("[data-translate-error]"),j=o("[data-engine-status]"),g=o("[data-engine-detail]"),T=o("[data-history-list]"),A=o("[data-dictionary-list]"),z=o('[data-search="history"]'),Q=o('[data-search="dictionary"]'),b=o("[data-page-status]"),Y=o("[data-word-modal]"),bt=o('[data-form="word"]'),R=o("[data-word-id]"),_=o("[data-word-original]"),Z=o("[data-word-translation]"),J=o("[data-word-note]"),gt=o("[data-word-modal-title]"),k=o("[data-confirm-modal]"),ft=o("[data-confirm-title]"),yt=o("[data-confirm-text]"),D=o("[data-toast]");function l(t){window.clearTimeout(W),D.textContent=t,D.hidden=!1,W=window.setTimeout(()=>{D.hidden=!0},1900)}function M(t,e="Перевести"){K.disabled=t,K.querySelector("span").textContent=t?"Перевожу…":e}function wt(){L.value=p.settings.sourceMode,I.value=p.settings.sourceMode,N.checked=p.settings.saveHistory,P.checked=p.settings.showSelectionButton}function Et(t){return{manual:"вручную",selection:"выделение","context-menu":"контекстное меню"}[t.source]}function X(t){return new Intl.DateTimeFormat("ru-RU",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"}).format(t)}function tt(t,e,a){const n=document.createElement("div");return n.className="empty-state",n.innerHTML='<div class="empty-state__face"></div><strong></strong><p></p>',n.querySelector(".empty-state__face").textContent=t,n.querySelector("strong").textContent=e,n.querySelector("p").textContent=a,n}function x(t,e){const a=document.createElement("button");return a.type="button",a.className="mini-action",a.textContent=t,a.addEventListener("click",()=>{e()}),a}function et(){const t=z.value.trim().toLocaleLowerCase(),e=p.history.filter(a=>!t||a.original.toLocaleLowerCase().includes(t)||a.translation.toLocaleLowerCase().includes(t));if(T.replaceChildren(),!e.length){T.append(tt("◷",t?"Ничего не нашлось":"Пока пусто",t?"Попробуйте другой запрос.":"Ваши ручные переводы и переводы выделений появятся здесь."));return}for(const a of e){const n=document.createElement("article");n.className="item-card",n.innerHTML=`
      <div class="item-main"><p></p><span class="item-arrow">→</span><p></p></div>
      <div class="item-meta"><span></span><div class="item-buttons"></div></div>`;const r=n.querySelectorAll("p");r[0].textContent=a.original,r[1].textContent=a.translation,n.querySelector(".item-meta > span").textContent=`${Et(a)} · ${X(a.createdAt)}`,n.querySelector(".item-buttons").append(x("♡ В словарь",async()=>{const d=await i.addDictionaryEntry(a);await c(),l(d.added?"Добавлено в словарь":"Уже в словаре")}),x("Удалить",async()=>{await i.removeHistoryEntry(a.id),await c()})),T.append(n)}}function at(t){R.value=t?.id??"",_.value=t?.original??"",Z.value=t?.translation??"",J.value=t?.note??"",gt.textContent=t?"Изменить запись":"Новое слово",Y.showModal(),window.setTimeout(()=>_.focus(),0)}function nt(){const t=Q.value.trim().toLocaleLowerCase(),e=p.dictionary.filter(a=>!t||a.original.toLocaleLowerCase().includes(t)||a.translation.toLocaleLowerCase().includes(t)||a.note.toLocaleLowerCase().includes(t));if(A.replaceChildren(),!e.length){A.append(tt("♡",t?"Ничего не нашлось":"Ваш словарь ждёт",t?"Проверьте написание или заметку.":"Добавляйте сюда полезные слова и фразы одним нажатием."));return}for(const a of e){const n=document.createElement("article");n.className="item-card",n.innerHTML=`
      <div class="item-main"><p></p><span class="item-arrow">→</span><p></p></div>
      <div class="item-meta"><span></span><div class="item-buttons"></div></div>`;const r=n.querySelectorAll("p");r[0].textContent=a.original,r[1].textContent=a.translation,n.querySelector(".item-meta > span").textContent=a.note||X(a.updatedAt),n.querySelector(".item-buttons").append(x("Изменить",()=>at(a)),x("Удалить",async()=>{await i.removeDictionaryEntry(a.id),await c()})),A.append(n)}}async function c(){p=await i.loadState(),wt(),et(),nt()}async function ot(t){await i.updateSettings({sourceMode:t}),await c()}function Lt(t){v=t,vt.textContent=t.original,ht.textContent=t.alreadyRussian?"Текст уже на русском":t.translation,mt.textContent=`${t.sourceLanguage.toUpperCase()} → RU`,H.hidden=!1,o('[data-action="save-result"]').disabled=t.alreadyRussian}async function $(){const t=await E.getAvailability("en");j.dataset.state=t;const e={available:"Готов",downloadable:"Нужна загрузка",downloading:"Загрузка",unavailable:"Недоступен"}[t],a={available:"Языковой пакет готов. Перевод выполняется на устройстве.",downloadable:"Нажмите «Подготовить», чтобы бесплатно скачать языковой пакет.",downloading:"Chrome загружает языковой пакет.",unavailable:"Нужен настольный Google Chrome 138 или новее."}[t];j.querySelector("span:last-child").textContent=e,g.textContent=a}async function U(t){const[e]=await chrome.tabs.query({active:!0,currentWindow:!0});if(!e?.id||!e.url?.match(/^https?:\/\//))throw new Error("На этой странице перевод недоступен. Откройте обычный сайт http/https.");try{return await chrome.tabs.sendMessage(e.id,t)}catch{throw new Error("Обновите страницу после установки расширения и повторите.")}}function f(t){switch(t.state){case"awaiting-activation":b.textContent="Подтвердите запуск внизу открытой страницы.";break;case"translating":b.textContent=t.total?`Переведено ${t.completed} из ${t.total} фрагментов…`:"Подготавливаю локальный переводчик…";break;case"translated":b.textContent=t.error??`Готово: ${t.completed} фрагментов.`;break;case"error":b.textContent=t.error??"Не удалось перевести страницу.";break;default:b.textContent="Переведу основной текст, сохранив кнопки и ссылки."}}function B(t,e,a){return ft.textContent=t,yt.textContent=e,o("[data-confirm-button]").textContent=a,k.showModal(),new Promise(n=>{k.addEventListener("close",()=>n(k.returnValue==="confirm"),{once:!0})})}q.querySelectorAll('[role="tab"]').forEach(t=>{t.addEventListener("click",()=>{ut(q,t.dataset.tab),window.scrollTo({top:0,behavior:"instant"})})});h.addEventListener("input",()=>{pt.textContent=`${h.value.length.toLocaleString("ru-RU")} / 10 000`});h.addEventListener("keydown",t=>{t.key==="Enter"&&(t.ctrlKey||t.metaKey)&&(t.preventDefault(),O.requestSubmit())});O.addEventListener("submit",t=>{t.preventDefault();const e=h.value.trim();if(!e){m.textContent="Напишите текст, который нужно перевести.",m.hidden=!1,h.focus();return}const a=E.prepare("en",{onProgress(n){M(!0,`Загрузка ${n}%`),g.textContent=`Загружаю языковой пакет: ${n}%`}});(async()=>{m.hidden=!0,H.hidden=!0,M(!0);try{await a;const n=await E.translate(e,L.value);Lt(n),n.alreadyRussian||(await i.addHistory({requestId:C(),original:n.original,translation:n.translation,sourceLanguage:n.sourceLanguage,targetLanguage:"ru",source:"manual"}),await c()),await $()}catch(n){m.textContent=n instanceof Error?n.message:"Не удалось выполнить перевод.",m.hidden=!1}finally{M(!1)}})()});L.addEventListener("change",()=>{ot(L.value)});I.addEventListener("change",()=>{ot(I.value)});N.addEventListener("change",()=>{i.updateSettings({saveHistory:N.checked}).then(c)});P.addEventListener("change",()=>{i.updateSettings({showSelectionButton:P.checked}).then(c)});z.addEventListener("input",et);Q.addEventListener("input",nt);o('[data-action="copy-result"]').addEventListener("click",()=>{v&&navigator.clipboard.writeText(v.translation).then(()=>l("Перевод скопирован"))});o('[data-action="save-result"]').addEventListener("click",()=>{!v||v.alreadyRussian||i.addDictionaryEntry(v).then(async t=>{await c(),l(t.added?"Добавлено в словарь":"Уже в словаре")})});o('[data-action="translate-page"]').addEventListener("click",()=>{U({type:"TRANSLATE_PAGE",requestId:C(),sourceMode:p.settings.sourceMode}).then(t=>{if(!t.ok||!t.data)throw new Error(t.error??"Страница не ответила.");f(t.data),l("Подтвердите перевод на странице")}).catch(t=>{f({state:"error",completed:0,total:0,error:t.message})})});o('[data-action="restore-page"]').addEventListener("click",()=>{U({type:"RESTORE_PAGE",requestId:C()}).then(t=>t.data&&f(t.data)).catch(t=>l(t.message))});o('[data-action="prepare-engine"]').addEventListener("click",()=>{const t=E.prepare("en",{onProgress(e){g.textContent=`Загружаю языковой пакет: ${e}%`}});g.textContent="Подготавливаю локальный переводчик…",t.then(async()=>{await $(),l("Переводчик готов")}).catch(e=>{g.textContent=e instanceof Error?e.message:"Не удалось подготовить переводчик."})});o('[data-action="add-word"]').addEventListener("click",()=>at());bt.addEventListener("submit",t=>{if(t.submitter?.value==="cancel")return;t.preventDefault();const a={original:_.value,translation:Z.value,note:J.value};(R.value?i.updateDictionaryEntry(R.value,a).then(()=>({added:!0})):i.addDictionaryEntry(a)).then(async r=>{Y.close(),await c(),l("added"in r&&!r.added?"Уже в словаре":"Словарь обновлён")}).catch(r=>l(r instanceof Error?r.message:"Не удалось сохранить запись"))});async function rt(){await B("Очистить историю?","Все сохранённые переводы будут удалены. Личный словарь останется.","Очистить историю")&&(await i.clearHistory(),await c(),l("История очищена"))}o('[data-action="clear-history"]').addEventListener("click",()=>{rt()});o('[data-action="clear-history-settings"]').addEventListener("click",()=>{rt()});o('[data-action="clear-dictionary"]').addEventListener("click",()=>{(async()=>{await B("Очистить словарь?","Все личные слова, переводы и заметки будут удалены. История останется.","Очистить словарь")&&(await i.clearDictionary(),await c(),l("Словарь очищен"))})()});o('[data-action="clear-all"]').addEventListener("click",()=>{(async()=>{await B("Сбросить все данные?","История, словарь и ваши настройки будут удалены с этого устройства.","Сбросить всё")&&(await i.clearUserData(),v=void 0,H.hidden=!0,h.value="",h.dispatchEvent(new Event("input")),await c(),l("Данные сброшены"))})()});chrome.runtime.onMessage.addListener(t=>{typeof t=="object"&&t!==null&&"type"in t&&t.type==="PAGE_STATUS_CHANGED"&&"status"in t&&f(t.status)});chrome.storage.onChanged.addListener((t,e)=>{e==="local"&&t[st]&&c()});(async()=>{await c(),await $();try{const t=await U({type:"GET_PAGE_STATUS",requestId:C()});t.data&&f(t.data)}catch{}})();
