from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML = ROOT / "ai-platforms.html"
JS = ROOT / "assets" / "app.js"
CSS = ROOT / "assets" / "app.css"

html = HTML.read_text(encoding="utf-8")
js = JS.read_text(encoding="utf-8")
css = CSS.read_text(encoding="utf-8")

# --- Brand + static i18n hooks in HTML ---
html = html.replace('<title>База AI-платформ</title>', '<title>AI CORE — Your AI Control Center</title>')
html = html.replace(
    '<div class="logo">◆</div>\n      <div>\n        <h1>База AI-платформ</h1>\n        <p id="brandSub">личный справочник доступов и приёмов</p>\n      </div>',
    '<div class="logo core-logo" aria-hidden="true"><span></span></div>\n      <div>\n        <h1><span class="brand-ai">AI</span> CORE</h1>\n        <p id="brandSub" data-i18n="brand.subtitle">Your AI Control Center</p>\n      </div>'
)
html = html.replace(
    '<div class="search"><span>⌕</span><input id="q" type="search" placeholder="Поиск: название, задача, приём…" autocomplete="off"></div>',
    '<div class="search"><span>⌕</span><input id="q" type="search" placeholder="Поиск: название, задача, приём…" data-i18n-placeholder="search.placeholder" autocomplete="off"></div>'
)

lang_switch = '''    <div class="lang-switch" id="langSwitch" role="group" aria-label="Language">
      <button type="button" data-lang="ru">RU</button>
      <button type="button" data-lang="en">EN</button>
    </div>\n'''
if 'id="langSwitch"' not in html:
    marker = '    <button class="lockchip" id="lockChip" type="button"></button>\n'
    assert marker in html, "lock chip marker not found"
    html = html.replace(marker, lang_switch + marker, 1)

replacements = {
    '<button class="btn" id="assistantBtn" type="button">✦ Помощник</button>': '<button class="btn" id="assistantBtn" type="button" data-i18n="top.assistant">✦ Помощник</button>',
    '<button class="btn" id="compareBtn" type="button">⇄ Сравнить</button>': '<button class="btn" id="compareBtn" type="button" data-i18n="top.compare">⇄ Сравнить</button>',
    '<button class="btn primary" id="addBtn" type="button">+ Платформа</button>': '<button class="btn primary" id="addBtn" type="button" data-i18n="top.add">+ Платформа</button>',
    '<summary class="btn ghost" title="Меню">⋯</summary>': '<summary class="btn ghost" title="Меню" data-i18n-title="top.menuTitle">⋯</summary>',
    '<button type="button" data-act="export">Экспорт бэкапа (с секретами)</button>': '<button type="button" data-act="export" data-i18n="menu.exportSecure">Экспорт бэкапа (с секретами)</button>',
    '<button type="button" data-act="exportOpen">Экспорт без доступов</button>': '<button type="button" data-act="exportOpen" data-i18n="menu.exportOpen">Экспорт без доступов</button>',
    '<button type="button" data-act="import">Импорт из файла…</button>': '<button type="button" data-act="import" data-i18n="menu.import">Импорт из файла…</button>',
    '<button type="button" data-act="payments">Оплата: сервисы и карты…</button>': '<button type="button" data-act="payments" data-i18n="menu.payments">Оплата: сервисы и карты…</button>',
    '<button type="button" data-act="master">Мастер-пароль…</button>': '<button type="button" data-act="master" data-i18n="menu.master">Мастер-пароль…</button>',
    '<button type="button" data-act="seed">Досыпать каталог платформ</button>': '<button type="button" data-act="seed" data-i18n="menu.seed">Досыпать каталог платформ</button>',
    '<button type="button" data-act="theme">Сменить тему</button>': '<button type="button" data-act="theme" data-i18n="menu.theme">Сменить тему</button>',
    '<button type="button" data-act="help">Как это работает</button>': '<button type="button" data-act="help" data-i18n="menu.help">Как это работает</button>',
    '<div class="empty" id="empty" hidden>Ничего не найдено. Сбросьте поиск или фильтры.</div>': '<div class="empty" id="empty" hidden data-i18n="empty.search">Ничего не найдено. Сбросьте поиск или фильтры.</div>',
}
for old, new in replacements.items():
    html = html.replace(old, new)

