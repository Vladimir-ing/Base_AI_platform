from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
JS = ROOT / "assets" / "app.js"
CSS = ROOT / "assets" / "app.css"
HTML = ROOT / "ai-platforms.html"

js = JS.read_text(encoding="utf-8")
css = CSS.read_text(encoding="utf-8")
html = HTML.read_text(encoding="utf-8")

if 'id="economics"' not in html:
    marker = '<div id="attention" hidden></div>\n'
    assert marker in html, "attention marker not found"
    html = html.replace(marker, marker + '  <div id="economics" hidden></div>\n', 1)

if 'function subscriptionEconomics()' not in js:
    marker = '\nfunction renderFilters() {'
    assert marker in js, "renderFilters marker not found"
    insert = r'''
function subscriptionEconomics() {
  const candidates = state.platforms
    .map(p => ({ p: p, monthly: monthlyCost(p) }))
    .filter(x => x.monthly > 0 && (x.p.usage === "Редко" || x.p.usage === "Не использую"))
    .sort((a, b) => b.monthly - a.monthly || a.p.name.localeCompare(b.p.name, "ru"));

  const byCur = {};
  candidates.forEach(x => {
    const c = x.p.plan.currency || "₽";
    byCur[c] = (byCur[c] || 0) + x.monthly;
  });
  const saving = Object.keys(byCur).length
    ? Object.keys(byCur).map(c => fmtMoney(byCur[c], c)).join(" + ")
    : "0 ₽";

  return { candidates: candidates, saving: saving };
}

function valueVerdict(p) {
  if (!monthlyCost(p)) return p.status === "Активна" ? "Бесплатный" : "—";
  if (p.usage === "Ежедневно") return "Стоит своих денег";
  if (p.usage === "Еженедельно") return "Скорее стоит";
  if (p.usage === "Редко") return "Под вопросом";
  if (p.usage === "Не использую") return "Кандидат на отмену";
  return "Нет данных об использовании";
}

function renderEconomics() {
  const box = $("#economics");
  const e = subscriptionEconomics();
  box.hidden = !e.candidates.length;
  if (!e.candidates.length) { box.innerHTML = ""; return; }

  box.innerHTML =
    "<div class='economics-head'><div><h2>Экономика подписок</h2>" +
      "<p>Платные сервисы, которые используются редко или не используются</p></div>" +
      "<div class='saving'><span>Потенциальная экономия</span><b>" + esc(e.saving) + "/мес</b></div></div>" +
    "<div class='economics-list'>" + e.candidates.slice(0, 8).map(x =>
      "<button class='economics-row' type='button' data-economics='" + esc(x.p.id) + "'>" +
        "<span><b>" + esc(x.p.name) + "</b><small>" + esc(x.p.usage || "не указано") + " · " +
          esc(valueVerdict(x.p)) + "</small></span>" +
        "<strong>" + esc(priceLabel(x.p) || fmtMoney(x.monthly, x.p.plan.currency)) + "</strong>" +
      "</button>"
    ).join("") + "</div>";
}
'''
    js = js.replace(marker, '\n' + insert + marker, 1)

old = 'function render() { renderStats(); renderAttention(); renderFilters(); renderGrid(); renderLock(); renderBanners(); }'
new = 'function render() { renderStats(); renderAttention(); renderEconomics(); renderFilters(); renderGrid(); renderLock(); renderBanners(); }'
if old in js:
    js = js.replace(old, new, 1)
else:
    assert new in js, "render() signature not found"

if 'Ценность подписки' not in js:
    marker = '  if (p.usage) kv.push(["Использование", p.usage]);\n'
    assert marker in js, "usage kv marker not found"
    js = js.replace(marker, marker + '  if (monthlyCost(p)) kv.push(["Ценность подписки", valueVerdict(p)]);\n', 1)

if '$("#economics").addEventListener' not in js:
    marker = '$("#attention").addEventListener("click", e => {'
    assert marker in js, "attention click marker not found"
    idx = js.index(marker)
    end = js.index('});', idx) + 3
    extra = '\n$("#economics").addEventListener("click", e => {\n  const row = e.target.closest("[data-economics]");\n  if (row) openCard(row.dataset.economics);\n});'
    js = js[:end] + extra + js[end:]

if '.economics-head{' not in css:
    css += r'''

/* ---------- subscription economics ---------- */
#economics{margin-bottom:16px;background:var(--panel);border:1px solid var(--line);border-radius:var(--r);padding:14px}
.economics-head{display:flex;gap:14px;justify-content:space-between;align-items:flex-start;margin-bottom:10px;flex-wrap:wrap}
.economics-head h2{font-size:16px}
.economics-head p{margin:3px 0 0;color:var(--muted);font-size:12.5px}
.saving{text-align:right}
.saving span{display:block;font-size:11.5px;color:var(--muted)}
.saving b{font-size:18px}
.economics-list{display:grid;gap:7px}
.economics-row{display:flex;justify-content:space-between;gap:12px;align-items:center;width:100%;text-align:left;border:1px solid var(--line);background:var(--panel2);border-radius:11px;padding:10px 12px;cursor:pointer}
.economics-row:hover{border-color:var(--acc)}
.economics-row span{min-width:0}
.economics-row b{display:block;font-size:14px}
.economics-row small{display:block;margin-top:2px;color:var(--muted);font-size:12px}
.economics-row strong{white-space:nowrap;font-size:13px}
@media (max-width:640px){.saving{text-align:left}.economics-row{align-items:flex-start}.economics-row strong{font-size:12px}}
'''

HTML.write_text(html, encoding="utf-8")
JS.write_text(js, encoding="utf-8")
CSS.write_text(css, encoding="utf-8")

assert 'id="economics"' in html
assert 'function subscriptionEconomics()' in js
assert 'function valueVerdict(p)' in js
assert 'function renderEconomics()' in js
assert 'renderEconomics();' in js
assert 'Ценность подписки' in js
assert 'data-economics' in js
assert '.economics-head{' in css
print("Subscription economics upgrade applied")
