import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const impostazioni = readFileSync(new URL('../src/components/Impostazioni.jsx', import.meta.url), 'utf8');

// Product Owner: "Mettimi un pulsante esci da qualche parte perché così
// esco e rientro" — the only existing "Esci" button lived at the bottom of
// Impostazioni's "Profilo e team" tab (the last of 9 tabs), several taps
// and a scroll away from opening Impostazioni. Adds a second, always-
// visible entry point in the page header — same handleLogout passed down
// from App.jsx (via the existing onLogout prop), no new auth logic, no
// change to the original button.
test('Impostazioni exposes a logout button in the page header, reusing the existing onLogout handler', () => {
  const headerIndex = impostazioni.indexOf('<PageHeader icon="set" title="Impostazioni" actions={(onLogout || onCheckUpdate) &&');
  assert.notEqual(headerIndex, -1, 'PageHeader must render the onLogout action inline');
  const nextSectionIndex = impostazioni.indexOf("sezione === 'studio'", headerIndex);
  const headerBlock = impostazioni.slice(headerIndex, nextSectionIndex);
  assert.match(headerBlock, /onClick=\{onLogout\}/);
  assert.match(headerBlock, />\s*Esci\s*</);
});

// The original bottom-of-Profilo button (POL-UI-005) must still be there —
// this is an addition, not a replacement.
test('the original Profilo-tab logout button is unchanged', () => {
  assert.match(impostazioni, /sezione === 'team'/);
  const teamSectionIndex = impostazioni.indexOf("sezione === 'team'");
  const afterTeamSection = impostazioni.slice(teamSectionIndex);
  assert.match(afterTeamSection, /\{onLogout && \(/);
  assert.match(afterTeamSection, /onClick=\{onLogout\}/);
});
