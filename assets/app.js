"use strict";

/* ==================================================================
   Константы
   ================================================================== */
const STORE_KEY = "ai-platforms-vault-v1";
const PBKDF2_ITER = 310000;
const AUTOLOCK_MS = 10 * 60 * 1000;   // автоблокировка сейфа
const REVEAL_MS   = 15 * 1000;        // сколько показывать пароль
const CLIP_MS     = 30 * 1000;        // когда чистить буфер обмена
const EXPORT_REMIND_DAYS = 14;

const CATS = [
  ["Обучение","🎓"], ["Текст/ассистенты","💬"], ["Код","⌨️"], ["Изображения","🖼️"],
  ["Видео","🎬"], ["Аудио","🔊"], ["Дизайн и презентации","🎨"], ["Автоматизация","⚙️"],
  ["Оплата","💳"], ["Прочее","📦"]
];
const PAY_CAT = "Оплата";
const CAT_ICON = Object.fromEntries(CATS);
const STATUSES = ["Не зарегистрирован","Активна","Пробный период","Отменена","Заблокирована"];
const STATUS_CLASS = {"Активна":"ok","Пробный период":"warn","Заблокирована":"bad","Отменена":"","Не зарегистрирован":""};
const AUTH_METHODS = ["","Google","Email + пароль","Телефон","Apple ID","SSO / корпоративный"];
const CURRENCIES = ["₽","$","€"];
const PERIODS = ["месяц","год","разово"];
const USAGE_OPTIONS = ["", "Ежедневно", "Еженедельно", "Редко", "Не использую"];

/* ==================================================================
   Фирменные иконки: цвет платформы + монограмма
   ================================================================== */
const BRAND = {
  "getcourse":"#F5622D", "claude":"#D97757", "claude code":"#C2603F", "chatgpt":"#10A37F",
  "google gemini":"#4285F4", "perplexity":"#20808D", "deepseek":"#4D6BFE", "grok":"#B9C0CC",
  "notebooklm":"#F9AB00", "cursor":"#7C8794", "github copilot":"#5B6270", "v0":"#4B5563",
  "midjourney":"#64748B", "recraft":"#FF4D4D", "ideogram":"#F0578A", "krea":"#14B8A6",
  "leonardo":"#7C3AED", "adobe firefly":"#FF8A3D", "comfyui":"#6D4AFF",
  "google flow":"#A142F4", "sora":"#CBD5E1", "kling":"#2563EB", "runway":"#22C55E",
  "heygen":"#D946EF", "elevenlabs":"#DDE3EC", "suno":"#FB923C",
  "figma":"#F24E1E", "canva":"#00C4CC", "gamma":"#A78BFA", "n8n":"#EA4B71", "make":"#8B31E0"
};
/* цвет для платформ, которых нет в списке — устойчиво выводится из названия */
function brandColor(name) {
  const key = nz(name).trim().toLowerCase();
  if (BRAND[key]) return BRAND[key];
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) % 360;
  return "hsl(" + h + " 58% 52%)";
}
/* контрастный текст: на светлой плашке — тёмные буквы */
function onColor(c) {
  if (c.charAt(0) !== "#") return "#fff";
  const v = c.length === 4
    ? [1, 2, 3].map(i => parseInt(c[i] + c[i], 16))
    : [1, 3, 5].map(i => parseInt(c.substr(i, 2), 16));
  const lum = (0.299 * v[0] + 0.587 * v[1] + 0.114 * v[2]) / 255;
  return lum > 0.68 ? "#151a23" : "#fff";
}
function initials(name) {
  const w = nz(name).trim().split(/[\s\-–—/]+/).filter(Boolean);
  if (!w.length) return "?";
  if (w.length > 1) return (w[0][0] + w[1][0]).toUpperCase();
  return w[0].length > 1
    ? w[0][0].toUpperCase() + w[0][1].toLowerCase()
    : w[0][0].toUpperCase();
}
function iconHTML(p, cls) {
  const c = brandColor(p.name);
  return "<span class='" + (cls || "ico") + " mono' style='background:" + c + ";color:" + onColor(c) +
    "' aria-hidden='true'>" + esc(initials(p.name)) + "</span>";
}
function paintIcon(el, p) {
  const c = brandColor(p.name);
  el.className = "ico mono";
  el.style.background = c;
  el.style.color = onColor(c);
  el.textContent = initials(p.name);
}

/* ==================================================================
   Мелкие утилиты
   ================================================================== */
const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const uid = () => "p" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const todayISO = () => new Date().toISOString().slice(0, 10);
const nz = v => (v == null ? "" : String(v));

function toast(msg, action) {
  const t = $("#toast");
  t.textContent = msg;
  if (action) {
    const b = document.createElement("button");
    b.type = "button"; b.className = "tbtn"; b.textContent = action.label;
    b.addEventListener("click", () => { t.classList.remove("show"); action.fn(); });
    t.appendChild(b);
  }
  t.classList.add("show");
  t.style.pointerEvents = action ? "auto" : "none";
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove("show"), action ? 12000 : 2600);
}
function fmtDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  return d.toLocaleDateString("ru-RU", { day: "2-digit", month: "long", year: "numeric" });
}
function fmtMoney(n, cur) {
  return Math.round(n).toLocaleString("ru-RU") + " " + (cur || "₽");
}
async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch (e) {
    const ta = document.createElement("textarea");
    ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select();
    try { document.execCommand("copy"); } catch (e2) { document.body.removeChild(ta); throw e2; }
    document.body.removeChild(ta);
  }
}
function copyAndClear(text, what) {
  copyText(text).then(() => {
    toast(what + " скопирован — буфер очистится через 30 сек");
    clearTimeout(copyAndClear._t);
    copyAndClear._t = setTimeout(() => { copyText("").catch(() => {}); }, CLIP_MS);
  }).catch(() => toast("Браузер не дал доступ к буферу обмена"));
}

/* ==================================================================
   Модель: пустая платформа + нормализация
   ================================================================== */
function blank() {
  return {
    id: uid(), name: "", url: "", urlLogin: "", urlBilling: "",
    category: "Прочее", status: "Не зарегистрирован",
    purpose: "", strengths: "", tips: [], regNotes: "", freeLimits: "",
    account: { login: "", authMethod: "", twoFactor: false, passwordRef: "" },
    plan: { tier: "", price: "", currency: "₽", period: "месяц", renewsOn: "", paymentId: "", paymentLabel: "" },
    rating: 0, usage: "", pinned: false, tags: [], secret: null,
    createdAt: todayISO(), updatedAt: todayISO(), checkedAt: ""
  };
}
function normalize(p) {
  const b = blank();
  const o = Object.assign(b, p || {});
  o.id = p && p.id ? p.id : b.id;
  o.account = Object.assign(b.account, (p && p.account) || {});
  o.plan = Object.assign(b.plan, (p && p.plan) || {});
  o.tips = Array.isArray(o.tips) ? o.tips.filter(Boolean) : (o.tips ? String(o.tips).split("\n").filter(Boolean) : []);
  o.tags = Array.isArray(o.tags) ? o.tags.filter(Boolean) : (o.tags ? String(o.tags).split(",").map(s => s.trim()).filter(Boolean) : []);
  o.rating = Number(o.rating) || 0;
  o.usage = USAGE_OPTIONS.includes(o.usage) ? o.usage : "";
  o.pinned = !!o.pinned;
  if (CATS.every(c => c[0] !== o.category)) o.category = "Прочее";
  if (!STATUSES.includes(o.status)) o.status = "Не зарегистрирован";
  if (o.secret && !(o.secret.iv && o.secret.ct)) o.secret = null;
  return o;
}

/* ==================================================================
   Способы оплаты — отдельный справочник: выбираем из списка,
   добавляем новые, удаляем потерявшие актуальность.
   ================================================================== */
function normPayment(x) {
  return {
    id: (x && x.id) || "pay" + Math.random().toString(36).slice(2, 9),
    name: nz(x && x.name).trim(),
    note: nz(x && x.note).trim(),
    currency: (x && CURRENCIES.includes(x.currency)) ? x.currency : "₽",
    createdAt: (x && x.createdAt) || todayISO()
  };
}
const payById = id => state.payments.find(x => x.id === id) || null;
const payByName = name => state.payments.find(x => x.name.toLowerCase() === nz(name).trim().toLowerCase()) || null;

function addPayment(name, note, currency) {
  const p = normPayment({ name: name, note: note, currency: currency });
  state.payments.push(p);
  return p;
}
/* Старое текстовое поле «Чем платим» превращаем в записи справочника */
function migratePayments() {
  let changed = false;
  state.platforms.forEach(p => {
    const legacy = nz(p.plan.paymentLabel).trim();
    if (!legacy || p.plan.paymentId) { if (legacy) { p.plan.paymentLabel = ""; changed = true; } return; }
    const found = payByName(legacy) || addPayment(legacy, "", p.plan.currency);
    p.plan.paymentId = found.id;
    p.plan.paymentLabel = "";
    changed = true;
  });
  // ссылки на удалённые способы и сервисы обнуляем
  state.platforms.forEach(p => {
    if (p.plan.paymentId && !payEntity(p.plan.paymentId)) { p.plan.paymentId = ""; changed = true; }
    if (p.plan.paymentId === p.id) { p.plan.paymentId = ""; changed = true; }
  });
  if (changed) save();
}
/* Сколько платформ и денег висит на способе оплаты */
function payUsage(id) {
  const list = state.platforms.filter(p => p.plan.paymentId === id);
  const byCur = {};
  list.forEach(p => { const m = monthlyCost(p); if (m) byCur[p.plan.currency || "₽"] = (byCur[p.plan.currency || "₽"] || 0) + m; });
  const money = Object.keys(byCur).map(c => fmtMoney(byCur[c], c)).join(" + ");
  return { count: list.length, money: money, platforms: list };
}
/* Платить можно двумя сущностями:
   — «сервис оплаты» — полноценная карточка каталога в категории «Оплата»
     (посредник, конвертация, виртуальные карты: у него свой сайт, логин, пароль, комиссия);
   — «карта или счёт» — простая метка из справочника state.payments.
   plan.paymentId хранит id того или другого, payEntity разбирается, что это. */
const payServices = exceptId => state.platforms.filter(p => p.category === PAY_CAT && p.id !== exceptId);

function payEntity(id) {
  if (!id) return null;
  const m = payById(id);
  if (m) return { kind: "label", id: id, name: m.name, note: m.note };
  const p = state.platforms.find(x => x.id === id);
  if (p) return { kind: "service", id: id, name: p.name, note: p.plan.tier || "", platform: p };
  return null;
}
function payLabel(p) {
  const e = payEntity(p.plan.paymentId);
  return e ? e.name : "";
}
function addPaymentService(name, url, note) {
  const p = normalize({
    name: name, url: url, category: PAY_CAT, status: "Активна",
    purpose: note || "Сервис, через который оплачиваются другие платформы."
  });
  state.platforms.push(p);
  return p;
}

/* ==================================================================
   Хранилище
   ================================================================== */
let state = { version: 1, meta: null, platforms: [], payments: [], lastExport: null, theme: null };
let storageOk = true;

function load() {
  let raw = null;
  try {
    raw = localStorage.getItem(STORE_KEY);
    localStorage.setItem(STORE_KEY + "-probe", "1");
    localStorage.removeItem(STORE_KEY + "-probe");
  } catch (e) {
    storageOk = false;
  }
  if (raw) {
    try {
      const d = JSON.parse(raw);
      state = {
        version: 1,
        meta: d.meta || null,
        platforms: (d.platforms || []).map(normalize),
        payments: (d.payments || []).map(normPayment),
        lastExport: d.lastExport || null,
        theme: d.theme || null
      };
      return;
    } catch (e) { /* повреждённые данные — уходим на сид */ }
  }
  state.platforms = SEED.map((s, i) => {
    const p = normalize(s);
    p.id = "seed-" + i;
    return p;
  });
  save();
}
function save() {
  if (!storageOk) return;
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
  } catch (e) {
    storageOk = false;
    renderBanners();
  }
}

/* ==================================================================
   Шифрование: PBKDF2 → AES-GCM. Ключ живёт только в памяти.
   ================================================================== */
