from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML = ROOT / "ai-platforms.html"
CSS = ROOT / "assets" / "app.css"
JS = ROOT / "assets" / "app.js"

html = HTML.read_text(encoding="utf-8")
css = CSS.read_text(encoding="utf-8")
js = JS.read_text(encoding="utf-8")


def replace_once(text, old, new, label):
    count = text.count(old)
    assert count == 1, f"{label}: expected exactly one match, got {count}"
    return text.replace(old, new, 1)

# 1) Dashboard mount point.
html = replace_once(
    html,
    '  <div class="stats" id="stats"></div>\n  <div class="filters" id="filters"></div>',
    '  <div class="stats" id="stats"></div>\n  <section class="attention" id="attention" hidden></section>\n  <div class="filters" id="filters"></div>',
    "attention mount"
)

# 2) Dashboard styles.
css_anchor = '/* ---------- filters ---------- */'
attention_css = '''/* ---------- attention dashboard ---------- */
.attention{background:var(--panel);border:1px solid var(--line);border-radius:var(--r);padding:14px;margin-bottom:16px}
.attention-head{display:flex;align-items:flex-end;gap:12px;justify-content:space-between;margin-bottom:10px}
.attention-head h2{font-size:15px;letter-spacing:-.2px}
.attention-head p{margin:2px 0 0;color:var(--muted);font-size:12.5px}
.attention-list{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:9px}
.attention-item{border:1px solid var(--line);border-radius:11px;padding:10px 11px;background:var(--panel2);display:flex;gap:9px;align-items:flex-start;cursor:pointer;text-align:left;width:100%}
.attention-item:hover{border-color:var(--acc)}
.attention-icon{font-size:16px;line-height:1.2;flex:none}
.attention-item b{display:block;font-size:13.5px;margin-bottom:2px}
.attention-item span{display:block;color:var(--muted);font-size:12.5px;line-height:1.35}
.attention-item .money{color:var(--txt);display:inline;font-size:12.5px}

'''
assert css_anchor in css
css = css.replace(css_anchor, attention_css + css_anchor, 1)

# 3) Usage enum and backward-compatible data model.
js = replace_once(
    js,
    'const PERIODS = ["месяц","год","разово"];',
    'const PERIODS = ["месяц","год","разово"];\nconst USAGE_OPTIONS = ["", "Ежедневно", "Еженедельно", "Редко", "Не использую"];',
    "usage enum"
)
js = replace_once(
    js,
    '    rating: 0, pinned: false, tags: [], secret: null,\n',
    '    rating: 0, usage: "", pinned: false, tags: [], secret: null,\n',
    "blank usage"
)
js = replace_once(
    js,
    '  o.rating = Number(o.rating) || 0;\n  o.pinned = !!o.pinned;',
    '  o.rating = Number(o.rating) || 0;\n  o.usage = USAGE_OPTIONS.includes(o.usage) ? o.usage : "";\n  o.pinned = !!o.pinned;',
    "normalize usage"
)

# Include usage in search.
js = replace_once(
    js,
    '    p.tips.join(" "), p.tags.join(" "), p.account.login, p.plan.tier, payLabel(p), p.url].join(" ").toLowerCase();',
    '    p.tips.join(" "), p.tags.join(" "), p.usage, p.account.login, p.plan.tier, payLabel(p), p.url].join(" ").toLowerCase();',
    "search usage"
)

