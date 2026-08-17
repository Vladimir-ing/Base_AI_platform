import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const app = readFileSync("assets/app.js", "utf8");
const migration = readFileSync(
  "supabase/migrations/20260817102409_add_user_vault_revisions.sql",
  "utf8"
);
const ambiguityFix = readFileSync(
  "supabase/migrations/20260817111254_fix_user_vault_revision_ambiguity.sql",
  "utf8"
);

assert.match(app, /const STORE_KEY = "ai-platforms-vault-v1";/);
assert.match(app, /let cloudRevision = 0;/);
assert.match(app, /p_expected_revision: cloudRevision/);
assert.match(app, /\.select\("payload, schema_version, updated_at, revision"\)/);
assert.match(app, /error\?\.message === "vault_conflict"/);
assert.match(app, /async function resolveCloudConflict\(\)/);
assert.match(app, /if \(!cloudConflict \|\| cloudConflictDialogOpen\) return/);
assert.match(app, /box\.onclick = cloudConflict \? resolveCloudConflict : null/);
assert.match(app, /cloudRevision = data \? Number\(data\.revision\) \|\| 0 : 0/);
assert.match(app, /applyCloudState\(data\.payload, data\.updated_at, data\.revision\)/);
assert.doesNotMatch(app, /\.upsert\(\{ user_id: cloudUserId/);

assert.match(migration, /add column revision bigint not null default 1/i);
assert.match(migration, /security invoker/i);
assert.match(migration, /set search_path = ''/i);
assert.match(migration, /auth\.uid\(\)/i);
assert.match(migration, /revision = p_expected_revision/i);
assert.match(migration, /errcode = '40001', message = 'vault_conflict'/i);
assert.match(migration, /revoke execute[\s\S]*from public, anon/i);
assert.match(migration, /grant execute[\s\S]*to authenticated/i);
assert.doesNotMatch(migration, /security definer/i);

assert.match(ambiguityFix, /insert into public\.user_vaults as vault/i);
assert.match(ambiguityFix, /update public\.user_vaults as vault/i);
assert.match(ambiguityFix, /vault\.revision = p_expected_revision/i);
assert.match(ambiguityFix, /returning vault\.revision, vault\.updated_at/i);
assert.match(ambiguityFix, /security invoker/i);
assert.doesNotMatch(ambiguityFix, /security definer/i);

console.log("cloud conflict protection checks: ok");
