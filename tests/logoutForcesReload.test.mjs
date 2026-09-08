import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');

// Product Owner: "Neanche uscendo e rientrando, aggiornando, non si vedono
// le modifiche". Root cause: handleLogout was a pure client-side state
// reset (supabase.auth.signOut() + clearing React state) — never a real
// page navigation, so logging out and back in could never trigger the
// browser's own service-worker update check (POL-UI-029) the way the
// Product Owner naturally expected it to. A real reload is what "esco e
// rientro" already reads as; this makes it actually be one.
test('logout forces a real page reload, so it always picks up a pending update', () => {
  const logoutIndex = app.indexOf('const handleLogout = async () => {');
  assert.notEqual(logoutIndex, -1, 'handleLogout must exist');
  const closingBraceIndex = app.indexOf('\n  };', logoutIndex);
  const body = app.slice(logoutIndex, closingBraceIndex);
  assert.match(body, /supabase\.auth\.signOut\(\)/);
  assert.match(body, /window\.location\.reload\(\)/);
});