let cryptoKey = null;

const b64  = buf => btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(buf))));
const unb64 = str => Uint8Array.from(atob(str), c => c.charCodeAt(0));

async function deriveKey(password, salt, iterations) {
  const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: salt, iterations: iterations, hash: "SHA-256" },
    base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]
  );
}
async function encJSON(key, obj) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv: iv },
    key, new TextEncoder().encode(JSON.stringify(obj)));
  return { iv: b64(iv), ct: b64(ct) };
}
async function decJSON(key, blob) {
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(blob.iv) }, key, unb64(blob.ct));
  return JSON.parse(new TextDecoder().decode(pt));
}

const isSetUp = () => !!(state.meta && state.meta.salt);
const isUnlocked = () => !!cryptoKey;

async function createMaster(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await deriveKey(password, salt, PBKDF2_ITER);
  const verifier = await encJSON(key, { v: "ai-platforms" });
  state.meta = { salt: b64(salt), iterations: PBKDF2_ITER, verifier: verifier };
  cryptoKey = key;
  save(); touchActivity();
}
async function unlockVault(password) {
  const key = await deriveKey(password, unb64(state.meta.salt), state.meta.iterations || PBKDF2_ITER);
  try {
    await decJSON(key, state.meta.verifier);
  } catch (e) {
    return false;
  }
  cryptoKey = key; touchActivity();
  return true;
}
function lockVault(silent) {
  cryptoKey = null;
  clearTimeout(lockVault._t);
  const ov = $("#cardOv");
  // открытую карточку перерисовываем в «закрытом» виде, но форму редактирования не трогаем
  if (!ov.hidden && ov.dataset.mode !== "edit" && openId) openCard(openId);
  renderLock();
  if (!silent) toast("Сейф заблокирован");
}
function touchActivity() {
  if (!cryptoKey) return;
  clearTimeout(lockVault._t);
  lockVault._t = setTimeout(() => lockVault(), AUTOLOCK_MS);
}
["pointerdown", "keydown"].forEach(ev => document.addEventListener(ev, touchActivity, { passive: true }));

/* Секреты платформы: расшифровать / зашифровать */
async function readSecret(p) {
  if (!p.secret || !cryptoKey) return null;
  try { return await decJSON(cryptoKey, p.secret); }
  catch (e) { return null; }
}
async function writeSecret(p, sec) {
  const has = sec && (nz(sec.password) || nz(sec.apiKey) || nz(sec.notes));
  p.secret = has ? await encJSON(cryptoKey, {
    password: nz(sec.password), apiKey: nz(sec.apiKey), notes: nz(sec.notes)
  }) : null;
}

/* ==================================================================
   Универсальный диалог: modal({title, sub, body, buttons}) → Promise
   ================================================================== */
let dlgResolve = null;
function modal(opt) {
  const ov = $("#dlgOv");
  $("#dTitle").textContent = opt.title || "";
  const sub = $("#dSub");
  sub.textContent = opt.sub || ""; sub.hidden = !opt.sub;
  $("#dBody").innerHTML = opt.body || "";
  const foot = $("#dFoot");
  foot.innerHTML = "";
  (opt.buttons || [{ label: "Закрыть", value: null }]).forEach((b, i) => {
    if (b.spacer) { const s = document.createElement("div"); s.className = "sep"; foot.appendChild(s); return; }
    const el = document.createElement("button");
    el.type = "button";
    el.className = "btn" + (b.variant ? " " + b.variant : "");
    el.textContent = b.label;
    el.dataset.i = i;
    el.addEventListener("click", () => {
      if (b.validate) { const err = b.validate(); if (err) { showDlgError(err); return; } }
      closeDlg(typeof b.value === "function" ? b.value() : b.value);
    });
    foot.appendChild(el);
  });
  ov.hidden = false;
  if (opt.onOpen) opt.onOpen($("#dBody"));
  const first = $("#dBody input, #dBody textarea, #dBody select");
  if (first) first.focus();
  return new Promise(res => { dlgResolve = res; });
}
function showDlgError(msg) {
  let e = $("#dlgErr");
  if (!e) {
    e = document.createElement("div");
    e.id = "dlgErr"; e.className = "banner bad"; e.style.marginTop = "10px";
    $("#dBody").appendChild(e);
  }
  e.textContent = msg;
}
function closeDlg(val) {
  $("#dlgOv").hidden = true;
  $("#dBody").innerHTML = "";
  const r = dlgResolve; dlgResolve = null;
  if (r) r(val === undefined ? null : val);
}
function askConfirm(title, text, okLabel, danger) {
  return modal({
    title: title,
    body: "<p style='margin:0'>" + esc(text) + "</p>",
    buttons: [{ label: "Отмена", value: false }, { spacer: true },
      { label: okLabel || "Продолжить", value: true, variant: danger ? "danger" : "primary" }]
  });
}
/* Запрос пароля. confirmField=true → два поля с проверкой совпадения. */
function askPassword(opt) {
  const two = !!opt.confirmField;
  return modal({
    title: opt.title,
    sub: opt.sub,
    body: (opt.note ? "<div class='note" + (opt.noteAcc ? " acc" : "") + "'>" + opt.note + "</div>" : "") +
      "<div class='form'><div class='f wide'><label>" + esc(opt.label || "Мастер-пароль") + "</label>" +
      "<input type='password' id='pw1' autocomplete='new-password'></div>" +
      (two ? "<div class='f wide'><label>Повторите пароль</label><input type='password' id='pw2' autocomplete='new-password'></div>" : "") +
      "</div>",
    buttons: [{ label: "Отмена", value: null }, { spacer: true }, {
      label: opt.okLabel || "Готово", variant: "primary",
      validate: () => {
        const a = $("#pw1").value;
        if (!a) return "Введите пароль.";
        if (two && a.length < 8) return "Минимум 8 символов — это ключ ко всем вашим паролям.";
        if (two && a !== $("#pw2").value) return "Пароли не совпадают.";
        return null;
      },
      value: () => $("#pw1").value
    }],
    onOpen: () => {
      $("#pw1").addEventListener("keydown", e => {
        if (e.key === "Enter" && !two) $("#dFoot button:last-child").click();
      });
    }
  });
}

/* Сценарии мастер-пароля */
async function flowCreateMaster() {
  const pw = await askPassword({
    title: "Создать мастер-пароль",
    label: "Новый мастер-пароль",
    okLabel: "Создать сейф",
    confirmField: true,
    noteAcc: true,
    note: "Этим паролем шифруются пароли, API-ключи и приватные заметки. <b>Восстановить его невозможно</b> — запишите в менеджер паролей или на бумагу. Остальные поля базы останутся читаемыми даже без него."
  });
  if (pw === null) return false;
  await createMaster(pw);
  renderLock(); toast("Сейф создан и разблокирован");
  return true;
}
async function flowUnlock() {
  if (!isSetUp()) return flowCreateMaster();
  const pw = await askPassword({ title: "Разблокировать сейф", okLabel: "Разблокировать" });
  if (pw === null) return false;
  const ok = await unlockVault(pw);
  if (!ok) { toast("Неверный мастер-пароль"); return false; }
  renderLock(); toast("Сейф разблокирован на 10 минут");
  return true;
}
async function ensureUnlocked() {
  if (isUnlocked()) return true;
  return flowUnlock();
}
async function flowChangeMaster() {
  if (!isSetUp()) return flowCreateMaster();
  if (!isUnlocked()) { const ok = await flowUnlock(); if (!ok) return; }
  const pw = await askPassword({
    title: "Новый мастер-пароль",
    sub: "Все сохранённые секреты будут перешифрованы",
    confirmField: true, okLabel: "Сменить",
    note: "Старые бэкапы останутся на старом пароле — сделайте новый экспорт после смены."
  });
  if (pw === null) return;

  // сначала расшифровываем всё старым ключом — и только если всё прочиталось, меняем пароль
  const plain = [];
  for (const p of state.platforms) {
    if (!p.secret) { plain.push(null); continue; }
    const s = await readSecret(p);
    if (!s) { toast("Не удалось прочитать секреты «" + p.name + "» — смена отменена"); return; }
    plain.push(s);
  }
  await createMaster(pw);
  for (let i = 0; i < state.platforms.length; i++) {
    if (plain[i]) await writeSecret(state.platforms[i], plain[i]);
  }
  save(); renderLock(); toast("Мастер-пароль изменён — сделайте новый бэкап");
}

/* ==================================================================
   Деньги и даты
   ================================================================== */
const PAYING = ["Активна", "Пробный период"];
function monthlyCost(p) {
  const v = Number(String(p.plan.price).replace(",", ".")) || 0;
  if (!v || !PAYING.includes(p.status)) return 0;
  if (p.plan.period === "год") return v / 12;
  if (p.plan.period === "разово") return 0;
  return v;
}
function nextCharge(p) {
  if (!p.plan.renewsOn || !PAYING.includes(p.status)) return null;
  const d = new Date(p.plan.renewsOn);
  if (isNaN(d)) return null;
  const now = new Date(); now.setHours(0, 0, 0, 0);
  let guard = 0;
  while (d < now && guard++ < 240) {
    if (p.plan.period === "месяц") d.setMonth(d.getMonth() + 1);
    else if (p.plan.period === "год") d.setFullYear(d.getFullYear() + 1);
    else return null;
  }
  return d;
}
function priceLabel(p) {
  const v = Number(String(p.plan.price).replace(",", ".")) || 0;
  if (!v) return p.status === "Активна" ? "бесплатно" : "";
  const per = p.plan.period === "год" ? "/год" : p.plan.period === "разово" ? "" : "/мес";
  return fmtMoney(v, p.plan.currency) + per;
}

/* ==================================================================
   Фильтры и отрисовка
   ================================================================== */
let filter = { cat: "", status: "", pay: "", q: "", sort: "cat" };
const filterActive = () => !!(filter.cat || filter.status || filter.pay || filter.q.trim());

function matches(p) {
  if (filter.cat && p.category !== filter.cat) return false;
  if (filter.status && p.status !== filter.status) return false;
  if (filter.pay) {
    if (filter.pay === "paid" && !monthlyCost(p) && !Number(String(p.plan.price).replace(",", "."))) return false;
    else if (filter.pay === "free" && Number(String(p.plan.price).replace(",", "."))) return false;
    else if (filter.pay === "none" && p.plan.paymentId) return false;
    else if (!["paid", "free", "none"].includes(filter.pay) && p.plan.paymentId !== filter.pay) return false;
  }
  const q = filter.q.trim().toLowerCase();
  if (!q) return true;
  const hay = [p.name, p.category, p.purpose, p.strengths, p.regNotes, p.freeLimits,
    p.tips.join(" "), p.tags.join(" "), p.usage, p.account.login, p.plan.tier, payLabel(p), p.url].join(" ").toLowerCase();
  return hay.includes(q);
}
function visible() {
  const catOrder = CATS.map(c => c[0]);
  const list = state.platforms.filter(matches);
  list.sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    if (filter.sort === "name") return a.name.localeCompare(b.name, "ru");
    if (filter.sort === "rating") return (b.rating - a.rating) || a.name.localeCompare(b.name, "ru");
    if (filter.sort === "price") return (monthlyCost(b) - monthlyCost(a)) || a.name.localeCompare(b.name, "ru");
    if (filter.sort === "status") return (STATUSES.indexOf(a.status) - STATUSES.indexOf(b.status)) || a.name.localeCompare(b.name, "ru");
    const d = catOrder.indexOf(a.category) - catOrder.indexOf(b.category);
    return d || a.name.localeCompare(b.name, "ru");
  });
  return list;
}

