from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
JS = ROOT / "assets" / "app.js"
CSS = ROOT / "assets" / "app.css"

js = JS.read_text(encoding="utf-8")
css = CSS.read_text(encoding="utf-8")

if 'const REMOTE_ASSISTANT_URL' not in js:
    start = js.index('async function flowLocalAssistant() {')
    end = js.index('\nfunction compareField(', start)

    replacement = r'''const REMOTE_ASSISTANT_URL = "https://opndjkjfdlhjyuqwyyer.supabase.co/functions/v1/ai-base-assistant";
const ASSISTANT_SESSION_KEY = "ai-base-assistant-key";

function assistantSafePlatforms() {
  return state.platforms
    .filter(p => p.category !== PAY_CAT)
    .map(p => ({
      id:p.id, name:p.name, category:p.category, status:p.status,
      purpose:p.purpose, strengths:p.strengths, tips:(p.tips||[]).slice(0,8), tags:(p.tags||[]).slice(0,20),
      rating:Number(p.rating||0), usage:p.usage||"", pinned:!!p.pinned,
      plan:{
        tier:p.plan?.tier||"", price:Number(p.plan?.price||0), currency:p.plan?.currency||"",
        period:p.plan?.period||"", renewsOn:p.plan?.renewsOn||""
      }
    }));
}

function assistantTextHtml(text) {
  return esc(String(text || "")).replace(/\n/g,"<br>");
}

function assistantRemoteResult(data) {
  const ids = Array.isArray(data?.recommended_ids) ? data.recommended_ids : [];
  const cards = ids.map(id => byId(id)).filter(Boolean).slice(0,5);
  return "<div class='assistant-answer remote'><div class='assistant-mode'>✦ LLM · " + esc(data?.model || "модель") + "</div>" +
    "<div class='assistant-llm-text'>" + assistantTextHtml(data?.answer || "") + "</div>" +
    (cards.length ? "<div class='assistant-recs'>" + cards.map(p => assistantCard(p,"Рекомендовано моделью по данным вашей базы")).join("") + "</div>" : "") +
    "</div>";
}

async function callRemoteAssistant(query, secret) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 45000);
  try {
    const res = await fetch(REMOTE_ASSISTANT_URL, {
      method:"POST",
      headers:{"Content-Type":"application/json","x-assistant-key":secret},
      body:JSON.stringify({query:String(query||"").slice(0,1200),platforms:assistantSafePlatforms()}),
      signal:ctrl.signal
    });
    let data = {};
    try { data = await res.json(); } catch (_) {}
    if (!res.ok) {
      const code = data?.error || ("http_" + res.status);
      throw new Error(code);
    }
    if (!data?.answer) throw new Error("empty_answer");
    return data;
  } finally {
    clearTimeout(timer);
  }
}

async function flowLocalAssistant() {
  const body = "<div class='assistant-ui'>" +
    "<div class='assistant-privacy'>🔒 В LLM отправляются только описания сервисов, рейтинги и тарифные поля. Логины, пароли, API-ключи и приватные заметки не отправляются.</div>" +
    "<div class='assistant-connect'><div><b id='assistantConnTitle'>Локальный режим</b><small id='assistantConnSub'>Работает без внешнего API</small></div><div class='assistant-connect-actions'><input id='assistantKey' type='password' placeholder='Ключ подключения к LLM' autocomplete='off'><button class='btn sm' id='assistantConnect' type='button'>Подключить LLM</button><button class='btn sm ghost' id='assistantDisconnect' type='button'>Сбросить</button></div></div>" +
    "<form id='assistantForm'><div class='assistant-input'><input id='assistantQ' type='text' placeholder='Например: чем лучше сделать презентацию?' autocomplete='off'><button class='btn primary' type='submit'>Спросить</button></div></form>" +
    "<div class='assistant-examples'><button type='button' data-example='Чем лучше сделать презентацию?'>Презентация</button><button type='button' data-example='На каких подписках можно сэкономить?'>Экономия</button><button type='button' data-example='Какие списания ближайшие?'>Списания</button><button type='button' data-example='Чем лучше писать код?'>Код</button></div>" +
    "<div id='assistantOut' class='assistant-out'><div class='assistant-empty'>Задайте вопрос о сервисах, подписках или задачах.</div></div></div>";

  await modal({
    title:"Помощник по AI-базе",
    sub:"LLM с безопасным fallback на локальный анализ",
    body:body,
    buttons:[{label:"Закрыть",value:null}],
    onOpen: root => {
      const keyInput = root.querySelector("#assistantKey");
      const connTitle = root.querySelector("#assistantConnTitle");
      const connSub = root.querySelector("#assistantConnSub");
      const disconnect = root.querySelector("#assistantDisconnect");
      const out = root.querySelector("#assistantOut");

      const currentKey = () => sessionStorage.getItem(ASSISTANT_SESSION_KEY) || "";
      const refreshConnection = () => {
        const on = !!currentKey();
        connTitle.textContent = on ? "LLM подключен" : "Локальный режим";
        connSub.textContent = on ? "Ключ хранится только до закрытия вкладки" : "Работает без внешнего API";
        keyInput.hidden = on;
        root.querySelector("#assistantConnect").hidden = on;
        disconnect.hidden = !on;
      };
      refreshConnection();

      root.querySelector("#assistantConnect").addEventListener("click", () => {
        const v = keyInput.value.trim();
        if (!v) { toast("Введите ключ подключения"); return; }
        sessionStorage.setItem(ASSISTANT_SESSION_KEY,v);
        keyInput.value="";
        refreshConnection();
        toast("LLM подключен на эту вкладку");
      });
      disconnect.addEventListener("click", () => {
        sessionStorage.removeItem(ASSISTANT_SESSION_KEY);
        refreshConnection();
        toast("LLM отключен — используется локальный режим");
      });

      const run = async q => {
        q = String(q||"").trim();
        if (!q) { out.innerHTML = assistantAnswer(""); return; }
        const secret = currentKey();
        if (!secret) { out.innerHTML = assistantAnswer(q); return; }

        out.innerHTML = "<div class='assistant-loading'>✦ Анализирую базу через LLM…</div>";
        try {
          const data = await callRemoteAssistant(q,secret);
          out.innerHTML = assistantRemoteResult(data);
        } catch (err) {
          const code = String(err?.message || err || "error");
          if (code === "unauthorized") sessionStorage.removeItem(ASSISTANT_SESSION_KEY);
          refreshConnection();
          out.innerHTML = "<div class='assistant-fallback'>LLM сейчас недоступен (" + esc(code) + "). Показан локальный анализ.</div>" + assistantAnswer(q);
        }
      };

      root.querySelector("#assistantForm").addEventListener("submit", e => { e.preventDefault(); run(root.querySelector("#assistantQ").value); });
      root.querySelectorAll("[data-example]").forEach(b => b.addEventListener("click", () => { root.querySelector("#assistantQ").value=b.dataset.example; run(b.dataset.example); }));
      out.addEventListener("click", e => {
        const row=e.target.closest("[data-assistant-id]");
        if (!row) return;
        closeDlg(null);
        $("#cardOv").dataset.mode="view";
        openCard(row.dataset.assistantId);
      });
    }
  });
}
'''
    js = js[:start] + replacement + js[end:]

