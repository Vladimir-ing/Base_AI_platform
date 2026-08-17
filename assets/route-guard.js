"use strict";

(async function protectAppRoute() {
  const client = window.supabaseClient;
  const gate = document.getElementById("authGate");

  function loginUrl(reason) {
    const url = new URL("login.html", window.location.href);
    url.searchParams.set("next", "ai-platforms.html");
    if (reason) url.searchParams.set("reason", reason);
    return url.href;
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
        await client.auth.signOut({ scope: "local" });
        redirectToLogin("signed_out");
      });
    }

    document.body.classList.remove("auth-pending");
    document.body.classList.add("auth-ready");
    if (gate) gate.hidden = true;

    const appScript = document.createElement("script");
    appScript.src = "assets/app.js";
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
    if (event === "SIGNED_OUT" || (!session && event === "TOKEN_REFRESHED")) {
      redirectToLogin("session_expired");
    }
  });
})();