# --- Lightweight i18n foundation in JS ---
if 'const LANGUAGE_KEY = "ai-core-lang-v1";' not in js:
    marker = 'const EXPORT_REMIND_DAYS = 14;\n'
    assert marker in js, "constants marker not found"
    i18n = r'''
const LANGUAGE_KEY = "ai-core-lang-v1";
const I18N = {
  ru: {
    "brand.subtitle":"Ваш персональный центр управления AI-инструментами",
    "search.placeholder":"Поиск: название, задача, приём…",
    "top.assistant":"✦ Помощник",
    "top.compare":"⇄ Сравнить",
    "top.add":"+ Платформа",
    "top.menuTitle":"Меню",
    "menu.exportSecure":"Экспорт бэкапа (с секретами)",
    "menu.exportOpen":"Экспорт без доступов",
    "menu.import":"Импорт из файла…",
    "menu.payments":"Оплата: сервисы и карты…",
    "menu.master":"Мастер-пароль…",
    "menu.seed":"Досыпать каталог платформ",
    "menu.theme":"Сменить тему",
    "menu.help":"Как это работает",
    "empty.search":"Ничего не найдено. Сбросьте поиск или фильтры."
  },
  en: {
    "brand.subtitle":"Your AI Control Center",
    "search.placeholder":"Search: platform, task, workflow…",
    "top.assistant":"✦ Assistant",
    "top.compare":"⇄ Compare",
    "top.add":"+ Platform",
    "top.menuTitle":"Menu",
    "menu.exportSecure":"Export backup (with secrets)",
    "menu.exportOpen":"Export without credentials",
    "menu.import":"Import from file…",
    "menu.payments":"Payments: services & cards…",
    "menu.master":"Master password…",
    "menu.seed":"Add platform catalog",
    "menu.theme":"Switch theme",
    "menu.help":"How it works",
    "empty.search":"Nothing found. Clear search or filters."
  }
};

function detectLanguage() {
  const saved = localStorage.getItem(LANGUAGE_KEY);
  if (saved === "ru" || saved === "en") return saved;
  return (navigator.language || "ru").toLowerCase().startsWith("en") ? "en" : "ru";
}
let uiLanguage = detectLanguage();

function tr(key) {
  return I18N[uiLanguage]?.[key] ?? I18N.ru[key] ?? key;
}

function applyLanguage(lang) {
  if (lang === "ru" || lang === "en") uiLanguage = lang;
  localStorage.setItem(LANGUAGE_KEY, uiLanguage);
  document.documentElement.lang = uiLanguage;
  document.title = uiLanguage === "en" ? "AI CORE — Your AI Control Center" : "AI CORE — Ваш центр управления AI";
  document.querySelectorAll("[data-i18n]").forEach(el => { el.textContent = tr(el.dataset.i18n); });
  document.querySelectorAll("[data-i18n-placeholder]").forEach(el => { el.placeholder = tr(el.dataset.i18nPlaceholder); });
  document.querySelectorAll("[data-i18n-title]").forEach(el => { el.title = tr(el.dataset.i18nTitle); });
  document.querySelectorAll("#langSwitch [data-lang]").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.lang === uiLanguage);
    btn.setAttribute("aria-pressed", btn.dataset.lang === uiLanguage ? "true" : "false");
  });
}

document.addEventListener("click", e => {
  const btn = e.target.closest("#langSwitch [data-lang]");
  if (!btn) return;
  applyLanguage(btn.dataset.lang);
});
'''
    js = js.replace(marker, marker + '\n' + i18n + '\n', 1)

if 'applyLanguage(uiLanguage);' not in js:
    js += '\n// Apply persisted/browser language after the full DOM has loaded.\napplyLanguage(uiLanguage);\n'

# --- Neon brand foundation + language switch styling ---
if '.core-logo{' not in css:
    css += r'''

/* ---------- AI CORE brand foundation ---------- */
.brand h1{letter-spacing:.055em}
.brand-ai{background:linear-gradient(90deg,#2ef2ff,#7a5cff,#ff4fd8);-webkit-background-clip:text;background-clip:text;color:transparent}
.core-logo{position:relative;overflow:visible;background:transparent!important;border:1px solid rgba(46,242,255,.32);box-shadow:0 0 22px rgba(46,242,255,.12),inset 0 0 15px rgba(122,92,255,.12)}
.core-logo:before,.core-logo:after{content:"";position:absolute;inset:-3px;border-radius:inherit;border:1px solid transparent;background:linear-gradient(120deg,#2ef2ff,#7a5cff,#ff4fd8,#2ef2ff) border-box;-webkit-mask:linear-gradient(#000 0 0) padding-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask-composite:exclude;animation:coreSpin 9s linear infinite}
.core-logo:after{inset:7px;background:none;border:0;box-shadow:0 0 16px #2ef2ff,0 0 26px rgba(255,79,216,.45);animation:corePulse 3.2s ease-in-out infinite}
.core-logo span{position:absolute;inset:11px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#fff 0,#2ef2ff 12%,#7a5cff 45%,#120b34 72%);box-shadow:0 0 18px rgba(46,242,255,.75),0 0 34px rgba(122,92,255,.38)}
.lang-switch{display:flex;align-items:center;padding:3px;border:1px solid var(--line);border-radius:999px;background:var(--panel2);gap:2px}
.lang-switch button{border:0;background:transparent;color:var(--muted);font:700 11px/1 system-ui,sans-serif;padding:6px 7px;border-radius:999px;cursor:pointer;letter-spacing:.05em}
.lang-switch button.active{color:var(--txt);background:linear-gradient(120deg,rgba(46,242,255,.16),rgba(122,92,255,.19),rgba(255,79,216,.14));box-shadow:inset 0 0 0 1px rgba(46,242,255,.22),0 0 12px rgba(122,92,255,.14)}
@keyframes coreSpin{to{transform:rotate(360deg)}}
@keyframes corePulse{0%,100%{opacity:.45;transform:scale(.92)}50%{opacity:.95;transform:scale(1.05)}}
@media (prefers-reduced-motion:reduce){.core-logo:before,.core-logo:after{animation:none}}
@media (max-width:760px){.lang-switch{order:5}.brand h1{letter-spacing:.035em}}
'''

HTML.write_text(html, encoding="utf-8")
JS.write_text(js, encoding="utf-8")
CSS.write_text(css, encoding="utf-8")

assert '<span class="brand-ai">AI</span> CORE' in html
assert 'id="langSwitch"' in html
assert 'const LANGUAGE_KEY = "ai-core-lang-v1";' in js
assert 'function applyLanguage(lang)' in js
assert 'applyLanguage(uiLanguage);' in js
assert '.core-logo{' in css
print("AI CORE brand + i18n foundation applied")
