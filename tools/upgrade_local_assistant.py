from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML = ROOT / "ai-platforms.html"
JS = ROOT / "assets" / "app.js"
CSS = ROOT / "assets" / "app.css"

html = HTML.read_text(encoding="utf-8")
js = JS.read_text(encoding="utf-8")
css = CSS.read_text(encoding="utf-8")

if 'id="assistantBtn"' not in html:
    marker = '    <button class="btn" id="compareBtn" type="button">⇄ Сравнить</button>\n'
    assert marker in html, "compare button marker not found"
    html = html.replace(marker, '    <button class="btn" id="assistantBtn" type="button">✦ Помощник</button>\n' + marker, 1)

if 'async function flowLocalAssistant()' not in js:
    marker = '\nfunction compareField(label, values) {'
    assert marker in js, "comparison helper marker not found"
    insert = r'''
const ASSISTANT_INTENTS = [
  { words:["презентац","слайд","pitch","питч"], cats:["Дизайн и презентации"], label:"презентаций" },
  { words:["код","сайт","программ","разработ","github","репозитор"], cats:["Код"], label:"кода и разработки" },
  { words:["картин","изображ","фото","дизайн","визуал"], cats:["Изображения","Дизайн и презентации"], label:"изображений и дизайна" },
  { words:["видео","ролик","аватар","анимац"], cats:["Видео"], label:"видео" },
  { words:["аудио","голос","музык","озвуч"], cats:["Аудио"], label:"аудио" },
  { words:["текст","письм","анализ","документ","исслед","чат","ассист"], cats:["Текст/ассистенты"], label:"текста и анализа" },
  { words:["автомат","workflow","n8n","make","интеграц"], cats:["Автоматизация"], label:"автоматизации" },
  { words:["обуч","курс","учиться","урок"], cats:["Обучение"], label:"обучения" }
];

function assistantIntent(q) {
  const s = nz(q).trim().toLowerCase();
  if (!s) return { type:"empty" };
  if (["эконом","сэконом","трачу","расход","отмен","подписк","лишн","зря"].some(w => s.includes(w))) return { type:"economics" };
  if (["списан","продлен","продлён","скоро платить","оплат"].some(w => s.includes(w))) return { type:"charges" };
  for (const i of ASSISTANT_INTENTS) if (i.words.some(w => s.includes(w))) return { type:"recommend", cats:i.cats, label:i.label };
  return { type:"search", query:s };
}

function assistantScore(p) {
  let score = 0;
  if (p.status === "Активна") score += 35;
  if (p.status === "Пробный период") score += 20;
  score += Number(p.rating || 0) * 8;
  if (p.usage === "Ежедневно") score += 25;
  if (p.usage === "Еженедельно") score += 15;
  if (p.usage === "Редко") score += 4;
  if (p.usage === "Не использую") score -= 20;
  if (p.pinned) score += 6;
  return score;
}

function assistantCard(p, reason) {
  return "<button class='assistant-rec' type='button' data-assistant-id='" + esc(p.id) + "'>" +
    iconHTML(p) + "<span><b>" + esc(p.name) + "</b><small>" + esc(reason) + "</small></span>" +
    "<em>" + esc(priceLabel(p) || (p.status === "Активна" ? "бесплатно" : p.status)) + "</em></button>";
}

function assistantAnswer(query) {
  const intent = assistantIntent(query);
  if (intent.type === "empty") return "<div class='assistant-empty'>Введите вопрос о вашей базе AI-сервисов.</div>";

  if (intent.type === "economics") {
    const e = subscriptionEconomics();
    if (!e.candidates.length) return "<div class='assistant-answer'><b>Я не вижу очевидных кандидатов на сокращение расходов.</b><p>Отметьте частоту использования у платных сервисов — тогда анализ станет точнее.</p></div>";
    return "<div class='assistant-answer'><b>Потенциальная экономия: " + esc(e.saving) + "/мес.</b>" +
      "<p>Сначала стоит проверить эти подписки:</p><div class='assistant-recs'>" +
      e.candidates.slice(0,5).map(x => assistantCard(x.p, valueVerdict(x.p) + " · " + (x.p.usage || "частота не указана"))).join("") +
      "</div><p class='assistant-note'>Это рекомендация по данным вашей базы, а не автоматическая команда на отмену.</p></div>";
  }

  if (intent.type === "charges") {
    const rows = state.platforms.map(p => ({p:p,d:nextCharge(p)})).filter(x => x.d).sort((a,b) => a.d-b.d).slice(0,6);
    if (!rows.length) return "<div class='assistant-answer'><b>Ближайшие списания не найдены.</b><p>Проверьте, заполнены ли даты продления в карточках.</p></div>";
    return "<div class='assistant-answer'><b>Ближайшие списания</b><div class='assistant-recs'>" +
      rows.map(x => assistantCard(x.p, fmtDate(x.d.toISOString().slice(0,10)) + " · " + (priceLabel(x.p) || "цена не указана"))).join("") + "</div></div>";
  }

  let candidates = [];
  let title = "Вот наиболее подходящие варианты из вашей базы";
  if (intent.type === "recommend") {
    candidates = state.platforms.filter(p => intent.cats.includes(p.category) && p.category !== PAY_CAT);
    title = "Для " + intent.label + " я бы сначала рассмотрел:";
  } else {
    const q = intent.query;
    candidates = state.platforms.filter(p => {
      const hay = [p.name,p.category,p.purpose,p.strengths,(p.tips||[]).join(" "),(p.tags||[]).join(" ")].join(" ").toLowerCase();
      return hay.includes(q) || q.split(/\s+/).filter(x => x.length > 2).some(x => hay.includes(x));
    }).filter(p => p.category !== PAY_CAT);
  }

  candidates.sort((a,b) => assistantScore(b)-assistantScore(a) || a.name.localeCompare(b.name,"ru"));
  if (!candidates.length) return "<div class='assistant-answer'><b>В базе нет достаточно подходящей карточки.</b><p>Попробуйте сформулировать задачу через категорию: презентация, код, изображения, видео, аудио, текст или автоматизация.</p></div>";

  return "<div class='assistant-answer'><b>" + esc(title) + "</b><div class='assistant-recs'>" +
    candidates.slice(0,5).map((p,i) => assistantCard(p,
      (i === 0 ? "Лучший матч · " : "") + (p.usage ? p.usage + " · " : "") +
      (p.rating ? "рейтинг " + p.rating + "/5 · " : "") + (p.strengths || p.purpose || p.category).slice(0,120)
    )).join("") + "</div></div>";
}

async function flowLocalAssistant() {
  const body = "<div class='assistant-ui'>" +
    "<div class='assistant-privacy'>🔒 Работает локально: данные карточек никуда не отправляются.</div>" +
    "<form id='assistantForm'><div class='assistant-input'><input id='assistantQ' type='text' placeholder='Например: чем лучше сделать презентацию?' autocomplete='off'><button class='btn primary' type='submit'>Спросить</button></div></form>" +
    "<div class='assistant-examples'><button type='button' data-example='Чем лучше сделать презентацию?'>Презентация</button><button type='button' data-example='На каких подписках можно сэкономить?'>Экономия</button><button type='button' data-example='Какие списания ближайшие?'>Списания</button><button type='button' data-example='Чем лучше писать код?'>Код</button></div>" +
    "<div id='assistantOut' class='assistant-out'><div class='assistant-empty'>Задайте вопрос о сервисах, подписках или задачах.</div></div></div>";

  await modal({
    title:"Помощник по AI-базе",
    sub:"Рекомендации на основе ваших собственных карточек",
    body:body,
    buttons:[{label:"Закрыть",value:null}],
    onOpen: root => {
      const run = q => { root.querySelector("#assistantOut").innerHTML = assistantAnswer(q); };
      root.querySelector("#assistantForm").addEventListener("submit", e => { e.preventDefault(); run(root.querySelector("#assistantQ").value); });
      root.querySelectorAll("[data-example]").forEach(b => b.addEventListener("click", () => { root.querySelector("#assistantQ").value=b.dataset.example; run(b.dataset.example); }));
      root.querySelector("#assistantOut").addEventListener("click", e => {
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
    js = js.replace(marker, '\n' + insert + marker, 1)

if '$("#assistantBtn").addEventListener' not in js:
    marker = '$("#compareBtn").addEventListener("click", flowComparePlatforms);'
    assert marker in js, "compare listener marker not found"
    js = js.replace(marker, '$("#assistantBtn").addEventListener("click", flowLocalAssistant);\n' + marker, 1)

if '.assistant-ui{' not in css:
    css += r'''

