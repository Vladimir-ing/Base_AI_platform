(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.AICoreSecurity = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const ENTITY_ID_RE = /^[A-Za-z0-9_-]{1,120}$/;

  function safeEntityId(value, fallback) {
    const id = value == null ? "" : String(value).trim();
    return ENTITY_ID_RE.test(id) ? id : fallback;
  }

  function safeExternalUrl(value) {
    const raw = value == null ? "" : String(value).trim();
    if (!raw) return "";
    try {
      const parsed = new URL(raw);
      return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.href : "";
    } catch (_error) {
      return "";
    }
  }

  function isSafeExternalUrl(value) {
    const raw = value == null ? "" : String(value).trim();
    return !raw || !!safeExternalUrl(raw);
  }

  return { safeEntityId, safeExternalUrl, isSafeExternalUrl };
});
