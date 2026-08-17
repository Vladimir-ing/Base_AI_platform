"use strict";

(function initAuthPage() {
  const client = window.supabaseClient;
  const params = new URLSearchParams(window.location.search);
  const message = document.getElementById("authMessage");
  const tabs = document.getElementById("authTabs");
  const panels = Array.from(document.querySelectorAll("[data-auth-panel]"));
  const languageButtons = Array.from(document.querySelectorAll("[data-language]"));
  const translated = Array.from(document.querySelectorAll("[data-ru][data-en]"));
  const initialView = params.get("view") === "signup" ? "signup" : "login";
  const LANGUAGE_KEY = "ai-core-lang-v1";
  const LEGACY_LANGUAGE_KEY = "aicore_language";
  let language = "ru";
  let activeMessage = null;

  const messages = {
    ru: {
      invalidCredentials: "Неверный email или пароль.",
      emailNotConfirmed: "Сначала подтвердите email по ссылке из письма.",
      weakPassword: "Пароль не соответствует требованиям безопасности.",
      rateLimit: "Слишком много попыток. Повторите позже.",
      requestFailed: "Не удалось выполнить запрос. Проверьте соединение и попробуйте снова.",
      confirmEmail: "Проверьте почту и подтвердите регистрацию по ссылке в письме.",
      resetSent: "Если аккаунт существует, ссылка для смены пароля отправлена на email.",
      passwordChanged: "Пароль изменён. Открываю приложение…",
      enterNewPassword: "Введите новый пароль для аккаунта.",
      signedOut: "Вы вышли из аккаунта.",
      sessionExpired: "Сессия завершена. Войдите снова.",
      authRequired: "Для доступа необходимо войти.",
      authUnavailable: "Не удалось проверить сессию. Попробуйте войти снова."
    },
    en: {
      invalidCredentials: "Incorrect email or password.",
      emailNotConfirmed: "Confirm your email using the link in the message first.",
      weakPassword: "The password does not meet the security requirements.",
      rateLimit: "Too many attempts. Please try again later.",
      requestFailed: "The request failed. Check your connection and try again.",
      confirmEmail: "Check your inbox and confirm registration using the link in the email.",
      resetSent: "If the account exists, a password reset link has been sent by email.",
      passwordChanged: "Password updated. Opening the app…",
      enterNewPassword: "Enter a new password for your account.",
      signedOut: "You have signed out.",
      sessionExpired: "Your session has ended. Sign in again.",
      authRequired: "Sign in to continue.",
      authUnavailable: "The session could not be verified. Please sign in again."
    }
  };

  function appUrl() {
    const requested = params.get("next");
    const safePath = ["ai-platforms.html", "admin.html"].includes(requested) ? requested : "ai-platforms.html";
    return new URL(safePath, window.location.href).href;
  }

  function readLanguage() {
    try {
      return localStorage.getItem(LANGUAGE_KEY) || localStorage.getItem(LEGACY_LANGUAGE_KEY);
    } catch (_) {
      return null;
    }
  }

  function setLanguage(nextLanguage) {
    language = nextLanguage === "en" ? "en" : "ru";
    document.documentElement.lang = language;
    document.title = language === "ru" ? "Вход — AI CORE" : "Sign In — AI CORE";
    translated.forEach(element => { element.textContent = element.dataset[language]; });
    languageButtons.forEach(button => {
      const active = button.dataset.language === language;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });
    tabs.setAttribute("aria-label", language === "ru" ? "Способ доступа" : "Access method");
    try { localStorage.setItem(LANGUAGE_KEY, language); } catch (_) {}
    if (activeMessage) renderMessage();
  }

  function renderMessage() {
    message.textContent = messages[language][activeMessage.key];
    message.className = "auth-message " + activeMessage.type;
    message.hidden = false;
  }

  function showMessage(key, type) {
    activeMessage = { key, type: type || "info" };
    renderMessage();
  }

  function clearMessage() {
    activeMessage = null;
    message.hidden = true;
    message.textContent = "";
  }

  function setView(view) {
    clearMessage();
    panels.forEach(panel => { panel.hidden = panel.dataset.authPanel !== view; });
    document.querySelectorAll(".auth-tab").forEach(tab => {
      const active = tab.dataset.authView === view;
      tab.classList.toggle("active", active);
      tab.setAttribute("aria-selected", String(active));
    });
    tabs.hidden = view === "recovery" || view === "new-password";
  }

  function setBusy(form, busy) {
    Array.from(form.elements).forEach(element => { element.disabled = busy; });
  }

  function readableError(error) {
    const text = String(error && error.message || "").toLowerCase();
    if (text.includes("invalid login credentials")) return "invalidCredentials";
    if (text.includes("email not confirmed")) return "emailNotConfirmed";
    if (text.includes("password")) return "weakPassword";
    if (text.includes("rate limit")) return "rateLimit";
    return "requestFailed";
  }

  languageButtons.forEach(button => {
    button.addEventListener("click", () => setLanguage(button.dataset.language));
  });

  document.addEventListener("click", event => {
    const control = event.target.closest("[data-auth-view]");
    if (control) setView(control.dataset.authView);
  });

  document.getElementById("forgotBtn").addEventListener("click", () => setView("recovery"));

  document.getElementById("loginForm").addEventListener("submit", async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    clearMessage();
    setBusy(form, true);
    const { error } = await client.auth.signInWithPassword({
      email: String(values.get("email") || "").trim(),
      password: String(values.get("password") || "")
    });
    setBusy(form, false);
    if (error) {
      showMessage(readableError(error), "error");
      return;
    }
    window.location.replace(appUrl());
  });

  document.getElementById("signupForm").addEventListener("submit", async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    const email = String(values.get("email") || "").trim();
    const password = String(values.get("password") || "");
    clearMessage();
    setBusy(form, true);
    const { data, error } = await client.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: appUrl() }
    });
    setBusy(form, false);
    if (error) {
      showMessage(readableError(error), "error");
      return;
    }
    if (data.session) {
      window.location.replace(appUrl());
      return;
    }
    form.reset();
    showMessage("confirmEmail", "success");
  });

  document.getElementById("recoveryForm").addEventListener("submit", async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    const email = String(values.get("email") || "").trim();
    clearMessage();
    setBusy(form, true);
    const { error } = await client.auth.resetPasswordForEmail(email, {
      redirectTo: new URL("login.html", window.location.href).href
    });
    setBusy(form, false);
    if (error) {
      showMessage(readableError(error), "error");
      return;
    }
    form.reset();
    showMessage("resetSent", "success");
  });

  document.getElementById("newPasswordForm").addEventListener("submit", async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    clearMessage();
    setBusy(form, true);
    const { error } = await client.auth.updateUser({
      password: String(values.get("password") || "")
    });
    setBusy(form, false);
    if (error) {
      showMessage(readableError(error), "error");
      return;
    }
    showMessage("passwordChanged", "success");
    window.setTimeout(() => window.location.replace(appUrl()), 700);
  });

  client.auth.onAuthStateChange((event, session) => {
    if (event === "PASSWORD_RECOVERY") {
      setView("new-password");
      showMessage("enterNewPassword", "info");
      return;
    }
    if (event === "SIGNED_IN" && session && !window.location.hash) {
      window.location.replace(appUrl());
    }
  });

  client.auth.getSession().then(({ data }) => {
    if (data.session && params.get("mode") !== "recovery" && !window.location.hash) {
      window.location.replace(appUrl());
    }
  });

  setLanguage(readLanguage());
  setView(initialView);

  const reason = params.get("reason");
  if (reason === "signed_out") showMessage("signedOut", "success");
  if (reason === "session_expired") showMessage("sessionExpired", "info");
  if (reason === "auth_required") showMessage("authRequired", "info");
  if (reason === "auth_unavailable") showMessage("authUnavailable", "error");
})();