if '.assistant-connect{' not in css:
    css += r'''

/* ---------- secure remote assistant ---------- */
.assistant-connect{display:flex;align-items:center;justify-content:space-between;gap:12px;border:1px solid var(--line);background:var(--panel2);border-radius:11px;padding:10px 11px;flex-wrap:wrap}
.assistant-connect b{display:block;font-size:13px}.assistant-connect small{display:block;color:var(--muted);font-size:11.5px;margin-top:2px}
.assistant-connect-actions{display:flex;gap:6px;align-items:center;flex-wrap:wrap}.assistant-connect-actions input{min-width:210px;padding:7px 9px;border:1px solid var(--line);border-radius:9px;background:var(--panel);color:var(--txt);font:inherit;font-size:12px}
.assistant-loading{padding:26px 10px;text-align:center;color:var(--accTxt)}
.assistant-fallback{font-size:12px;color:var(--warn);background:var(--warnSoft);border-radius:9px;padding:8px 10px;margin-bottom:10px}
.assistant-mode{display:inline-block;font-size:11.5px;color:var(--accTxt);background:var(--accSoft);padding:4px 8px;border-radius:999px;margin-bottom:10px}
.assistant-llm-text{font-size:13.5px;line-height:1.6}
@media (max-width:640px){.assistant-connect-actions{width:100%}.assistant-connect-actions input{width:100%;min-width:0}}
'''

JS.write_text(js, encoding="utf-8")
CSS.write_text(css, encoding="utf-8")

assert 'const REMOTE_ASSISTANT_URL' in js
assert 'function assistantSafePlatforms()' in js
assert 'async function callRemoteAssistant' in js
assert 'sessionStorage.setItem(ASSISTANT_SESSION_KEY' in js
assert 'Логины, пароли, API-ключи' in js
assert '.assistant-connect{' in css
print('Secure remote assistant frontend applied')
