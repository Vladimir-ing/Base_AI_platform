"use strict";

(function initLandingLanguage() {
  const languageButtons = Array.from(document.querySelectorAll("[data-language]"));
  const translated = Array.from(document.querySelectorAll("[data-ru][data-en]"));
  const LANGUAGE_KEY = "ai-core-lang-v1";
  const LEGACY_LANGUAGE_KEY = "aicore_language";
  let stored = null;
  try {
    stored = localStorage.getItem(LANGUAGE_KEY) || localStorage.getItem(LEGACY_LANGUAGE_KEY);
  } catch (_) {}

  function setLanguage(language) {
    const selected = language === "en" ? "en" : "ru";
    document.documentElement.lang = selected;
    translated.forEach(element => { element.textContent = element.dataset[selected]; });
    languageButtons.forEach(button => {
      const active = button.dataset.language === selected;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });
    document.title = selected === "ru"
      ? "AI CORE — управляйте AI-инструментами в одном месте"
      : "AI CORE — manage all your AI tools in one place";
    try { localStorage.setItem(LANGUAGE_KEY, selected); } catch (_) {}
  }

  languageButtons.forEach(button => {
    button.addEventListener("click", () => setLanguage(button.dataset.language));
  });

  setLanguage(stored === "en" ? "en" : "ru");
})();