# 4) Attention calculations and renderer.
render_anchor = 'function renderFilters() {'
attention_js = '''function daysUntil(date) {
  if (!date) return null;
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const d = new Date(date); d.setHours(0, 0, 0, 0);
  return Math.round((d - now) / 86400000);
}

function attentionItems() {
  const items = [];
  state.platforms.forEach(p => {
    if (p.status === "Пробный период") {
      items.push({ priority: 1, icon: "⏳", p: p, text: "Пробный период — проверьте условия и дату окончания" });
    }

    const d = nextCharge(p);
    const left = daysUntil(d);
    if (d && left != null && left >= 0 && left <= 7) {
      const when = left === 0 ? "сегодня" : left === 1 ? "завтра" : "через " + left + " дн.";
      items.push({ priority: 0, icon: "💳", p: p, text: "Списание " + when + (priceLabel(p) ? " · " + priceLabel(p) : "") });
    }

    const cost = monthlyCost(p);
    if (cost && p.usage === "Не использую") {
      items.push({ priority: 0, icon: "⚠", p: p, text: "Платная подписка не используется · " + priceLabel(p) });
    } else if (cost && p.usage === "Редко") {
      items.push({ priority: 2, icon: "↘", p: p, text: "Используется редко · проверьте, стоит ли продлевать" });
    }
  });
  items.sort((a, b) => a.priority - b.priority || a.p.name.localeCompare(b.p.name, "ru"));
  return items.slice(0, 8);
}

function renderAttention() {
  const box = $("#attention");
  const items = attentionItems();
  box.hidden = !items.length;
  if (!items.length) { box.innerHTML = ""; return; }
  box.innerHTML =
    "<div class='attention-head'><div><h2>Требуют внимания</h2>" +
    "<p>Списания, пробные периоды и подписки с низким использованием</p></div>" +
    "<span class='badge acc'>" + items.length + "</span></div>" +
    "<div class='attention-list'>" + items.map(x =>
      "<button class='attention-item' type='button' data-attention='" + esc(x.p.id) + "'>" +
        "<span class='attention-icon'>" + x.icon + "</span><span><b>" + esc(x.p.name) + "</b>" +
        "<span>" + esc(x.text) + "</span></span></button>"
    ).join("") + "</div>";
}

'''
assert render_anchor in js
js = js.replace(render_anchor, attention_js + render_anchor, 1)

# Render attention with the rest of dashboard.
js = replace_once(
    js,
    'function render() { renderStats(); renderFilters(); renderGrid(); renderLock(); renderBanners(); }',
    'function render() { renderStats(); renderAttention(); renderFilters(); renderGrid(); renderLock(); renderBanners(); }',
    "render attention"
)

# 5) Display usage in card metadata.
js = replace_once(
    js,
    '  if (p.checkedAt) kv.push(["Цены проверял", fmtDate(p.checkedAt)]);\n  if (p.tags.length) kv.push(["Теги", p.tags.join(", ")]);',
    '  if (p.usage) kv.push(["Использование", p.usage]);\n  if (p.checkedAt) kv.push(["Цены проверял", fmtDate(p.checkedAt)]);\n  if (p.tags.length) kv.push(["Теги", p.tags.join(", ")]);',
    "card usage"
)

# 6) Edit form usage selector.
js = replace_once(
    js,
    '    "<div class=\'f\'><label>Моя оценка</label><select id=\'fRating\'>" +',
    '    "<div class=\'f\'><label>Частота использования</label><select id=\'fUsage\'>" +\n      [["", "не указано"], ["Ежедневно", "ежедневно"], ["Еженедельно", "еженедельно"], ["Редко", "редко"], ["Не использую", "не использую"]].map(o =>\n        "<option value=\'" + o[0] + "\'" + (p.usage === o[0] ? " selected" : "") + ">" + o[1] + "</option>").join("") + "</select></div>" +\n    "<div class=\'f\'><label>Моя оценка</label><select id=\'fRating\'>" +',
    "form usage"
)

# 7) Save usage value.
js = replace_once(
    js,
    '  p.rating = Number($("#fRating").value) || 0;\n  p.pinned = $("#fPin").checked;',
    '  p.usage = $("#fUsage").value;\n  p.rating = Number($("#fRating").value) || 0;\n  p.pinned = $("#fPin").checked;',
    "save usage"
)

# 8) Attention click-through.
events_anchor = '$("#filters").addEventListener("click", e => {'
attention_event = '''$("#attention").addEventListener("click", e => {
  const item = e.target.closest("[data-attention]");
  if (!item) return;
  $("#cardOv").dataset.mode = "view";
  openCard(item.dataset.attention);
});

'''
assert events_anchor in js
js = js.replace(events_anchor, attention_event + events_anchor, 1)

HTML.write_text(html, encoding="utf-8")
CSS.write_text(css, encoding="utf-8")
JS.write_text(js, encoding="utf-8")

# Structural validation.
result_html = HTML.read_text(encoding="utf-8")
result_js = JS.read_text(encoding="utf-8")
assert 'id="attention"' in result_html
assert 'const USAGE_OPTIONS' in result_js
assert 'function renderAttention()' in result_js
assert 'id=\'fUsage\'' in result_js
assert 'p.usage = $("#fUsage").value' in result_js
print("Dashboard attention + usage upgrade applied successfully")
