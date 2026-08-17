from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML = ROOT / "ai-platforms.html"
JS = ROOT / "assets" / "app.js"
CSS = ROOT / "assets" / "app.css"

html = HTML.read_text(encoding="utf-8")
js = JS.read_text(encoding="utf-8")
css = CSS.read_text(encoding="utf-8")

# Topbar action.
if 'id="compareBtn"' not in html:
    marker = '    <button class="btn primary" id="addBtn" type="button">+ Платформа</button>\n'
    assert marker in html, "add button marker not found"
    html = html.replace(marker, '    <button class="btn" id="compareBtn" type="button">⇄ Сравнить</button>\n' + marker, 1)

# Comparison helpers before renderFilters.
if 'async function flowComparePlatforms()' not in js:
    marker = '\nfunction renderFilters() {'
    assert marker in js, "renderFilters marker not found"
    insert = r'''
function compareField(label, values) {
  return "<tr><th>" + esc(label) + "</th>" + values.map(v => "<td>" + v + "</td>").join("") + "</tr>";
}

function compareTable(platforms) {
  const heads = platforms.map(p => "<th><div class='compare-name'>" + iconHTML(p) + "<span>" + esc(p.name) + "</span></div></th>").join("");
  const price = platforms.map(p => esc(priceLabel(p) || (p.status === "Активна" ? "бесплатно" : "—")));
  const rating = platforms.map(p => p.rating ? "<span class='stars'>" + "★".repeat(p.rating) + "</span>" : "—");
  const usage = platforms.map(p => esc(p.usage || "не указано"));
  const value = platforms.map(p => esc(valueVerdict(p)));
  const category = platforms.map(p => esc(p.category || "—"));
  const status = platforms.map(p => "<span class='badge " + (STATUS_CLASS[p.status] || "") + "'>" + esc(p.status) + "</span>");
  const strengths = platforms.map(p => "<div class='compare-text'>" + esc(p.strengths || "—") + "</div>");
  const purpose = platforms.map(p => "<div class='compare-text'>" + esc(p.purpose || "—") + "</div>");

  return "<div class='compare-table-wrap'><table class='compare-table'><thead><tr><th>Параметр</th>" + heads + "</tr></thead><tbody>" +
    compareField("Категория", category) +
    compareField("Статус", status) +
    compareField("Цена", price) +
    compareField("Рейтинг", rating) +
    compareField("Использование", usage) +
    compareField("Ценность", value) +
    compareField("Назначение", purpose) +
    compareField("Сильные стороны", strengths) +
    "</tbody></table></div>";
}

async function flowComparePlatforms() {
  const candidates = state.platforms
    .filter(p => p.category !== PAY_CAT)
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name, "ru"));

  if (candidates.length < 2) {
    toast("Для сравнения нужно минимум две платформы");
    return;
  }

  const picker = "<div class='compare-picker'><p>Выберите от 2 до 4 платформ.</p><div class='compare-options'>" +
    candidates.map(p => "<label class='compare-option'><input type='checkbox' name='cmp' value='" + esc(p.id) + "'>" +
      iconHTML(p) + "<span><b>" + esc(p.name) + "</b><small>" + esc(p.category) + " · " + esc(p.status) + "</small></span></label>").join("") +
    "</div></div>";

  const ids = await modal({
    title: "Сравнить AI-сервисы",
    sub: "Цена, использование, рейтинг и ценность",
    body: picker,
    buttons: [{ label: "Отмена", value: null }, { spacer: true }, {
      label: "Сравнить", variant: "primary",
      validate: () => {
        const n = document.querySelectorAll("input[name='cmp']:checked").length;
        if (n < 2) return "Выберите минимум две платформы.";
        if (n > 4) return "Можно сравнить максимум четыре платформы.";
        return null;
      },
      value: () => Array.from(document.querySelectorAll("input[name='cmp']:checked")).map(x => x.value)
    }]
  });
  if (!ids) return;

  const platforms = ids.map(id => state.platforms.find(p => p.id === id)).filter(Boolean);
  await modal({
    title: "Сравнение платформ",
    sub: platforms.map(p => p.name).join(" · "),
    body: "<div class='compare-result'>" + compareTable(platforms) + "</div>",
    buttons: [{ label: "Закрыть", value: null }]
  });
}
'''
    js = js.replace(marker, '\n' + insert + marker, 1)

# Wire button near existing add button listener.
if '$("#compareBtn").addEventListener' not in js:
    marker = '$("#addBtn").addEventListener("click", () => editCard(null));'
    assert marker in js, "addBtn listener marker not found"
    js = js.replace(marker, '$("#compareBtn").addEventListener("click", flowComparePlatforms);\n' + marker, 1)

if '.compare-table-wrap{' not in css:
    css += r'''

/* ---------- platform comparison ---------- */
.sheet.narrow:has(.compare-picker),.sheet.narrow:has(.compare-result){max-width:980px}
.compare-picker>p{margin:0 0 10px;color:var(--muted);font-size:13px}
.compare-options{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:8px;max-height:55vh;overflow:auto}
.compare-option{display:flex;align-items:center;gap:9px;border:1px solid var(--line);background:var(--panel2);border-radius:11px;padding:9px 10px;cursor:pointer}
.compare-option:hover{border-color:var(--acc)}
.compare-option input{width:auto;flex:none}
.compare-option .ico{width:30px;height:30px;border-radius:8px;display:grid;place-items:center;flex:none}
.compare-option span{min-width:0}
.compare-option b{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13.5px}
.compare-option small{display:block;color:var(--muted);font-size:11.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.compare-table-wrap{overflow:auto;border:1px solid var(--line);border-radius:12px}
.compare-table{width:100%;min-width:720px;border-collapse:collapse;font-size:12.5px}
.compare-table th,.compare-table td{padding:10px 11px;border-right:1px solid var(--line);border-bottom:1px solid var(--line);vertical-align:top;text-align:left}
.compare-table th:last-child,.compare-table td:last-child{border-right:0}
.compare-table tbody tr:last-child th,.compare-table tbody tr:last-child td{border-bottom:0}
.compare-table thead th{background:var(--panel2);position:sticky;top:0;z-index:1}
.compare-table tbody th{width:130px;color:var(--muted);background:var(--panel2);font-weight:600}
.compare-name{display:flex;align-items:center;gap:8px;min-width:135px}
.compare-name .ico{width:28px;height:28px;border-radius:8px;display:grid;place-items:center;flex:none}
.compare-text{white-space:pre-wrap;min-width:160px}
@media (max-width:640px){.compare-options{grid-template-columns:1fr}}
'''

HTML.write_text(html, encoding="utf-8")
JS.write_text(js, encoding="utf-8")
CSS.write_text(css, encoding="utf-8")

assert 'id="compareBtn"' in html
assert 'async function flowComparePlatforms()' in js
assert 'function compareTable(platforms)' in js
assert '$("#compareBtn").addEventListener' in js
assert 'максимум четыре платформы' in js
assert '.compare-table-wrap{' in css
print("Platform comparison upgrade applied")