function renderStats() {
  const ps = visible();               // сводка считается по текущей выборке
  const filtered = filterActive();
  const active = ps.filter(p => p.status === "Активна").length;
  const trial = ps.filter(p => p.status === "Пробный период").length;
  const byCur = {};
  ps.forEach(p => {
    const m = monthlyCost(p);
    if (m) byCur[p.plan.currency || "₽"] = (byCur[p.plan.currency || "₽"] || 0) + m;
  });
  const spend = Object.keys(byCur).length
    ? Object.keys(byCur).map(c => fmtMoney(byCur[c], c)).join(" + ")
    : "0 ₽";
  let next = null, nextP = null;
  ps.forEach(p => { const d = nextCharge(p); if (d && (!next || d < next)) { next = d; nextP = p; } });
  const free = ps.filter(p => PAYING.includes(p.status) && !monthlyCost(p)).length;

  $("#stats").innerHTML = [
    [filtered ? "Платформ в выборке" : "Платформ в базе", ps.length,
      filtered ? "из " + state.platforms.length + " в базе" : ps.filter(p => p.status === "Не зарегистрирован").length + " ещё не заведено"],
    ["Активных", active, trial ? trial + " на пробном периоде" : "пробных нет"],
    ["Расходы в месяц", spend, "годовые тарифы приведены к месяцу"],
    ["Ближайшее списание", next ? fmtDate(next.toISOString().slice(0, 10)) : "—", nextP ? nextP.name : "дата не указана"],
    ["Бесплатных в работе", free, "используются без оплаты"]
  ].map(r => "<div class='stat'><div class='k'>" + r[0] + "</div><div class='v'>" + esc(String(r[1])) +
      "<small>" + esc(String(r[2])) + "</small></div></div>").join("");
}

