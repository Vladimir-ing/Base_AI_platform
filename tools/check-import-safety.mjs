import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";

const require = createRequire(import.meta.url);
const { safeEntityId, safeExternalUrl, isSafeExternalUrl } = require("../assets/security-utils.js");
const app = await readFile(new URL("../assets/app.js", import.meta.url), "utf8");

assert.equal(safeEntityId("seed-chatgpt", "fallback"), "seed-chatgpt");
assert.equal(safeEntityId("x' onclick='alert(1)", "fallback"), "fallback");
assert.equal(safeEntityId("a".repeat(121), "fallback"), "fallback");

assert.equal(safeExternalUrl("javascript:alert(1)"), "");
assert.equal(safeExternalUrl("data:text/html,<script>alert(1)</script>"), "");
assert.equal(safeExternalUrl("https://example.com/login"), "https://example.com/login");
assert.equal(safeExternalUrl("http://example.com"), "http://example.com/");
assert.equal(isSafeExternalUrl(""), true);
assert.equal(isSafeExternalUrl("ftp://example.com/file"), false);

assert.match(app, /o\.id = safeEntityId\(p && p\.id, b\.id\)/);
assert.match(app, /o\.url = safeExternalUrl\(o\.url\)/);
assert.match(app, /Math\.max\(0, Math\.min\(5,/);
assert.doesNotMatch(app, /data-(?:id|kill)='" \+ [a-z]+\.id/);

console.log("Import safety checks passed.");
