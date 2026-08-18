"use strict";

(async function protectAppRoute() {
  const client = window.supabaseClient;
  const gate = document.getElementById("authGate");
  let signingOut = false;

  function loginUrl(reason) {
    const url = new URL("login.html", window.location.href);
    const currentPage = window.location.pathname.split("/").pop() || "ai-platforms.html";
    url.searchParams.set("next", currentPage);
    if (reason) url.searchParams.set("reason", reason);
    return url.href;
  }

  function landingUrl() {
    return new URL("index.html", window.location.href).href;
  }

  function redirectToLogin(reason) {
    window.location.replace(loginUrl(reason));
  }

  try {
    const { data, error } = await client.auth.getUser();
    if (error || !data.user) {
      redirectToLogin("auth_required");
      return;
    }

    const userLabel = document.getElementById("authUser");
    if (userLabel) userLabel.textContent = data.user.email || "Аккаунт";

    const logoutButton = document.getElementById("logoutBtn");
    if (logoutButton) {
      logoutButton.addEventListener("click", async () => {
        logoutButton.disabled = true;
        signingOut = true;
        const { error: signOutError } = await client.auth.signOut({ scope: "local" });
        if (signOutError) {
          signingOut = false;
          logoutButton.disabled = false;
          return;
        }
        window.location.replace(landingUrl());
      });
    }

    document.body.classList.remove("auth-pending");
    document.body.classList.add("auth-ready");
    if (gate) gate.hidden = true;

    const appScript = document.createElement("script");
    const appSource = document.body.dataset.appScript || "assets/app.js";
    appScript.src = appSource + (appSource.includes("?") ? "&" : "?") + "v=20260818-0400";
    appScript.async = false;
    appScript.onerror = () => {
      if (gate) {
        gate.hidden = false;
        gate.querySelector("p").textContent = "Не удалось загрузить приложение. Обновите страницу.";
      }
    };
    document.body.appendChild(appScript);
  } catch (error) {
    redirectToLogin("auth_unavailable");
  }

  client.auth.onAuthStateChange((event, session) => {
    if (signingOut && event === "SIGNED_OUT") return;
    if (event === "SIGNED_OUT" || (!session && event === "TOKEN_REFRESHED")) {
      redirectToLogin("session_expired");
    }
  });
})();
