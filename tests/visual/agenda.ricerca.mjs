// RICERCA-AGENDA (PO 2026-11-08): la barra in cima all'agenda cerca sul posto e agisce con conferma.
import { chromium, webkit } from 'playwright';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5174', '--strictPort'], { stdio: 'ignore' });
for (let i = 0; i < 60; i++) { try { if ((await fetch('http://127.0.0.1:5174')).ok) break; } catch {} await new Promise(r => setTimeout(r, 100)); }
const out = 'tests/visual/results-ricerca'; await mkdir(out, { recursive: true });
try {
  for (const [engine, launcher] of [['chromium', chromium], ['webkit', webkit]]) {
    const browser = await launcher.launch();
    try {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, timezoneId: 'Europe/Rome', locale: 'it-IT' });
      const page = await context.newPage(), errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.clock.install({ time: new Date('2026-10-16T08:40:00Z') });
      await page.route('**/*', r => new URL(r.request().url()).hostname === '127.0.0.1' ? r.continue() : r.fulfill({ json: [], headers: { 'access-control-allow-origin': '*' } }));
      await page.goto('http://127.0.0.1:5174/tests/visual/agenda.html?mode=studio&agenda=1&agendaDate=2026-10-16&agendaView=settimana&motion=1&ricerca=1');
      await page.locator('.agenda-mobile-page').waitFor();
      const input = page.getByRole('searchbox', { name: 'Cerca o chiedi' });
      await input.click();
      const panel = page.getByRole('dialog', { name: 'Risultati della ricerca' });
      await panel.waitFor();
      // Stessa barra, nessun pannello di Poliedron in basso: azioni veloci subito sotto la barra.
      assert.equal(await panel.getByRole('group', { name: 'Azioni veloci' }).getByRole('button', { name: 'Nuovo appuntamento', exact: true }).isVisible(), true);
      const barBottom = await page.locator('.agenda-search-row').evaluate(el => el.getBoundingClientRect().bottom);
      const panelTop = await panel.evaluate(el => el.getBoundingClientRect().top);
      assert.ok(panelTop >= barBottom && panelTop - barBottom < 20, `${engine}: results open right under the bar`);
      await page.screenshot({ path: `${out}/${engine}-azioni.png` });
      // Ricerca diretta.
      await input.fill('sovrapposto');
      await panel.getByRole('region', { name: 'Agenda' }).getByRole('button', { name: /Impegno sovrapposto/ }).waitFor();
      // Azione: sposta, con conferma.
      await input.fill('sposta impegno sovrapposto a lunedì alle 11');
      const before = await page.evaluate(() => window.__state.events.find(e => e.id === 22));
      assert.equal(before.data_inizio, '2026-10-16', 'nothing changes before Conferma');
      await panel.getByRole('button', { name: 'Conferma', exact: true }).click();
      await panel.getByRole('status').waitFor();
      const after = await page.evaluate(() => window.__state.events.find(e => e.id === 22));
      assert.deepEqual([after.data_inizio, after.ora_inizio, after.ora_fine], ['2026-10-19', '11:00', '12:00']);
      // Chiedi a Poliedron passa la frase così com'è; Chiudi esce sempre.
      await input.fill('quanto ho incassato oggi');
      await panel.getByRole('button', { name: /Chiedi a Poliedron/ }).click();
      assert.equal(await page.evaluate(() => window.__poliedron), 'quanto ho incassato oggi');
      await input.click();
      await page.getByRole('button', { name: 'Chiudi', exact: true }).click();
      assert.equal(await page.locator('.ricerca-pannello').count(), 0);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      assert.deepEqual(errors, []);
      await context.close();
    } finally { await browser.close(); }
  }
  console.log('Agenda search: inline results, quick actions, move with confirmation, ask Poliedron, close: Chromium/WebKit OK');
} finally { server.kill(); }
