import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const dashboard = readFileSync(new URL('../src/components/Dashboard.jsx', import.meta.url), 'utf8');
const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const premium = readFileSync(new URL('../src/components/PremiumVisualSystem.css', import.meta.url), 'utf8');

// Product Owner: "Su mobile non c'è nessun tasto esci, in home intendo" —
// the POL-UI-031 header button lives in Impostazioni, several taps from
// Home; desktop already carries Esci in the always-visible PremiumSidebar,
// but mobile Home had nothing. Adds a discreet icon button in the sticky
// home-hero bar, next to "Personalizza Home", reusing the same
// handleLogout — desktop-hidden (the sidebar already covers it there).
test('mobile Home exposes a logout button in the sticky hero bar, reusing handleLogout', () => {
  assert.match(dashboard, /onLogout \}\) \{/);
  assert.match(dashboard, /\{onLogout && \(/);
  assert.match(dashboard, /className="home-hero__logout" onClick=\{onLogout\}/);
  assert.match(app, /onLogout=\{handleLogout\} \/>\}/);
});

test('the mobile Home logout button is hidden on desktop (sidebar already has one)', () => {
  assert.match(premium, /\.home-hero__logout \{ display: none; \}/);
  assert.match(premium, /\.home-hero__customize,\s*\n\s*\.home-hero__logout \{/);
  assert.match(premium, /\.home-hero__logout \{\s*display:\s*flex;/);
});
