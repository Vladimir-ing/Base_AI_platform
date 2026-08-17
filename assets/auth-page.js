"use strict";

(function initAuthPage() {
  const client = window.supabaseClient;
  const params = new URLSearchParams(window.location.search);
  const message = document.getElementById("authMessage");
  const tabs = document.getElementById("authTabs");
  const panels = Array.from(document.querySelectorAll("[data-auth-panel]"));
  const initialView = params.get("view") === "signup" ? "signup" : "login";

  function appUrl() {
    const requested = params.get("next");
    const safePath = ["ai-platforms.html", "admin.html"].includes(requested) ? requested : "ai-platforms.html";
    return new URL(safePath, window.location.href).href;
  }

  function showMessage(text, type) {
    message.textContent = text;
    message.className = "auth-message " + (type || "info");
    message.hidden = false;
  }

  function clearMessage() {
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
    Array.from(form.elements).forEach(el => { el.disabled = busy; });
  }

  function readableError(error) {
    const text = String(error && error.message || "").toLowerCase();
    if (text.includes("invalid login credentials")) return "Неверный email или пароль.";
    if (text.includes("email not confirmed")) return "Сначала подтвердите email по ссылке из письма.";
    if (text.includes("password")) return "Пароль не соответствует требованиям безопасности.";
    if (text.includes("rate limit")) return "Слишком много попыток. Повторите позже.";
    return "Не удалось выполнить запрос. Проверьте соединение и попробуйте снова.";
  }

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
    showMessage("Проверьте почту и подтвердите регистрацию по ссылке в письме.", "success");
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
    showMessage("Если аккаунт существует, ссылка для смены пароля отправлена на email.", "success");
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
    showMessage("Пароль изменён. Открываю приложение…", "success");
    window.setTimeout(() => window.location.replace(appUrl()), 700);
  });

  client.auth.onAuthStateChange((event, session) => {
    if (event === "PASSWORD_RECOVERY") {
      setView("new-password");
      showMessage("Введите новый пароль для аккаунта.", "info");
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

  setView(initialView);

  const reason = params.get("reason");
  if (reason === "signed_out") showMessage("Вы вышли из аккаунта.", "success");
  if (reason === "session_expired") showMessage("Сессия завершена. Войдите снова.", "info");
  if (reason === "auth_required") showMessage("Для доступа необходимо войти.", "info");
  if (reason === "auth_unavailable") showMessage("Не удалось проверить сессию. Попробуйте войти снова.", "error");
})();
