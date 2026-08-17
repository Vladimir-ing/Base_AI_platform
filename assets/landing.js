"use strict";

const LANDING_LANG_KEY = "ai-core-lang-v1";
const COPY = {
  ru: {
    navFeatures:"Возможности", navAssistant:"AI-помощник", navSubscriptions:"Подписки", navSignIn:"Войти", navStart:"Начать",
    eyebrow:"Персональная операционная система для AI",
    heroTitle:"AI CORE", heroSub:"Ваш персональный центр управления AI-инструментами",
    heroText:"Соберите AI-сервисы в одном месте, контролируйте подписки, сравнивайте платформы и получайте умные рекомендации.",
    heroStart:"Начать", heroExplore:"Посмотреть возможности", trust:"Ваши данные и доступы остаются под вашим контролем.",
    metricTools:"AI-инструменты", metricSpend:"Расходы / месяц", metricAttention:"Требуют внимания", assistantQuestion:"Какие подписки стоит пересмотреть?", assistantAnswer:"3 сервиса используются редко. Потенциальная экономия — $42/мес.",
    featKicker:"Возможности", featTitle:"Всё необходимое для управления вашим AI-стеком", featText:"От каталога инструментов до расходов и персональных рекомендаций — в одном интерфейсе.",
    f1t:"AI-инструменты", f1d:"Храните используемые платформы в едином рабочем пространстве.", f2t:"Контроль подписок", f2d:"Следите за продлениями, расходами и сервисами, которыми почти не пользуетесь.", f3t:"Сравнение платформ", f3d:"Сравнивайте сервисы по задачам, стоимости, рейтингу и использованию.", f4t:"AI-помощник", f4d:"Задавайте вопросы по собственной базе AI-инструментов.",
    stmt1:"Не очередной каталог AI-сервисов.", stmt2:"Ваша персональная операционная система для AI.",
    flow1:"Найти", flow2:"Организовать", flow3:"Сравнить", flow4:"Оптимизировать", flow5:"Спросить AI",
    ecoKicker:"Экономика AI", ecoTitle:"Не платите за сервисы, которыми не пользуетесь.", ecoText:"AI CORE помогает увидеть стоимость AI-стека, ближайшие продления и кандидатов на пересмотр.", ecoSpend:"Расходы в месяц", ecoSaving:"Потенциальная экономия: $58/мес.",
    aiKicker:"AI-помощник", aiTitle:"Спросите свой AI-стек", aiText:"Помощник анализирует данные ваших карточек и помогает выбирать уже доступные вам инструменты.", aiQ:"Чем мне лучше сделать презентацию?", aiA:"По вашей базе: Gamma — лучший общий вариант, Canva — для быстрого дизайна. У вас уже есть подписка Gamma.",
    ctaTitle:"Возьмите свой AI-стек под контроль.", ctaText:"Создайте свой AI CORE и управляйте инструментами, расходами и знаниями из одного места.", ctaBtn:"Создать AI CORE",
    footer:"AI CORE · Your AI Control Center", privacy:"Конфиденциальность", terms:"Условия", contact:"Контакты"
  },
  en: {
    navFeatures:"Features", navAssistant:"AI Assistant", navSubscriptions:"Subscriptions", navSignIn:"Sign In", navStart:"Get Started",
    eyebrow:"Your personal operating system for AI",
    heroTitle:"AI CORE", heroSub:"Your AI Control Center",
    heroText:"Organize your AI tools, track subscriptions, compare platforms, and get smart recommendations — all in one place.",
    heroStart:"Get Started", heroExplore:"Explore Features", trust:"Your data and access stay under your control.",
    metricTools:"AI Tools", metricSpend:"Monthly Spend", metricAttention:"Needs Attention", assistantQuestion:"Which subscriptions should I reconsider?", assistantAnswer:"3 tools are rarely used. Potential saving: $42/month.",
    featKicker:"Features", featTitle:"Everything you need to manage your AI stack", featText:"From your tool catalog to subscription costs and personal recommendations — in one interface.",
    f1t:"AI Tools", f1d:"Keep every AI platform you use in one organized workspace.", f2t:"Subscription Control", f2d:"Track renewals, monthly costs, and tools you barely use.", f3t:"Compare Platforms", f3d:"Compare AI tools by purpose, price, rating, and usage.", f4t:"AI Assistant", f4d:"Ask questions about your own AI ecosystem.",
    stmt1:"Not another AI directory.", stmt2:"Your personal AI operating system.",
    flow1:"Discover", flow2:"Organize", flow3:"Compare", flow4:"Optimize", flow5:"Ask AI",
    ecoKicker:"AI Economics", ecoTitle:"Stop paying for AI tools you don't use.", ecoText:"AI CORE helps you see your AI-stack costs, upcoming renewals, and subscriptions worth reviewing.", ecoSpend:"Monthly AI spend", ecoSaving:"Potential saving: $58/month",
    aiKicker:"AI Assistant", aiTitle:"Ask your AI stack", aiText:"The assistant analyzes your own cards and helps you choose tools you already have access to.", aiQ:"What should I use for presentations?", aiA:"Based on your stack: Gamma is the best overall match, Canva is best for quick design. You already pay for Gamma.",
    ctaTitle:"Take control of your AI stack.", ctaText:"Build your AI CORE and manage tools, costs, and knowledge from one place.", ctaBtn:"Create your AI CORE",
    footer:"AI CORE · Your AI Control Center", privacy:"Privacy", terms:"Terms", contact:"Contact"
  }
};

function initialLang(){
  const saved = localStorage.getItem(LANDING_LANG_KEY);
  if(saved === "ru" || saved === "en") return saved;
  return (navigator.language || "ru").toLowerCase().startsWith("ru") ? "ru" : "en";
}

function applyLang(lang){
  const t = COPY[lang] || COPY.ru;
  document.documentElement.lang = lang;
  document.title = lang === "ru" ? "AI CORE — Ваш центр управления AI" : "AI CORE — Your AI Control Center";
  document.querySelectorAll("[data-copy]").forEach(el => {
    const key = el.dataset.copy;
    if(t[key] != null) el.textContent = t[key];
  });
  document.querySelectorAll("[data-lang]").forEach(btn => btn.classList.toggle("active", btn.dataset.lang === lang));
  localStorage.setItem(LANDING_LANG_KEY, lang);
}

document.addEventListener("DOMContentLoaded", () => {
  applyLang(initialLang());
  document.querySelectorAll("[data-lang]").forEach(btn => btn.addEventListener("click", () => applyLang(btn.dataset.lang)));
});
