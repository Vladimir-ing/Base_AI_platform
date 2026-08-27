"use strict";
/* Тест ремонта каталога на реальном коде app.js (addMissingSeed/normalize/SEED) */
const fs = require("fs");
const src = fs.readFileSync("C:/Users/PC/Desktop/AI_CORE/assets/app.js", "utf8");

function extract(name) {
  const start = src.indexOf("function " + name + "(");
  if (start < 0) throw new Error("not found: " + name);
  let i = src.indexOf("{", start), depth = 0, end = i;
  for (; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") { depth--; if (depth === 0) { end = i; break; } }
  }
  return src.slice(start, end + 1);
}

const SEED_START = src.indexOf("const SEED = [");
const SEED_END = src.indexOf("\n];", SEED_START) + 3;
const seedCode = src.slice(SEED_START, SEED_END);

let uidN = 0;
const uid = () => "id-" + (++uidN);
const todayISO = () => "2026-08-27";
const safeEntityId = (v, def) => v || def;
const safeExternalUrl = u => u;
const USAGE_OPTIONS = ["", "Ежедневно", "Еженедельно", "Редко", "Не использую"];
const CATS = [["Обучение","🎓"],["Текст/ассистенты","💬"],["Код","⌨️"],["Изображения","🖼️"],["Видео","🎬"],["Аудио","🔊"],["Дизайн и презентации","🎨"],["Автоматизация","⚙️"],["Оплата","💳"],["Прочее","📦"]];
const STATUSES = ["Не зарегистрирован","Активна","Пробный период","Отменена","Заблокирована"];

let lastToast = "";
const state = { platforms: [], payServices: [] };

const sandbox = new Function(
  "state", "save", "render", "toast",
  "uid", "todayISO", "safeEntityId", "safeExternalUrl", "USAGE_OPTIONS", "CATS", "STATUSES", "AUTH_METHODS", "CURRENCIES", "PERIODS",
  seedCode + "\n" + extract("blank") + "\n" + extract("normalize") + "\n" + extract("addMissingSeed") +
  "\nreturn { SEED: SEED, addMissingSeed: addMissingSeed };"
);
const api = sandbox(state, () => {}, () => {}, t => { lastToast = t; }, uid, todayISO, safeEntityId, safeExternalUrl, USAGE_OPTIONS, CATS, STATUSES, ["","Google","Email + пароль","Телефон","Apple ID","SSO / корпоративный"], ["₽","$","€"], ["месяц","год","разово"]);

/* сценарий: испорченные переводчиком записи при целых URL + своя платформа */
const seedPx = api.SEED.find(s => s.name === "Perplexity");
const seedComfy = api.SEED.find(s => s.name === "ComfyUI");
state.platforms = [
  Object.assign({}, JSON.parse(JSON.stringify(seedPx)), { name: "Замешательство", purpose: "Поисковик ассистент (машина-перевод).", plan: { tier: "Pro", price: 20, currency: "$", period: "месяц" }, status: "Активна", myNote: "персональная заметка" }),
  Object.assign({}, JSON.parse(JSON.stringify(seedComfy)), { name: "Удобный пользовательский интерфейс", purpose: "мусор" }),
  { name: "Моя фирменная платформа", url: "https://example.com/", category: "Прочее", purpose: "своё", tags: [] }
];

api.addMissingSeed();

const px = state.platforms.find(p => p.name === "Perplexity");
const comfy = state.platforms.find(p => p.name === "ComfyUI");
const mine = state.platforms.find(p => p.name === "Моя фирменная платформа");
const dupePx = state.platforms.filter(p => p.url === seedPx.url).length;
const dupeComfy = state.platforms.filter(p => p.url === seedComfy.url).length;

const results = [
  ["toast", lastToast],
  ["total", state.platforms.length + " (ожидание 34)"],
  ["Perplexity восстановлен по URL", !!px],
  ["  purpose из сида", px && px.purpose === seedPx.purpose],
  ["  цена/status/заметка сохранены", px && px.plan.price === 20 && px.plan.currency === "$" && px.status === "Активна" && px.myNote === "персональная заметка"],
  ["ComfyUI восстановлен по URL", !!comfy && comfy.purpose === seedComfy.purpose],
  ["своя платформа нетронута", !!mine && mine.purpose === "своё"],
  ["дубликатов нет (по URL)", dupePx === 1 && dupeComfy === 1],
  ["испорченных имён не осталось", !state.platforms.some(p => p.name === "Замешательство" || p.name === "Удобный пользовательский интерфейс")]
];
results.forEach(r => console.log(r[0] + ":", r[1]));
const failed = results.filter(r => r[1] === false);
console.log(failed.length ? "FAIL: " + failed.map(f => f[0]).join(", ") : "ALL OK");
