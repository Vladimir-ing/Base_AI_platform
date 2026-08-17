import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const app = readFileSync("assets/app.js", "utf8");
const migration = readFileSync(
  "supabase/migrations/20260817061950_create_user_vaults.sql",
  "utf8"
);

assert.match(app, /const STORE_KEY = "ai-platforms-vault-v1";/);
assert.match(app, /userId: typeof data\.userId === "string"/);
assert.match(app, /syncMeta\.userId !== cloudUserId/);
assert.match(app, /resetLocalCacheForUser\(cloudUserId\)/);
assert.match(app, /syncMeta\.userId = cloudUserId/);

const resetIndex = app.indexOf("resetLocalCacheForUser(cloudUserId)");
const fetchIndex = app.indexOf("const { data, error } = await fetchCloudState()", resetIndex);
assert.ok(resetIndex > -1 && fetchIndex > resetIndex, "Account cache must reset before cloud fetch");

const startIndex = app.indexOf("async function startApp()");
const syncIndex = app.indexOf("await initCloudSync()", startIndex);
const renderIndex = app.indexOf("render()", syncIndex);
assert.ok(startIndex > -1 && syncIndex > startIndex && renderIndex > syncIndex,
  "Cloud identity must resolve before the first dashboard render");

assert.match(migration, /alter table public\.user_vaults enable row level security/i);
assert.match(migration, /for select[\s\S]*auth\.uid\(\)[\s\S]*user_id/i);
assert.match(migration, /for insert[\s\S]*with check[\s\S]*auth\.uid\(\)[\s\S]*user_id/i);
assert.match(migration, /for update[\s\S]*using[\s\S]*auth\.uid\(\)[\s\S]*with check[\s\S]*auth\.uid\(\)[\s\S]*user_id/i);
assert.match(migration, /revoke all on table public\.user_vaults from public, anon/i);
assert.match(migration, /grant select, insert, update on table public\.user_vaults to authenticated/i);

assert.doesNotMatch(app, /service_role|sb_secret_/i);

console.log("cloud account isolation checks: ok");
