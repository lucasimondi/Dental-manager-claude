// POL-AI-010 step 0: the Poliedron AI function is versioned in the repository.
// These checks lock in its security properties so later steps cannot weaken them.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../supabase/functions/agente-assistente/index.ts', import.meta.url), 'utf8');

test('requests without a valid session are refused before any data access', () => {
  const auth = src.indexOf('req.headers.get("Authorization")');
  const getUser = src.indexOf('supabase.auth.getUser()');
  const firstRead = src.indexOf('.from("studios")');
  assert.ok(auth > 0 && getUser > auth && firstRead > getUser, 'Authorization -> getUser -> first read');
  assert.match(src, /if \(!authHeader\)[\s\S]{0,120}status: 401/);
  assert.match(src, /if \(errUser \|\| !user\)[\s\S]{0,140}status: 401/);
});

test('the data client is the caller\'s session, so RLS applies to every tool', () => {
  assert.match(src, /const supabase = createClient\(SUPABASE_URL, SUPABASE_ANON_KEY, \{\s*global: \{ headers: \{ Authorization: authHeader \} \},\s*\}\);/);
  // Every tool execution receives the user client, never the service-role one.
  const calls = [...src.matchAll(/eseguiTool\((\w+),/g)].map((m) => m[1]);
  assert.ok(calls.length >= 2);
  assert.ok(calls.every((c) => c === 'supabase'), `eseguiTool called with: ${calls.join(', ')}`);
});

test('the service-role client only reads the four agent configuration tables, scoped by studio', () => {
  const usi = [...src.matchAll(/supabaseAdmin\.from\("([a-z_]+)"\)\.select\([^)]*\)\.eq\("studio_id", studioId\)/g)].map((m) => m[1]);
  assert.deepEqual(usi.sort(), ['ai_agent_actions', 'ai_agent_config', 'ai_agent_documenti', 'ai_agent_faq']);
  const tutti = [...src.matchAll(/supabaseAdmin\.(\w+)/g)].map((m) => m[1]);
  assert.ok(tutti.every((m) => m === 'from'), `unexpected service-role use: ${tutti.join(', ')}`);
  assert.doesNotMatch(src, /supabaseAdmin\.from\([^)]*\)\.(insert|update|upsert|delete)/);
});

test('the studio comes from the verified token, not from the request body', () => {
  assert.match(src, /const studioId = user\.app_metadata\?\.studio_id;/);
  assert.doesNotMatch(src, /studio_id:\s*(body|req|input)\./);
});

test('the AI feature flag and plan gates are enforced server-side', () => {
  assert.match(src, /if \(livello === "off"\)[\s\S]{0,260}status: 403/);
  assert.match(src, /livello === "pro" \? TOOLS\.filter\(\(t\) => TOOL_SOLO_LETTURA\.has\(t\.name\)\)/);
});