/* ---------- local AI-base assistant ---------- */
.assistant-ui{display:grid;gap:12px}
.assistant-privacy{font-size:12.5px;color:var(--ok);background:var(--okSoft);border-radius:10px;padding:8px 10px}
.assistant-input{display:flex;gap:8px}
.assistant-input input{flex:1;padding:10px 12px;border:1px solid var(--line);border-radius:10px;background:var(--panel2);color:var(--txt);font:inherit}
.assistant-examples{display:flex;gap:6px;flex-wrap:wrap}
.assistant-examples button{border:1px solid var(--line);background:var(--panel2);color:var(--muted);border-radius:999px;padding:6px 9px;font-size:12px;cursor:pointer}
.assistant-examples button:hover{border-color:var(--acc);color:var(--accTxt)}
.assistant-out{min-height:120px}
.assistant-empty{color:var(--muted);padding:24px 8px;text-align:center}
.assistant-answer>p{margin:7px 0 10px;color:var(--muted);font-size:13px}
.assistant-note{font-size:11.5px!important}
.assistant-recs{display:grid;gap:7px;margin-top:10px}
.assistant-rec{display:flex;align-items:center;gap:9px;width:100%;text-align:left;border:1px solid var(--line);background:var(--panel2);color:var(--txt);border-radius:11px;padding:9px 10px;cursor:pointer}
.assistant-rec:hover{border-color:var(--acc)}
.assistant-rec .ico{width:31px;height:31px;border-radius:9px;display:grid;place-items:center;flex:none}
.assistant-rec span{min-width:0;flex:1}
.assistant-rec b{display:block;font-size:13.5px}
.assistant-rec small{display:block;color:var(--muted);font-size:11.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.assistant-rec em{font-style:normal;font-size:12px;white-space:nowrap;color:var(--accTxt)}
@media (max-width:640px){.assistant-input{flex-direction:column}.assistant-rec{align-items:flex-start}.assistant-rec em{font-size:11px}}
'''

HTML.write_text(html, encoding="utf-8")
JS.write_text(js, encoding="utf-8")
CSS.write_text(css, encoding="utf-8")

assert 'id="assistantBtn"' in html
assert 'async function flowLocalAssistant()' in js
assert 'function assistantAnswer(query)' in js
assert 'Работает локально' in js
assert '$("#assistantBtn").addEventListener' in js
assert '.assistant-ui{' in css
print("Local assistant upgrade applied")