function daysUntil(date) {
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

function renderFilters() {
  const counts = {};
  state.platforms.forEach(p => counts[p.category] = (counts[p.category] || 0) + 1);
  let h = "<button class='chip" + (filter.cat ? "" : " active") + "' data-cat=''>Все <span class='n'>" + state.platforms.length + "</span></button>";
  CATS.forEach(c => {
    if (!counts[c[0]]) return;
    h += "<button class='chip" + (filter.cat === c[0] ? " active" : "") + "' data-cat='" + esc(c[0]) + "'>" +
      c[1] + " " + esc(c[0]) + " <span class='n'>" + counts[c[0]] + "</span></button>";
  });
  h += "<div class='sep'></div>";
  h += "<select id='fStatus'><option value=''>Любой статус</option>" +
    STATUSES.map(s => "<option" + (filter.status === s ? " selected" : "") + ">" + s + "</option>").join("") + "</select>";
  const paidN = state.platforms.filter(p => Number(String(p.plan.price).replace(",", "."))).length;
  h += "<select id='fPayFilter' title='Фильтр по способу оплаты'>" +
    "<option value=''>Оплата: любая</option>" +
    "<option value='paid'" + (filter.pay === "paid" ? " selected" : "") + ">Только платные (" + paidN + ")</option>" +
    "<option value='free'" + (filter.pay === "free" ? " selected" : "") + ">Только бесплатные</option>" +
    (payServices().length ? "<optgroup label='Через сервис оплаты'>" + payServices().map(s =>
      "<option value='" + esc(s.id) + "'" + (filter.pay === s.id ? " selected" : "") + ">💳 " +
      esc(s.name) + " (" + payUsage(s.id).count + ")</option>").join("") + "</optgroup>" : "") +
    (state.payments.length ? "<optgroup label='Картой или счётом'>" + state.payments.map(m =>
      "<option value='" + esc(m.id) + "'" + (filter.pay === m.id ? " selected" : "") + ">" +
      esc(m.name) + " (" + payUsage(m.id).count + ")</option>").join("") + "</optgroup>" : "") +
    "<option value='none'" + (filter.pay === "none" ? " selected" : "") + ">Способ не указан</option>" +
    "<option value='__manage'>⚙ Настроить способы оплаты…</option>" +
    "</select>";
  h += "<select id='fSort'>" + [["cat", "по категориям"], ["name", "по названию"], ["rating", "по оценке"],
    ["price", "по цене"], ["status", "по статусу"]]
    .map(o => "<option value='" + o[0] + "'" + (filter.sort === o[0] ? " selected" : "") + ">Сортировка: " + o[1] + "</option>").join("") + "</select>";
  $("#filters").innerHTML = h;
}

function renderGrid() {
  const list = visible();
  $("#empty").hidden = list.length > 0;
  $("#grid").innerHTML = list.map(p => {
    const pr = priceLabel(p);
    const link = p.urlLogin || p.url;
    return "<div class='cell'><button class='tile' type='button' data-id='" + p.id + "'>" +
      "<div class='row1'>" + iconHTML(p) +
        "<span style='min-width:0'><h3>" + esc(p.name) + "</h3><p class='cat'>" +
        (CAT_ICON[p.category] || "📦") + " " + esc(p.category) + "</p></span></div>" +
      "<p class='pur'>" + esc(p.purpose || "Описание не заполнено") + "</p>" +
      "<div class='row2'><span class='badge " + (STATUS_CLASS[p.status] || "") + "'>" + esc(p.status) + "</span>" +
        (p.secret ? "<span class='badge acc' title='В сейфе есть пароль или ключ'>🔑</span>" : "") +
        (p.pinned ? "<span class='pin' title='Закреплено'>📌</span>" : "") +
        (pr ? "<span class='money'>" + esc(pr) + "</span>" : "") +
        (p.rating ? "<span class='stars'>" + "★".repeat(p.rating) + "</span>" : "") +
      "</div></button>" +
      (link
        ? "<a class='go' href='" + esc(link) + "' target='_blank' rel='noopener noreferrer' " +
          "title='Открыть " + (p.urlLogin ? "личный кабинет" : "сайт") + ": " + esc(link) + "' " +
          "aria-label='Открыть " + esc(p.name) + " в новой вкладке'>⇗</a>"
        : "") +
      "<button class='kill' type='button' data-kill='" + p.id + "' title='Удалить «" + esc(p.name) + "» из базы' " +
        "aria-label='Удалить " + esc(p.name) + "'>✕</button></div>";
  }).join("") +
    "<button class='tile add' type='button' id='addTile'><span class='plus'>+</span>" +
    "<b>Добавить платформу</b><span>вручную, своими полями</span></button>";
}

function renderLock() {
  const chip = $("#lockChip");
  if (!isSetUp()) {
    chip.className = "lockchip"; chip.textContent = "🔐 Создать сейф";
    chip.title = "Задать мастер-пароль для хранения паролей";
  } else if (isUnlocked()) {
    chip.className = "lockchip on"; chip.textContent = "🔓 Сейф открыт";
    chip.title = "Нажмите, чтобы заблокировать";
  } else {
    chip.className = "lockchip off"; chip.textContent = "🔒 Сейф закрыт";
    chip.title = "Нажмите, чтобы разблокировать";
  }
  $("#brandSub").textContent = "личный справочник доступов и приёмов" +
    (isSetUp() ? "" : " · сейф ещё не создан");
  $("#storeHint").textContent = storageOk
    ? "Данные хранятся в этом браузере. Регулярно делайте экспорт."
    : "Браузер запретил локальное хранилище — данные только в памяти!";
}

function renderBanners() {
  const b = [];
  if (!storageOk) b.push(["bad", "<b>Браузер не даёт сохранять данные.</b> Всё, что вы введёте, живёт только до закрытия вкладки — сделайте «Экспорт бэкапа» перед закрытием.", ""]);
  const hasSecrets = state.platforms.some(p => p.secret);
  if (hasSecrets && !state.lastExport) b.push(["", "У вас есть сохранённые секреты, но ни одного бэкапа. Очистка данных браузера удалит базу безвозвратно.", "export"]);
  else if (state.lastExport) {
    const days = Math.floor((Date.now() - new Date(state.lastExport)) / 86400000);
    if (days >= EXPORT_REMIND_DAYS) b.push(["", "Последний бэкап был " + days + " дн. назад.", "export"]);
  }
  $("#banners").innerHTML = b.map(x =>
    "<div class='banner " + x[0] + "'><span>" + x[1] + "</span>" +
    (x[2] ? "<button class='btn sm' type='button' data-act='" + x[2] + "' style='margin-left:auto'>Экспорт</button>" : "") +
    "</div>").join("");
}

function render() { renderStats(); renderAttention(); renderFilters(); renderGrid(); renderLock(); renderBanners(); }

/* ==================================================================
   Карточка платформы (просмотр)
   ================================================================== */
let openId = null;
let openSecret = null;      // расшифрованные секреты открытой карточки
let revealTimer = null;

function byId(id) { return state.platforms.find(p => p.id === id); }

function closeCard() {
  $("#cardOv").hidden = true;
  $("#cBody").innerHTML = ""; $("#cFoot").innerHTML = "";
  openId = null; openSecret = null;
  clearTimeout(revealTimer);
}

async function openCard(id) {
  const p = byId(id);
  if (!p) return;
  openId = id;
  openSecret = await readSecret(p);
  paintIcon($("#cIco"), p);
  const head = p.urlLogin || p.url;
  $("#cName").innerHTML = head
    ? "<a href='" + esc(head) + "' target='_blank' rel='noopener noreferrer' style='color:inherit;text-decoration:none'>" +
      esc(p.name) + " <span style='color:var(--accTxt);font-size:15px'>⇗</span></a>"
    : esc(p.name);
  $("#cSub").innerHTML = (CAT_ICON[p.category] || "📦") + " " + esc(p.category) +
    " · <span class='badge " + (STATUS_CLASS[p.status] || "") + "'>" +
    esc(p.status) + "</span>" + (p.rating ? " · <span class='stars'>" + "★".repeat(p.rating) + "☆".repeat(5 - p.rating) + "</span>" : "");

  const linkBtn = (url, label) => url
    ? "<a class='btn sm' href='" + esc(url) + "' target='_blank' rel='noopener noreferrer'>" + label + " ↗</a>" : "";

  let h = "";
  h += "<div class='sect linkrow'>" +
    linkBtn(p.url, "Сайт") + linkBtn(p.urlLogin, "Вход") + linkBtn(p.urlBilling, "Тариф и оплата") +
    "</div>";

  if (p.purpose) h += "<div class='sect'><h4>Для чего нужна</h4><p>" + esc(p.purpose) + "</p></div>";
  if (p.strengths) h += "<div class='sect'><h4>Сильные стороны</h4><p>" + esc(p.strengths) + "</p></div>";
  if (p.tips.length) h += "<div class='sect'><h4>Приёмы и фишки</h4><ul>" +
    p.tips.map(t => "<li>" + esc(t) + "</li>").join("") + "</ul></div>";
  if (p.regNotes) h += "<div class='sect'><h4>Особенности регистрации</h4><p>" + esc(p.regNotes) + "</p></div>";
  if (p.freeLimits) h += "<div class='sect'><h4>Что даёт бесплатно</h4><p>" + esc(p.freeLimits) + "</p></div>";

  /* доступ */
  h += "<div class='sect'><h4>Доступ</h4><div class='secretbox'>";
  h += "<div class='secretrow'><span class='lab'>Логин</span>" +
    (p.account.login
      ? "<span class='val'>" + esc(p.account.login) + "</span><button class='btn sm' type='button' data-copy='login'>Копировать</button>"
      : "<span style='color:var(--muted)'>не указан</span>") + "</div>";
  if (p.account.authMethod) h += "<div class='secretrow'><span class='lab'>Вход через</span><span>" + esc(p.account.authMethod) +
    (p.account.twoFactor ? " · 2FA включена" : "") + "</span></div>";
  else if (p.account.twoFactor) h += "<div class='secretrow'><span class='lab'>2FA</span><span>включена</span></div>";

  if (!p.secret) {
    h += "<div class='secretrow'><span class='lab'>Пароль</span><span style='color:var(--muted)'>в сейфе не сохранён</span></div>";
  } else if (!isUnlocked()) {
    h += "<div class='secretrow'><span class='lab'>Пароль</span><span style='color:var(--muted)'>🔒 сейф заблокирован</span>" +
      "<button class='btn sm primary' type='button' data-act='unlockHere'>Разблокировать</button></div>";
  } else if (!openSecret) {
    h += "<div class='secretrow'><span class='lab'>Пароль</span><span style='color:var(--danger)'>не удалось расшифровать</span></div>";
  } else {
    if (openSecret.password) h += "<div class='secretrow'><span class='lab'>Пароль</span>" +
      "<span class='val' id='pwCell'>••••••••••</span>" +
      "<button class='btn sm' type='button' data-act='reveal'>Показать</button>" +
      "<button class='btn sm' type='button' data-copy='pw'>Копировать</button></div>";
    if (openSecret.apiKey) h += "<div class='secretrow'><span class='lab'>API-ключ</span>" +
      "<span class='val' id='akCell'>••••••••••</span>" +
      "<button class='btn sm' type='button' data-act='revealAk'>Показать</button>" +
      "<button class='btn sm' type='button' data-copy='ak'>Копировать</button></div>";
    if (openSecret.notes) h += "<div class='secretrow' style='align-items:flex-start'><span class='lab'>Заметки</span>" +
      "<span style='white-space:pre-wrap'>" + esc(openSecret.notes) + "</span></div>";
  }
  if (p.account.passwordRef) h += "<div class='secretrow'><span class='lab'>Где ещё пароль</span><span>" + esc(p.account.passwordRef) + "</span></div>";
  h += "</div></div>";

  /* тариф */
  const kv = [];
  if (p.plan.tier) kv.push(["Тариф", p.plan.tier]);
  if (priceLabel(p)) kv.push(["Стоимость", priceLabel(p)]);
  const nd = nextCharge(p);
  if (nd) kv.push(["Следующее списание", fmtDate(nd.toISOString().slice(0, 10))]);
  else if (p.plan.renewsOn) kv.push(["Дата продления", fmtDate(p.plan.renewsOn)]);
  const pe = payEntity(p.plan.paymentId);
  if (pe && pe.kind === "service") kv.push(["Чем платим",
    "<button class='btn sm' type='button' data-act='goPay' data-id='" + pe.id + "'>💳 " + esc(pe.name) + " →</button>", true]);
  else if (pe) kv.push(["Чем платим", pe.name + (pe.note ? " — " + pe.note : "")]);
  if (p.usage) kv.push(["Использование", p.usage]);
  if (p.checkedAt) kv.push(["Цены проверял", fmtDate(p.checkedAt)]);
  if (p.tags.length) kv.push(["Теги", p.tags.join(", ")]);
  if (kv.length) h += "<div class='sect'><h4>Тариф и учёт</h4><dl class='kv'>" +
    kv.map(r => "<dt>" + esc(r[0]) + "</dt><dd>" + (r[2] ? r[1] : esc(r[1])) + "</dd>").join("") + "</dl></div>";

  /* если это сервис оплаты — что через него платится */
  if (p.category === PAY_CAT) {
    const u = payUsage(p.id);
    h += "<div class='sect'><h4>Через него оплачивается</h4>" +
      (u.count
        ? "<div class='linkrow'>" + u.platforms.map(x =>
            "<button class='btn sm' type='button' data-act='goPay' data-id='" + x.id + "'>" +
            (CAT_ICON[x.category] || "📦") + " " + esc(x.name) + (priceLabel(x) ? " · " + esc(priceLabel(x)) : "") + "</button>").join("") +
          "</div><p style='margin:9px 0 0;color:var(--muted);font-size:13.5px'>Итого: " +
          (u.money || "без оплаты") + " в месяц</p>"
        : "<p style='color:var(--muted)'>Пока ни одна платформа не привязана. Выберите этот сервис в поле «Чем платим» у нужных платформ.</p>") +
      "</div>";
  }

  h += "<div class='sect' style='margin-bottom:0'><h4>Служебное</h4><dl class='kv'>" +
    "<dt>Обновлено</dt><dd>" + esc(fmtDate(p.updatedAt) || "—") + "</dd></dl></div>";

  $("#cBody").innerHTML = h;
  $("#cFoot").innerHTML =
    "<button class='btn danger sm' type='button' data-act='del'>Удалить</button>" +
    "<div class='sep'></div>" +
    "<button class='btn' type='button' data-close>Закрыть</button>" +
    "<button class='btn primary' type='button' data-act='edit'>Редактировать</button>";
  $("#cardOv").hidden = false;
}

function revealInto(cellSel, value, btn) {
  const cell = $(cellSel);
  if (!cell) return;
  if (cell.dataset.shown === "1") {
    cell.textContent = "••••••••••"; cell.dataset.shown = ""; btn.textContent = "Показать"; return;
  }
  cell.textContent = value; cell.dataset.shown = "1"; btn.textContent = "Скрыть";
  clearTimeout(revealTimer);
  revealTimer = setTimeout(() => {
    if (cell.isConnected && cell.dataset.shown === "1") {
      cell.textContent = "••••••••••"; cell.dataset.shown = ""; btn.textContent = "Показать";
    }
  }, REVEAL_MS);
}

/* ==================================================================
   Форма создания/редактирования
   ================================================================== */
function paySelectHTML(selectedId, ownId) {
  const svc = payServices(ownId);
  let h = "<select id='fPay'><option value=''>— не указан</option>";
  if (svc.length) h += "<optgroup label='Сервисы оплаты'>" +
    svc.map(s => "<option value='" + esc(s.id) + "'" + (s.id === selectedId ? " selected" : "") + ">" +
      esc(s.name) + (s.plan.tier ? " — " + esc(s.plan.tier) : "") + "</option>").join("") + "</optgroup>";
  if (state.payments.length) h += "<optgroup label='Карты и счета'>" +
    state.payments.map(m => "<option value='" + esc(m.id) + "'" + (m.id === selectedId ? " selected" : "") + ">" +
      esc(m.name) + (m.note ? " — " + esc(m.note) : "") + "</option>").join("") + "</optgroup>";
  h += "<optgroup label='Добавить'>" +
    "<option value='__newsvc'>+ Новый сервис оплаты…</option>" +
    "<option value='__new'>+ Новая карта или счёт…</option>" +
    "<option value='__manage'>⚙ Управление…</option></optgroup></select>";
  return h;
}

function fieldsHTML(p, sec, secState) {
  const opt = (list, val) => list.map(o => "<option" + (String(o) === String(val) ? " selected" : "") + ">" + esc(o) + "</option>").join("");
  const secNote = {
    unlocked: "",
    locked: "<div class='note'>🔒 Сейф заблокирован — пароль и API-ключ сохранятся без изменений. Разблокируйте сейф, чтобы их менять.</div>",
    none: "<div class='note acc'>Мастер-пароль ещё не задан. Нажмите «🔐 Создать сейф» в шапке — и поля пароля станут доступны.</div>"
  }[secState];
  const dis = secState === "unlocked" ? "" : " disabled";

  return "<div class='form'>" +
    "<div class='f'><label>Название *</label><input id='fName' value='" + esc(p.name) + "'></div>" +
    "<div class='f'><label>Категория</label><select id='fCat'>" + opt(CATS.map(c => c[0]), p.category) + "</select></div>" +
    "<div class='f'><label>Ссылка на сайт</label><input id='fUrl' placeholder='https://…' value='" + esc(p.url) + "'></div>" +
    "<div class='f'><label>Ссылка на вход в кабинет</label><input id='fUrlLogin' placeholder='https://…' value='" + esc(p.urlLogin) + "'></div>" +
    "<div class='f'><label>Ссылка на тариф / оплату</label><input id='fUrlBilling' placeholder='https://…' value='" + esc(p.urlBilling) + "'></div>" +
    "<div class='f'><label>Статус</label><select id='fStatusF'>" + opt(STATUSES, p.status) + "</select></div>" +
    "<div class='f wide'><label>Для чего нужна</label><textarea id='fPurpose'>" + esc(p.purpose) + "</textarea></div>" +
    "<div class='f wide'><label>Сильные стороны</label><textarea id='fStrengths'>" + esc(p.strengths) + "</textarea></div>" +
    "<div class='f wide'><label>Приёмы и фишки — по одному в строке</label><textarea id='fTips'>" + esc(p.tips.join("\n")) + "</textarea></div>" +
    "<div class='f wide'><label>Особенности регистрации</label><textarea id='fReg' placeholder='Чем подтверждали аккаунт, какие были сложности, ограничения, чем оплачивали…'>" + esc(p.regNotes) + "</textarea></div>" +
    "<div class='f wide'><label>Что даёт бесплатно</label><textarea id='fFree' style='min-height:56px'>" + esc(p.freeLimits) + "</textarea></div>" +

    "<div class='f-group'><h4>Доступ</h4>" + secNote + "<div class='form'>" +
      "<div class='f'><label>Логин / email</label><input id='fLogin' value='" + esc(p.account.login) + "'></div>" +
      "<div class='f'><label>Способ входа</label><select id='fAuth'>" + opt(AUTH_METHODS, p.account.authMethod) + "</select></div>" +
      "<div class='f'><label>Пароль</label><div class='pwfield'><input id='fPw' type='password' autocomplete='off' value='" + esc(sec.password) + "'" + dis + ">" +
        "<button class='btn sm' type='button' data-act='peek' data-target='fPw'" + dis + ">👁</button></div></div>" +
      "<div class='f'><label>API-ключ</label><div class='pwfield'><input id='fApi' type='password' autocomplete='off' value='" + esc(sec.apiKey) + "'" + dis + ">" +
        "<button class='btn sm' type='button' data-act='peek' data-target='fApi'" + dis + ">👁</button></div></div>" +
      "<div class='f wide'><label>Приватные заметки (шифруются)</label><textarea id='fSecNotes' style='min-height:56px'" + dis + ">" + esc(sec.notes) + "</textarea></div>" +
      "<div class='f'><label>Где ещё лежит пароль</label><input id='fPwRef' placeholder='например: менеджер паролей' value='" + esc(p.account.passwordRef) + "'></div>" +
      "<div class='f'><label>&nbsp;</label><label class='check'><input type='checkbox' id='f2fa'" + (p.account.twoFactor ? " checked" : "") + "> Включена двухфакторная авторизация</label></div>" +
    "</div></div>" +

    "<div class='f-group'><h4>Тариф</h4><div class='form'>" +
      "<div class='f'><label>Название тарифа</label><input id='fTier' placeholder='Free / Plus / Pro…' value='" + esc(p.plan.tier) + "'></div>" +
      "<div class='f'><label>Цена</label><input id='fPrice' inputmode='decimal' value='" + esc(p.plan.price) + "'></div>" +
      "<div class='f'><label>Валюта</label><select id='fCur'>" + opt(CURRENCIES, p.plan.currency) + "</select></div>" +
      "<div class='f'><label>Период</label><select id='fPeriod'>" + opt(PERIODS, p.plan.period) + "</select></div>" +
      "<div class='f'><label>Дата продления</label><input id='fRenews' type='date' value='" + esc(p.plan.renewsOn) + "'></div>" +
      "<div class='f'><label>Чем платим</label>" + paySelectHTML(p.plan.paymentId, p.id) +
        "<span class='tip'>Сервис-посредник или карта. Новый добавляется прямо здесь, ⚙ — управление списком.</span></div>" +
    "</div></div>" +

    "<div class='f'><label>Частота использования</label><select id='fUsage'>" +
      [["", "не указано"], ["Ежедневно", "ежедневно"], ["Еженедельно", "еженедельно"], ["Редко", "редко"], ["Не использую", "не использую"]].map(o =>
        "<option value='" + o[0] + "'" + (p.usage === o[0] ? " selected" : "") + ">" + o[1] + "</option>").join("") + "</select></div>" +
    "<div class='f'><label>Моя оценка</label><select id='fRating'>" +
      [0, 1, 2, 3, 4, 5].map(n => "<option value='" + n + "'" + (p.rating === n ? " selected" : "") + ">" +
        (n ? "★".repeat(n) : "без оценки") + "</option>").join("") + "</select></div>" +
    "<div class='f'><label>Когда проверял цены</label><input id='fChecked' type='date' value='" + esc(p.checkedAt) + "'></div>" +
    "<div class='f'><label>Теги через запятую</label><input id='fTags' value='" + esc(p.tags.join(", ")) + "'></div>" +
    "<div class='f'><label>&nbsp;</label><label class='check'><input type='checkbox' id='fPin'" + (p.pinned ? " checked" : "") + "> Закрепить в начале списка</label></div>" +
  "</div>";
}

async function openEdit(id) {
  const isNew = !id;
  const src = isNew ? blank() : byId(id);
  if (!src) return;
  const p = JSON.parse(JSON.stringify(src));
  let sec = { password: "", apiKey: "", notes: "" };
  let secState = "none";
  if (isSetUp()) secState = isUnlocked() ? "unlocked" : "locked";
  if (secState === "unlocked" && p.secret) {
    const s = await readSecret(p);
    if (s) sec = { password: nz(s.password), apiKey: nz(s.apiKey), notes: nz(s.notes) };
  }

  openId = id || null;
  if (isNew) { $("#cIco").className = "ico"; $("#cIco").style.background = ""; $("#cIco").style.color = ""; $("#cIco").textContent = "＋"; }
  else paintIcon($("#cIco"), p);
  $("#cName").textContent = isNew ? "Новая платформа" : "Редактирование";
  $("#cSub").textContent = isNew ? "Заполните хотя бы название и ссылку" : p.name;
  $("#cBody").innerHTML = fieldsHTML(p, sec, secState);
  $("#cFoot").innerHTML = "<div class='sep'></div>" +
    "<button class='btn' type='button' data-act='cancelEdit'>Отмена</button>" +
    "<button class='btn primary' type='button' data-act='saveEdit'>Сохранить</button>";
  $("#cardOv").hidden = false;
  $("#cardOv").dataset.mode = "edit";
  $("#cardOv").dataset.new = isNew ? "1" : "";
  $("#cardOv").dataset.secstate = secState;
  $("#fPay").dataset.prev = p.plan.paymentId || "";
  $("#fName").focus();
}

async function saveEdit() {
  const isNew = $("#cardOv").dataset.new === "1";
  const secState = $("#cardOv").dataset.secstate;
  const name = $("#fName").value.trim();
  if (!name) { toast("Название обязательно"); $("#fName").focus(); return; }

  const p = isNew ? blank() : byId(openId);
  if (!p) return;
  p.name = name;
  p.category = $("#fCat").value;
  p.url = $("#fUrl").value.trim();
  p.urlLogin = $("#fUrlLogin").value.trim();
  p.urlBilling = $("#fUrlBilling").value.trim();
  p.status = $("#fStatusF").value;
  p.purpose = $("#fPurpose").value.trim();
  p.strengths = $("#fStrengths").value.trim();
  p.tips = $("#fTips").value.split("\n").map(s => s.trim()).filter(Boolean);
  p.regNotes = $("#fReg").value.trim();
  p.freeLimits = $("#fFree").value.trim();
  p.account = {
    login: $("#fLogin").value.trim(),
    authMethod: $("#fAuth").value,
    twoFactor: $("#f2fa").checked,
    passwordRef: $("#fPwRef").value.trim()
  };
  p.plan = {
    tier: $("#fTier").value.trim(),
    price: $("#fPrice").value.trim(),
    currency: $("#fCur").value,
    period: $("#fPeriod").value,
    renewsOn: $("#fRenews").value,
    paymentId: ["__new", "__newsvc", "__manage"].includes($("#fPay").value) ? "" : $("#fPay").value,
    paymentLabel: ""
  };
  p.usage = $("#fUsage").value;
  p.rating = Number($("#fRating").value) || 0;
  p.pinned = $("#fPin").checked;
  p.tags = $("#fTags").value.split(",").map(s => s.trim()).filter(Boolean);
  p.checkedAt = $("#fChecked").value;
  p.updatedAt = todayISO();

  if (secState === "unlocked") {
    // сейф мог закрыться автоблокировкой пока форма была открыта
    if (!isUnlocked()) {
      const ok = await flowUnlock();
      if (!ok) { toast("Сейф закрылся — сохранил всё, кроме пароля и ключа"); }
    }
    if (isUnlocked()) {
      await writeSecret(p, { password: $("#fPw").value, apiKey: $("#fApi").value, notes: $("#fSecNotes").value });
    }
  }
  if (isNew) state.platforms.push(p);
  save();
  $("#cardOv").dataset.mode = "";
  render();
  toast(isNew ? "Платформа добавлена" : "Изменения сохранены");
  openCard(p.id);
}

/* ==================================================================
   Экспорт / импорт
   ================================================================== */
function download(name, text) {
  const blob = new Blob([text], { type: "application/json;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
function doExport(withSecrets) {
  const data = {
    kind: "ai-platforms-base",
    version: 1,
    exportedAt: new Date().toISOString(),
    withSecrets: !!withSecrets,
    meta: withSecrets ? state.meta : null,
    payments: withSecrets ? state.payments : [],
    platforms: state.platforms.map(p => {
      const c = JSON.parse(JSON.stringify(p));
      if (!withSecrets) {
        c.secret = null;
        c.account = { login: "", authMethod: c.account.authMethod, twoFactor: c.account.twoFactor, passwordRef: "" };
        c.plan.paymentId = ""; c.plan.paymentLabel = "";
      }
      return c;
    })
  };
  download("ai-platforms-" + (withSecrets ? "backup" : "public") + "-" + todayISO() + ".json", JSON.stringify(data, null, 2));
  if (withSecrets) { state.lastExport = new Date().toISOString(); save(); renderBanners(); }
  toast(withSecrets ? "Бэкап сохранён (секреты внутри зашифрованы)" : "Выгружено без доступов");
}

/* Способы оплаты из файла: сводим по названию, ссылки в платформах переставляем на местные id */
function mergePayments(data, incoming) {
  const map = {};
  (data.payments || []).forEach(raw => {
    const inc = normPayment(raw);
    const local = payByName(inc.name) || addPayment(inc.name, inc.note, inc.currency);
    map[inc.id] = local.id;
  });
  incoming.forEach(p => {
    const legacy = nz(p.plan.paymentLabel).trim();
    /* Переставляем только ссылки на метки. Ссылки на сервисы-платформы здесь не трогаем:
       их id переедут позже, когда платформы будут слиты (иначе ссылка потеряется). */
    if (p.plan.paymentId && map[p.plan.paymentId]) p.plan.paymentId = map[p.plan.paymentId];
    if (!p.plan.paymentId && legacy) {
      p.plan.paymentId = (payByName(legacy) || addPayment(legacy, "", p.plan.currency)).id;
    }
    p.plan.paymentLabel = "";
  });
}

async function doImport(data) {
  if (!data || !Array.isArray(data.platforms)) { toast("Это не похоже на файл базы"); return; }
  const incoming = data.platforms.map(normalize);
  const fresh = !isSetUp() && state.platforms.every(p => String(p.id).startsWith("seed-"));

  if (fresh) {
    const ok = await askConfirm("Восстановить из файла",
      "В базе только исходный каталог. Заменить его содержимым файла (" + incoming.length + " платформ)?", "Восстановить");
    if (!ok) return;
    state.meta = data.meta || null;
    state.payments = (data.payments || []).map(normPayment);
    state.platforms = incoming;
    cryptoKey = null;
    migratePayments();
    save(); render();
    toast("Восстановлено: " + incoming.length + " платформ" + (state.meta ? ". Введите мастер-пароль бэкапа для доступа к секретам" : ""));
    return;
  }

  const mode = await modal({
    title: "Импорт " + incoming.length + " записей",
    sub: "Что делать с платформами, которые уже есть в базе?",
    body: "<button class='choice' data-v='replace'><b>Заменить совпадения</b><span>данные из файла перезапишут существующие записи</span></button>" +
      "<button class='choice' data-v='skip'><b>Пропустить совпадения</b><span>добавятся только новые платформы</span></button>" +
      "<button class='choice' data-v='new'><b>Добавить всё как новое</b><span>дубликаты допускаются</span></button>",
    buttons: [{ label: "Отмена", value: null }],
    onOpen: body => {
      $$(".choice", body).forEach(b => b.addEventListener("click", () => closeDlg(b.dataset.v)));
    }
  });
  if (!mode) return;

  /* секреты: тот же сейф — блобы переносятся как есть, иначе перешифровка */
  const withSecrets = incoming.filter(p => p.secret);
  if (withSecrets.length) {
    const sameVault = state.meta && data.meta && state.meta.salt === data.meta.salt;
    if (!sameVault) {
      if (!data.meta || !data.meta.salt) {
        incoming.forEach(p => p.secret = null);
        toast("В файле нет параметров шифрования — секреты пропущены");
      } else {
        if (!isUnlocked()) {
          const ok = await ensureUnlocked();
          if (!ok) { toast("Импорт отменён: нужен доступ к сейфу"); return; }
        }
        const pw = await askPassword({
          title: "Мастер-пароль бэкапа",
          sub: "В файле " + withSecrets.length + " зашифрованных записей",
          note: "Файл зашифрован другим паролем, чем текущий сейф. Введите пароль <b>от бэкапа</b> — секреты будут перешифрованы под ваш текущий мастер-пароль.",
          okLabel: "Расшифровать"
        });
        if (pw === null) return;
        const bkey = await deriveKey(pw, unb64(data.meta.salt), data.meta.iterations || PBKDF2_ITER);
        try { await decJSON(bkey, data.meta.verifier); }
        catch (e) { toast("Неверный пароль бэкапа — импорт отменён"); return; }
        for (const p of withSecrets) {
          try { p.secret = await encJSON(cryptoKey, await decJSON(bkey, p.secret)); }
          catch (e) { p.secret = null; }
        }
      }
    }
  }

  mergePayments(data, incoming);

  let added = 0, replaced = 0, skipped = 0;
  const idMap = {};                       // id платформы в файле → id в базе
  const landed = [];                      // записи, реально попавшие в базу из файла
  for (const inc of incoming) {
    const origId = inc.id;
    let i = -1;
    if (mode !== "new") {
      i = state.platforms.findIndex(p => p.id === inc.id ||
        p.name.toLowerCase() === inc.name.toLowerCase());
    }
    if (i < 0) { inc.id = mode === "new" ? uid() : inc.id; state.platforms.push(inc); landed.push(inc); added++; }
    else if (mode === "replace") { inc.id = state.platforms[i].id; state.platforms[i] = inc; landed.push(inc); replaced++; }
    else { skipped++; }
    idMap[origId] = i < 0 ? inc.id : state.platforms[i].id;
  }
  /* ссылки «чем платим» на сервисы-платформы переводим на местные id — только у пришедших
     записей, чтобы не сбить привязки у тех, что уже были в базе */
  landed.forEach(p => {
    if (p.plan.paymentId && idMap[p.plan.paymentId]) p.plan.paymentId = idMap[p.plan.paymentId];
  });
  state.platforms.forEach(p => {
    if (p.plan.paymentId && !payEntity(p.plan.paymentId)) p.plan.paymentId = "";
    if (p.plan.paymentId === p.id) p.plan.paymentId = "";
  });
  save(); render();
  toast("Импорт: добавлено " + added + ", заменено " + replaced + ", пропущено " + skipped);
}

/* Полное удаление платформы: снимаем ссылки «чем платим», даём отменить одним кликом */
function deletePlatform(id) {
  const idx = state.platforms.findIndex(x => x.id === id);
  if (idx < 0) return;
  const p = state.platforms[idx];
  const unlinked = state.platforms.filter(x => x.plan.paymentId === id).map(x => x.id);
  unlinked.forEach(x => { const t = byId(x); if (t) t.plan.paymentId = ""; });
  state.platforms.splice(idx, 1);
  const prevFilter = filter.pay;
  if (filter.pay === id) filter.pay = "";
  save();
  if (openId === id) closeCard();
  render();
  toast("Удалено: «" + p.name + "»", {
    label: "Вернуть",
    fn: () => {
      state.platforms.splice(Math.min(idx, state.platforms.length), 0, p);
      unlinked.forEach(x => { const t = byId(x); if (t) t.plan.paymentId = id; });
      filter.pay = prevFilter;
      save(); render();
      toast("Восстановлено: «" + p.name + "»");
    }
  });
}

function addMissingSeed() {
  const have = new Set(state.platforms.map(p => p.name.toLowerCase()));
  let n = 0;
  SEED.forEach(s => {
    if (have.has(s.name.toLowerCase())) return;
    state.platforms.push(normalize(s));
    n++;
  });
  save(); render();
  toast(n ? "Добавлено платформ: " + n : "Все платформы каталога уже в базе");
}

/* ==================================================================
   Управление способами оплаты
   ================================================================== */
function askPaymentFields(existing) {
  const e = existing || { name: "", note: "", currency: "₽" };
  return modal({
    title: existing ? "Способ оплаты: " + existing.name : "Новый способ оплаты",
    body: "<div class='note'>Только метка: «Карта Т-Банк», «Счёт в PayPal», «Карта мужа». " +
      "Номера карт, срок и CVV сюда вписывать не нужно.</div>" +
      "<div class='form'>" +
      "<div class='f wide'><label>Название *</label><input id='payName' value='" + esc(e.name) + "' placeholder='Карта №1'></div>" +
      "<div class='f wide'><label>Пометка</label><input id='payNote' value='" + esc(e.note) + "' placeholder='например: основная, до 2028'></div>" +
      "<div class='f'><label>Обычная валюта</label><select id='payCur'>" +
        CURRENCIES.map(c => "<option" + (c === e.currency ? " selected" : "") + ">" + c + "</option>").join("") + "</select></div>" +
      "</div>",
    buttons: [{ label: "Отмена", value: null }, { spacer: true }, {
      label: existing ? "Сохранить" : "Добавить", variant: "primary",
      validate: () => {
        const n = $("#payName").value.trim();
        if (!n) return "Введите название.";
        const dup = payByName(n);
        if (dup && (!existing || dup.id !== existing.id)) return "Такой способ уже есть в списке.";
        return null;
      },
      value: () => ({ name: $("#payName").value.trim(), note: $("#payNote").value.trim(), currency: $("#payCur").value })
    }]
  });
}

/* Быстрое создание сервиса оплаты: полная карточка заполняется потом, как у любой платформы */
function askServiceFields() {
  return modal({
    title: "Новый сервис оплаты",
    sub: "Посредник, конвертация, виртуальные карты",
    body: "<div class='note acc'>Сервис станет обычной карточкой каталога в категории «Оплата»: у него будет свой сайт, логин, пароль в сейфе и заметки. Здесь достаточно названия — остальное допишете в карточке.</div>" +
      "<div class='form'>" +
      "<div class='f wide'><label>Название *</label><input id='svcName' placeholder='например: Сервис-посредник'></div>" +
      "<div class='f wide'><label>Сайт</label><input id='svcUrl' placeholder='https://…'></div>" +
      "<div class='f wide'><label>Комиссия / условия</label><input id='svcNote' placeholder='например: +12% к сумме, минимум 500 ₽'></div>" +
      "</div>",
    buttons: [{ label: "Отмена", value: null }, { spacer: true }, {
      label: "Создать", variant: "primary",
      validate: () => {
        const n = $("#svcName").value.trim();
        if (!n) return "Введите название.";
        if (state.platforms.some(p => p.name.toLowerCase() === n.toLowerCase())) return "Платформа с таким названием уже есть в базе.";
        return null;
      },
      value: () => ({ name: $("#svcName").value.trim(), url: $("#svcUrl").value.trim(), note: $("#svcNote").value.trim() })
    }]
  });
}

async function showPayments() {
  for (;;) {
    const svcRows = payServices().map(s => {
      const u = payUsage(s.id);
      return "<div class='secretrow' style='align-items:flex-start'>" +
        "<span style='flex:1;min-width:130px'><b>💳 " + esc(s.name) + "</b>" +
          (s.plan.tier ? "<br><span style='color:var(--muted);font-size:12.5px'>" + esc(s.plan.tier) + "</span>" : "") +
          "<br><span style='color:var(--muted);font-size:12.5px'>" +
            (u.count ? "через него: " + u.count + " платф. · " + (u.money || "без оплаты") : "пока ничего не оплачивается") +
            (s.secret ? " · 🔑" : "") + "</span></span>" +
        "<button class='btn sm' type='button' data-pact='pick' data-id='" + s.id + "'>Показать</button>" +
        "<button class='btn sm' type='button' data-pact='card' data-id='" + s.id + "'>Карточка</button>" +
        "<button class='btn sm danger' type='button' data-pact='delsvc' data-id='" + s.id + "'>Удалить</button>" +
      "</div>";
    }).join("");

    const rows = state.payments.map(m => {
      const u = payUsage(m.id);
      return "<div class='secretrow' style='align-items:flex-start'>" +
        "<span style='flex:1;min-width:130px'><b>" + esc(m.name) + "</b>" +
          (m.note ? "<br><span style='color:var(--muted);font-size:12.5px'>" + esc(m.note) + "</span>" : "") +
          "<br><span style='color:var(--muted);font-size:12.5px'>" +
            (u.count ? u.count + " платф. · " + (u.money || "без оплаты") : "не используется") + "</span></span>" +
        "<button class='btn sm' type='button' data-pact='pick' data-id='" + m.id + "'>Показать</button>" +
        "<button class='btn sm' type='button' data-pact='edit' data-id='" + m.id + "'>Изменить</button>" +
        "<button class='btn sm danger' type='button' data-pact='del' data-id='" + m.id + "'>Удалить</button>" +
      "</div>";
    }).join("");

    const totals = {};
    state.platforms.forEach(p => {
      if (!p.plan.paymentId) return;
      const m = monthlyCost(p);
      if (m) totals[p.plan.currency || "₽"] = (totals[p.plan.currency || "₽"] || 0) + m;
    });
    const totalLine = Object.keys(totals).length
      ? "Всего по способам оплаты: <b>" + Object.keys(totals).map(c => fmtMoney(totals[c], c)).join(" + ") + "</b> в месяц"
      : "Пока ни одна платформа не привязана к способу оплаты";

    const res = await modal({
      title: "Оплата платформ",
      sub: "Сервисы-посредники и карты — общий список для всей базы",
      body:
        "<div class='sect'><h4>Сервисы оплаты</h4>" +
        (svcRows
          ? "<div class='secretbox'>" + svcRows + "</div>"
          : "<div class='note'>Сервисов пока нет. Посредник, конвертация или виртуальная карта заводится как обычная карточка каталога — со своим логином, паролем в сейфе и условиями.</div>") +
        "</div>" +
        "<div class='sect'><h4>Карты и счета</h4>" +
        (state.payments.length
          ? "<div class='secretbox'>" + rows + "</div>"
          : "<div class='note'>Меток пока нет. Это простые записи без сайта и логина — «Карта Т-Банк», «Наличными».</div>") +
        "</div>" +
        "<p style='margin:0;font-size:13.5px;color:var(--muted)'>" + totalLine + "</p>",
      buttons: [{ label: "Закрыть", value: null }, { spacer: true },
        { label: "+ Карта или счёт", value: { act: "add" } },
        { label: "+ Сервис оплаты", value: { act: "addsvc" }, variant: "primary" }],
      onOpen: body => {
        $$("[data-pact]", body).forEach(b => b.addEventListener("click", () =>
          closeDlg({ act: b.dataset.pact, id: b.dataset.id })));
      }
    });
    if (!res) { render(); return; }

    if (res.act === "add") {
      const f = await askPaymentFields(null);
      if (f) { addPayment(f.name, f.note, f.currency); save(); toast("Карта добавлена в список"); }
      continue;
    }
    if (res.act === "addsvc") {
      const f = await askServiceFields();
      if (f) {
        const s = addPaymentService(f.name, f.url, "");
        if (f.note) s.plan.tier = f.note;
        save(); render();
        toast("Сервис создан — допишите логин и условия в карточке");
        openEdit(s.id);
        return;
      }
      continue;
    }

    /* дальше — действия над конкретной записью: сервисом или картой */
    if (res.act === "card") { render(); openCard(res.id); return; }
    if (res.act === "pick") {
      const e = payEntity(res.id);
      filter.pay = res.id; filter.cat = ""; filter.status = "";
      render(); toast("Показано всё, что оплачивается через «" + (e ? e.name : "?") + "»");
      return;
    }
    if (res.act === "delsvc") {
      const s = state.platforms.find(x => x.id === res.id);
      if (!s) continue;
      const u = payUsage(s.id);
      const ok = await askConfirm("Удалить сервис «" + s.name + "»?",
        "Карточка сервиса и её секреты будут удалены из базы." +
        (u.count ? " К нему привязано платформ: " + u.count + " — они останутся, у них опустеет поле «Чем платим»." : ""),
        "Удалить", true);
      if (ok) deletePlatform(s.id);
      continue;
    }

    const m = payById(res.id);
    if (!m) continue;

    if (res.act === "edit") {
      const f = await askPaymentFields(m);
      if (f) { m.name = f.name; m.note = f.note; m.currency = f.currency; save(); toast("Сохранено"); }
      continue;
    }
    if (res.act === "pick") {
      filter.pay = m.id; filter.cat = ""; filter.status = "";
      render(); toast("Показаны платформы, оплаченные через «" + m.name + "»");
      return;
    }
    if (res.act === "del") {
      const u = payUsage(m.id);
      const ok = await askConfirm("Удалить способ «" + m.name + "»?",
        u.count
          ? "К нему привязано платформ: " + u.count + ". Сами платформы останутся, у них просто опустеет поле «Чем платим»."
          : "Способ не используется ни одной платформой.",
        "Удалить", true);
      if (ok) {
        const idx = state.payments.indexOf(m);
        const linked = state.platforms.filter(p => p.plan.paymentId === m.id).map(p => p.id);
        linked.forEach(x => { const t = byId(x); if (t) t.plan.paymentId = ""; });
        state.payments.splice(idx, 1);
        const prevFilter = filter.pay;
        if (filter.pay === m.id) filter.pay = "";
        save();
        toast("«" + m.name + "» удалён из списка", {
          label: "Вернуть",
          fn: () => {
            state.payments.splice(Math.min(idx, state.payments.length), 0, m);
            linked.forEach(x => { const t = byId(x); if (t) t.plan.paymentId = m.id; });
            filter.pay = prevFilter;
            save(); render(); toast("«" + m.name + "» восстановлен");
          }
        });
      }
      continue;
    }
  }
}

/* ==================================================================
   Справка
   ================================================================== */
function showHelp() {
  modal({
    title: "Как это работает",
    body:
      "<div class='sect'><h4>Где данные</h4><p>Всё лежит в этом браузере (localStorage) — файл ничего не отправляет в сеть и работает без интернета. Другой браузер или режим инкогнито = пустая база.</p></div>" +
      "<div class='sect'><h4>Сейф</h4><p>Пароли, API-ключи и приватные заметки шифруются AES-256 на ключе из вашего мастер-пароля. Мастер-пароль нигде не сохраняется: его нельзя восстановить, но и украсть из файла нельзя. Сейф сам закрывается через 10 минут без действий.</p></div>" +
      "<div class='sect'><h4>Бэкапы</h4><p>«Экспорт бэкапа» — полный файл, секреты в нём остаются зашифрованными, его можно спокойно держать в облаке. «Экспорт без доступов» — та же база без логинов и секретов, годится, чтобы поделиться списком платформ.</p></div>" +
      "<div class='sect'><h4>Оплата</h4><p>Платить можно двумя сущностями. <b>Сервис оплаты</b> (посредник, конвертация, виртуальные карты) — это полноценная карточка каталога в категории «Оплата»: со своим сайтом, логином, паролем в сейфе, комиссией и заметками. В его карточке видно, что через него оплачивается и на сколько в месяц. <b>Карта или счёт</b> — простая метка без сайта и логина.</p>" +
      "<p>И то и другое заводится в «⋯ → Оплата: сервисы и карты…» либо прямо в поле «Чем платим» карточки платформы. Там же удаляется, когда теряет актуальность: привязанные платформы остаются, у них просто опустеет поле «Чем платим». Селектом «Оплата:» в фильтрах выбирается всё, что платится конкретным сервисом или картой, и сводка сверху пересчитывается под выборку.</p></div>" +
      "<div class='sect' style='margin-bottom:0'><h4>Что не стоит писать</h4><p>Номера карт, CVV, коды из СМС. Для учёта достаточно метки вроде «карта №1».</p></div>",
    buttons: [{ spacer: true }, { label: "Понятно", value: null, variant: "primary" }]
  });
}

/* ==================================================================
   События
   ================================================================== */
$("#q").addEventListener("input", e => { filter.q = e.target.value; renderStats(); renderGrid(); });

$("#attention").addEventListener("click", e => {
  const item = e.target.closest("[data-attention]");
  if (!item) return;
  $("#cardOv").dataset.mode = "view";
  openCard(item.dataset.attention);
});

$("#filters").addEventListener("click", e => {
  const chip = e.target.closest(".chip");
  if (!chip) return;
  filter.cat = chip.dataset.cat;
  renderFilters(); renderStats(); renderGrid();
});
$("#filters").addEventListener("change", e => {
  if (e.target.id === "fStatus") filter.status = e.target.value;
  if (e.target.id === "fSort") filter.sort = e.target.value;
  if (e.target.id === "fPayFilter") {
    if (e.target.value === "__manage") { e.target.value = filter.pay; showPayments(); return; }
    filter.pay = e.target.value;
  }
  renderStats(); renderGrid();
});

$("#grid").addEventListener("click", async e => {
  const kill = e.target.closest("[data-kill]");
  if (kill) {
    const p = byId(kill.dataset.kill);
    if (!p) return;
    const used = payUsage(p.id);
    const ok = await askConfirm("Удалить «" + p.name + "» из базы?",
      "Карточка и её секреты исчезнут. Отменить это будет нельзя." +
      (used.count ? " Через неё оплачивается платформ: " + used.count + " — они останутся, у них опустеет поле «Чем платим»." : "") +
      (String(p.id).startsWith("seed-") ? " Вернуть её потом можно через «⋯ → Досыпать каталог платформ»." : ""),
      "Удалить", true);
    if (ok) deletePlatform(p.id);
    return;
  }
  if (e.target.closest("#addTile")) { openEdit(null); return; }
  const t = e.target.closest(".tile");
  if (t && t.dataset.id) { $("#cardOv").dataset.mode = "view"; openCard(t.dataset.id); }
});

$("#addBtn").addEventListener("click", () => openEdit(null));

$("#lockChip").addEventListener("click", () => {
  if (!isSetUp()) flowCreateMaster();
  else if (isUnlocked()) lockVault();
  else flowUnlock();
});

$("#banners").addEventListener("click", e => {
  if (e.target.dataset.act === "export") doExport(true);
});

$("#menu").addEventListener("click", async e => {
  const act = e.target.dataset.act;
  if (!act) return;
  $("#menu").open = false;
  if (act === "export") doExport(true);
  if (act === "exportOpen") doExport(false);
  if (act === "import") $("#fileIn").click();
  if (act === "payments") showPayments();
  if (act === "master") flowChangeMaster();
  if (act === "seed") addMissingSeed();
  if (act === "help") showHelp();
  if (act === "theme") {
    const next = document.documentElement.getAttribute("data-theme") === "light" ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", next);
    state.theme = next; save();
    toast(next === "light" ? "Светлая тема" : "Тёмная тема");
  }
});
document.addEventListener("click", e => {
  const m = $("#menu");
  if (m.open && !m.contains(e.target)) m.open = false;
});

$("#fileIn").addEventListener("change", e => {
  const f = e.target.files && e.target.files[0];
  if (!f) return;
  const r = new FileReader();
  r.onload = () => {
    let data = null;
    try { data = JSON.parse(r.result); } catch (err) { toast("Файл не читается как JSON"); return; }
    doImport(data);
  };
  r.readAsText(f);
  e.target.value = "";
});

/* выбор способа оплаты прямо в форме: «+ Новый способ…» и «⚙ Управление…» */
$("#cardOv").addEventListener("change", async e => {
  if (e.target.id !== "fPay") return;
  const sel = e.target;
  const prev = sel.dataset.prev || "";
  const own = openId || "";
  if (sel.value === "__new" || sel.value === "__newsvc") {
    const isSvc = sel.value === "__newsvc";
    let pick = prev;
    if (isSvc) {
      const f = await askServiceFields();
      if (f) {
        const s = addPaymentService(f.name, f.url, "");
        if (f.note) s.plan.tier = f.note;
        save(); pick = s.id;
        toast("Сервис создан — его карточку можно заполнить позже");
      }
    } else {
      const f = await askPaymentFields(null);
      if (f) { const m = addPayment(f.name, f.note, f.currency); save(); pick = m.id; toast("Карта добавлена в список"); }
    }
    sel.outerHTML = paySelectHTML(pick, own);
    $("#fPay").dataset.prev = pick;
    return;
  }
  if (sel.value === "__manage") {
    sel.value = prev;
    await showPayments();
    if (!$("#fPay")) return;                       // менеджер увёл на другую карточку
    const keep = payEntity(prev) ? prev : "";
    $("#fPay").outerHTML = paySelectHTML(keep, own);
    $("#fPay").dataset.prev = keep;
    return;
  }
  sel.dataset.prev = sel.value;
});

/* карточка: делегирование */
$("#cardOv").addEventListener("click", async e => {
  if (e.target === $("#cardOv")) {
    if ($("#cardOv").dataset.mode === "edit") return;   // случайный клик мимо формы не закрывает
    closeCard(); return;
  }
  if (e.target.closest("[data-close]")) { closeCard(); return; }
  const btn = e.target.closest("button");
  if (!btn) return;
  const act = btn.dataset.act;
  const cp = btn.dataset.copy;
  const p = openId ? byId(openId) : null;

  if (cp === "login" && p) copyAndClear(p.account.login, "Логин");
  if (cp === "pw" && openSecret) copyAndClear(openSecret.password, "Пароль");
  if (cp === "ak" && openSecret) copyAndClear(openSecret.apiKey, "API-ключ");
  if (act === "reveal" && openSecret) revealInto("#pwCell", openSecret.password, btn);
  if (act === "revealAk" && openSecret) revealInto("#akCell", openSecret.apiKey, btn);
  if (act === "unlockHere") { const ok = await flowUnlock(); if (ok && openId) openCard(openId); }
  if (act === "goPay" && btn.dataset.id) { $("#cardOv").dataset.mode = "view"; openCard(btn.dataset.id); return; }
  if (act === "edit" && p) openEdit(p.id);
  if (act === "cancelEdit") {
    $("#cardOv").dataset.mode = "";
    if (openId && byId(openId)) openCard(openId); else closeCard();
  }
  if (act === "saveEdit") saveEdit();
  if (act === "peek") {
    const inp = $("#" + btn.dataset.target);
    inp.type = inp.type === "password" ? "text" : "password";
  }
  if (act === "del" && p) {
    const used = payUsage(p.id);
    const ok = await askConfirm("Удалить «" + p.name + "»?",
      "Запись и её секреты исчезнут из базы. Отменить это будет нельзя." +
      (used.count ? " Через неё оплачивается платформ: " + used.count + " — они останутся, у них опустеет поле «Чем платим»." : ""),
      "Удалить", true);
    if (ok) deletePlatform(p.id);
  }
});
$("#dlgOv").addEventListener("click", e => {
  if (e.target === $("#dlgOv") || e.target.closest("[data-close]")) closeDlg(null);
});
document.addEventListener("keydown", e => {
  if (e.key === "Escape") {
    if (!$("#dlgOv").hidden) { closeDlg(null); return; }
    if (!$("#cardOv").hidden && $("#cardOv").dataset.mode !== "edit") closeCard();
  }
  if (e.key === "/" && document.activeElement === document.body) { e.preventDefault(); $("#q").focus(); }
});

/* ==================================================================
   Каталог платформ (сид). Цены и особенности регистрации
   намеренно пустые — они зависят от региона и быстро меняются.
   ================================================================== */
const SEED = [
{ name:"GetCourse", url:"https://getcourse.ru/", category:"Обучение", pinned:true,
  purpose:"Платформа, на которой идёт само обучение по ИИ: уроки, домашние задания, записи вебинаров и материалы курса.",
  strengths:"Всё обучение в одном кабинете: расписание, задания с проверкой, записи занятий, чаты потока.",
  tips:["Впишите в «Ссылку на вход» адрес кабинета именно вашей школы — у GetCourse это отдельный поддомен, общий getcourse.ru нужен только как точка входа.",
        "Записи вебинаров и материалы обычно в разделе «Мои курсы» → нужный урок; полезные ссылки из уроков сразу заносите в эту базу.",
        "Письма о занятиях приходят на почту аккаунта — проверьте, что это ваш рабочий email."],
  tags:["обучение","курс"] },

{ name:"Claude", url:"https://claude.ai", category:"Текст/ассистенты",
  purpose:"Чат-ассистент Anthropic: длинные тексты, аналитика, разбор документов, код, интерактивные артефакты.",
  strengths:"Большое контекстное окно и аккуратная работа с длинными документами, Артефакты (готовые страницы и приложения прямо в чате), Проекты с постоянным контекстом.",
  tips:["Заводите отдельный Проект на каждую тему и складывайте туда файлы-контекст — не придётся объяснять всё заново.",
        "Перед большой задачей просите сначала план, потом исполнение.",
        "Артефакты удобно сохранять и переиспользовать как шаблоны."],
  tags:["текст","анализ","код"] },

{ name:"Claude Code", url:"https://claude.com/product/claude-code", category:"Код",
  purpose:"Агент Claude в терминале и IDE: читает и правит файлы проекта, запускает команды, работает с git.",
  strengths:"Работает с реальными файлами на диске, помнит правила проекта через CLAUDE.md, расширяется навыками и хуками.",
  tips:["Положите в корень проекта CLAUDE.md с описанием проекта и правилами — экономит объяснения в каждой сессии.",
        "Для крупных правок сначала план-режим, только потом запуск.",
        "Тот же аккаунт и подписка, что у Claude в браузере."],
  tags:["код","агент","терминал"] },

{ name:"ChatGPT", url:"https://chatgpt.com", category:"Текст/ассистенты",
  purpose:"Чат-ассистент OpenAI: текст, изображения, анализ файлов, голосовой режим, кастомные GPT.",
  strengths:"Живой голосовой режим, генерация картинок внутри чата, магазин готовых GPT под узкие задачи.",
  tips:["В настройках персонализации один раз опишите, кто вы и как вам отвечать — это работает во всех чатах.",
        "Под повторяющиеся задачи собирайте свой GPT вместо копирования промпта.",
        "Аккаунт общий с Sora и API-платформой OpenAI."],
  tags:["текст","картинки","голос"] },

{ name:"Google Gemini", url:"https://gemini.google.com", category:"Текст/ассистенты",
  purpose:"Ассистент Google: работа с большими файлами, связка с Gmail, Диском и Документами.",
  strengths:"Очень длинный контекст (можно скормить целую книгу или большой PDF) и интеграция с сервисами Google.",
  tips:["Входите тем же Google-аккаунтом, где живут ваш Диск и почта — иначе интеграции бесполезны.",
        "Один аккаунт открывает Gemini, Flow, NotebookLM и AI Studio — держите его основным для Google-инструментов."],
  tags:["текст","google","большой контекст"] },

{ name:"Perplexity", url:"https://www.perplexity.ai", category:"Текст/ассистенты",
  purpose:"Поисковик-ассистент: отвечает по свежим данным из интернета и показывает источники.",
  strengths:"Ответ со ссылками, которые можно проверить; режимы глубокого исследования; коллекции по темам.",
  tips:["Когда важна точность — прямо просите перечислить источники и даты.",
        "Заводите Space под каждое исследование, чтобы контекст не смешивался."],
  tags:["поиск","факты","research"] },

{ name:"DeepSeek", url:"https://chat.deepseek.com", category:"Текст/ассистенты",
  purpose:"Чат-модель с сильным логическим выводом и открытыми весами, очень дешёвый API.",
  strengths:"Соотношение цена/качество: годится для потоковой генерации и черновиков, есть режим размышления.",
  tips:["Хороший вариант для массовой рутины, когда топ-модель не нужна.",
        "Если работаете через API — ключ храните в сейфе этой базы, а не в коде."],
  tags:["текст","дешёвый api"] },

{ name:"Grok", url:"https://grok.com", category:"Текст/ассистенты",
  purpose:"Ассистент xAI с доступом к контенту соцсети X — полезен для актуальных тем и трендов.",
  strengths:"Реакция на происходящее прямо сейчас, свободный тон, генерация изображений.",
  tips:["Аккаунт связан с профилем X — если его нет, регистрация начнётся с него."],
  tags:["текст","тренды"] },

{ name:"NotebookLM", url:"https://notebooklm.google.com", category:"Текст/ассистенты",
  purpose:"Рабочая тетрадь по вашим материалам: загружаете PDF, ссылки, видео — получаете конспекты, ответы и аудиообзор.",
  strengths:"Отвечает только по загруженным источникам и ссылается на них — почти не выдумывает; умеет делать подкаст-обзор.",
  tips:["Идеально под конспекты курса: залейте материалы урока и слушайте аудиообзор по дороге.",
        "Один блокнот = одна тема, иначе ответы расплываются."],
  tags:["обучение","конспекты","google"] },

{ name:"Cursor", url:"https://cursor.com", category:"Код",
  purpose:"Редактор кода на базе VS Code с ИИ-агентом внутри: правки по всему проекту, чат по кодовой базе.",
  strengths:"Привычный VS Code плюс агент, который видит проект целиком; умное автодополнение.",
  tips:["При первом запуске можно перенести расширения и настройки из VS Code одним нажатием.",
        "Правила проекта задаются файлом правил — аналог CLAUDE.md."],
  tags:["код","ide"] },

{ name:"GitHub Copilot", url:"https://github.com/features/copilot", category:"Код",
  purpose:"ИИ-автодополнение и чат прямо в редакторе, ревью пул-реквестов.",
  strengths:"Живёт внутри IDE и не требует переключения контекста; тесная связка с GitHub.",
  tips:["Нужен аккаунт GitHub — заведите его до подписки.",
        "Студентам и авторам открытых проектов доступ обычно бесплатный — проверьте право на льготу."],
  tags:["код","ide","github"] },

{ name:"v0", url:"https://v0.app", category:"Код",
  purpose:"Генерация интерфейсов и React-компонентов по текстовому описанию, с предпросмотром и экспортом кода.",
  strengths:"Быстрый путь от идеи до рабочего прототипа UI; аккуратный современный код.",
  tips:["Вход через аккаунт Vercel — он же понадобится для публикации результата.",
        "Просите компонент по частям: сначала структура, потом стили."],
  tags:["ui","прототип","react"] },

{ name:"Midjourney", url:"https://www.midjourney.com", category:"Изображения",
  purpose:"Генератор изображений с очень сильной картинкой «из коробки»: концепты, иллюстрации, референсы.",
  strengths:"Эстетика и детализация, богатые стили, инструменты ретуши, апскейла и вариаций.",
  tips:["Записывайте удачные параметры (--ar, --style, ссылки на референсы) — половина результата в них.",
        "Раньше работал только через Discord, теперь есть веб-версия; аккаунт может быть привязан к Discord.",
        "Свои удачные промпты храните в заметках карточки платформы."],
  tags:["картинки","иллюстрации"] },

{ name:"Recraft", url:"https://www.recraft.ai", category:"Изображения",
  purpose:"Генератор изображений и настоящей векторной графики — сделан под дизайнеров.",
  strengths:"Выдаёт редактируемый SVG, держит единый стиль в серии, умеет брендовые наборы стилей.",
  tips:["Незаменим, когда картинка должна лечь в макет как вектор — иконки, логотипы, паттерны.",
        "Создайте свой стиль по референсам, чтобы вся серия выглядела одинаково."],
  tags:["вектор","svg","дизайн"] },

{ name:"Ideogram", url:"https://ideogram.ai", category:"Изображения",
  purpose:"Генератор изображений, который лучше других рисует текст внутри картинки.",
  strengths:"Читаемые надписи, логотипы, плакаты и обложки; аккуратная типографика.",
  tips:["Текст для картинки берите в кавычки в промпте.",
        "Первый выбор для афиш, обложек и постов с надписями."],
  tags:["картинки","типографика","постеры"] },

{ name:"Krea", url:"https://www.krea.ai", category:"Изображения",
  purpose:"Генерация и улучшение изображений в реальном времени: рисуете набросок — видите результат сразу.",
  strengths:"Real-time canvas, мощный апскейл до печатного размера, обучение своего стиля.",
  tips:["Удобно доводить чужой или свой рендер: набросок → уточнение → апскейл.",
        "Хорошо работает в паре с Midjourney: там картинка, здесь доработка."],
  tags:["картинки","апскейл","realtime"] },

{ name:"Leonardo", url:"https://leonardo.ai", category:"Изображения",
  purpose:"Генератор изображений с готовыми моделями и тонким контролем композиции; много ассетов для игр.",
  strengths:"Контроль позы и композиции, собственные обученные модели, пакетная генерация.",
  tips:["Смотрите готовые модели сообщества — часто быстрее, чем настраивать с нуля."],
  tags:["картинки","игры"] },

{ name:"Adobe Firefly", url:"https://firefly.adobe.com", category:"Изображения",
  purpose:"Генеративные инструменты Adobe: изображения, заливка, замена объектов; встроены в Photoshop и Illustrator.",
  strengths:"Обучен на лицензионном контенте — спокойнее с коммерческим использованием; генеративная заливка в Photoshop.",
  tips:["Аккаунт — общий Adobe ID; если уже работаете в Photoshop, часть возможностей уже у вас есть.",
        "Генеративная заливка сильнее самой генерации с нуля."],
  tags:["картинки","adobe","коммерческое"] },

{ name:"ComfyUI", url:"https://github.com/comfyanonymous/ComfyUI", category:"Изображения",
  purpose:"Локальный узловой интерфейс для Stable Diffusion и Flux: генерация изображений и видео на своём компьютере.",
  strengths:"Бесплатно и без лимитов, полный контроль над процессом, любые модели и дополнения. Нужна нормальная видеокарта.",
  tips:["Регистрация не нужна — ставится локально, аккаунта нет вообще.",
        "Модели весят десятки гигабайт: качайте заранее и складывайте в одну папку.",
        "Готовые workflow сообщества экономят недели изучения."],
  tags:["локально","бесплатно","stable diffusion"] },

{ name:"Google Flow", url:"https://labs.google/flow", category:"Видео",
  purpose:"Киноинструмент Google на моделях Veo: генерация видеосцен по описанию и кадрам, сборка сцен в историю.",
  strengths:"Качество и звук моделей Veo, работа сценами и кадрами, управление камерой.",
  tips:["Вход Google-аккаунтом; объём генераций зависит от уровня подписки Google AI — уточните лимиты до оплаты.",
        "Работайте короткими сценами и склеивайте: так предсказуемее, чем один длинный промпт.",
        "Первый кадр-референс сильно повышает попадание в задумку."],
  tags:["видео","veo","google"] },

{ name:"Sora", url:"https://sora.com", category:"Видео",
  purpose:"Генератор видео OpenAI: из текста или картинки, с ремиксом и продолжением сцен.",
  strengths:"Связность сцены и физика движения, ремиксы чужих работ, лента с примерами.",
  tips:["Аккаунт общий с ChatGPT.",
        "Оживление своей картинки обычно даёт более управляемый результат, чем генерация с нуля."],
  tags:["видео","openai"] },

{ name:"Kling", url:"https://klingai.com", category:"Видео",
  purpose:"Генератор видео: оживление статичных изображений, липсинк, длинные клипы.",
  strengths:"Хорошо двигает объекты в кадре из одной картинки, есть синхронизация губ под озвучку.",
  tips:["Связка «картинка из Midjourney → движение в Kling» — рабочая схема для роликов.",
        "Ставьте начальный и конечный кадр, чтобы задать движение."],
  tags:["видео","оживление","липсинк"] },

{ name:"Runway", url:"https://runwayml.com", category:"Видео",
  purpose:"Видеоредактор с ИИ: генерация, удаление объектов, замена фона, управление движением кистью.",
  strengths:"Это ещё и постпродакшн, а не только генерация: чистка кадра, ротоскоп, апскейл.",
  tips:["Motion brush задаёт, что именно двигается в кадре — точнее, чем описание словами."],
  tags:["видео","монтаж","постпродакшн"] },

{ name:"HeyGen", url:"https://www.heygen.com", category:"Видео",
  purpose:"Видео с говорящим аватаром: обучающие ролики без съёмки, перевод и липсинк на другие языки.",
  strengths:"Аватар по вашему короткому видео, дубляж с сохранением голоса, шаблоны под обучение.",
  tips:["Для своего аватара нужно записать образец видео и подтвердить согласие.",
        "Удобно делать одну и ту же лекцию на нескольких языках."],
  tags:["видео","аватар","дубляж"] },

{ name:"ElevenLabs", url:"https://elevenlabs.io", category:"Аудио",
  purpose:"Синтез речи и клонирование голоса, дубляж видео, звуковые эффекты.",
  strengths:"Очень естественная русская речь, клон своего голоса, тонкая настройка подачи.",
  tips:["Сохраняйте в заметках идентификатор удачного голоса и настройки стабильности — иначе не повторите звучание.",
        "Длинный текст читайте кусками: меньше срывов интонации.",
        "Есть API — ключ храните в сейфе этой базы."],
  tags:["озвучка","голос","дубляж"] },

{ name:"Suno", url:"https://suno.com", category:"Аудио",
  purpose:"Генерация музыки и песен с вокалом по описанию или своему тексту.",
  strengths:"Полный трек с вокалом за пару минут, много стилей, продление и переработка трека.",
  tips:["Свой текст вставляйте в режиме Custom, иначе модель напишет его сама.",
        "Стиль задавайте жанром и инструментами, а не названиями групп."],
  tags:["музыка","вокал"] },

{ name:"Figma", url:"https://www.figma.com", category:"Дизайн и презентации",
  purpose:"Основной инструмент интерфейсного дизайна: макеты, компоненты, прототипы, совместная работа.",
  strengths:"Стандарт индустрии, богатая экосистема плагинов (в том числе к ИИ-сервисам), удобная передача в разработку.",
  tips:["Плагины связывают Figma с генераторами картинок и текста — ищите по названию нужного сервиса.",
        "Аккаунт удобно завести на тот же email, что и остальные рабочие сервисы."],
  tags:["дизайн","ui","макеты"] },

{ name:"Canva", url:"https://www.canva.com", category:"Дизайн и презентации",
  purpose:"Быстрый визуал по шаблонам: посты, презентации, обложки, видео; ИИ-инструменты Magic Studio.",
  strengths:"Результат без навыков дизайна: огромная база шаблонов, ИИ-заливка и удаление фона, единый бренд-кит.",
  tips:["Заведите бренд-кит с цветами и шрифтами — все материалы станут единообразными.",
        "Подходит, когда нужно быстро и прилично, а не идеально."],
  tags:["шаблоны","соцсети","презентации"] },

{ name:"Gamma", url:"https://gamma.app", category:"Дизайн и презентации",
  purpose:"Презентации, документы и лендинги из текста: даёте конспект — получаете готовые слайды.",
  strengths:"От промпта или конспекта до презентабельного дека за минуты, аккуратные темы, экспорт в PDF и PowerPoint.",
  tips:["Залейте конспект урока — получите презентацию для повторения материала.",
        "Правьте текст прямо на слайдах: оформление подстроится само."],
  tags:["презентации","слайды"] },

{ name:"n8n", url:"https://n8n.io", category:"Автоматизация",
  purpose:"Визуальный конструктор автоматизаций и ИИ-агентов: связывает сервисы, обрабатывает данные, ходит в LLM по API.",
  strengths:"Сотни интеграций, ветвления и код внутри нод, можно поднять у себя бесплатно.",
  tips:["API-ключи вносите в Credentials n8n, а не в текст нод — иначе они попадут в экспорт сценария.",
        "Начните с готового шаблона из библиотеки и переделайте под себя."],
  tags:["автоматизация","агенты","api"] },

{ name:"Make", url:"https://www.make.com", category:"Автоматизация",
  purpose:"Облачные сценарии-автоматизации без кода: связки между сервисами по расписанию и событиям.",
  strengths:"Наглядный визуальный конструктор, много готовых модулей, ничего не нужно ставить.",
  tips:["Считайте операции: тарифы упираются в их количество, а не в число сценариев.",
        "Тестируйте сценарий по шагам, прежде чем включать по расписанию."],
  tags:["автоматизация","no-code"] }
];

/* ==================================================================
   Старт
   ================================================================== */
load();
migratePayments();
document.documentElement.setAttribute("data-theme", state.theme === "light" ? "light" : "dark");
render();
