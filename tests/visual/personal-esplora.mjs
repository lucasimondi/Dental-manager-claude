// PERSONAL-ESPLORA-WIN11 (fasi 1–2 e PR #337): synthetic data only.
// Telefono 390×844 con tocchi reali (CDP): tocco apre (cartelle, anteprima dei file), pressione prolungata +
// movimento trascina (prima Drive, poi database), pressione ferma = selezione con caselle + menu dal basso,
// Drive giù = niente cambia e «Riprova», Annulla, viste (Dettagli ordinabile, Elenco 48 px) salvate per
// cartella, nuova cartella, rinomina via Drive, Copia/Incolla senza file nuovi, Da catalogare → Personale.
// Desktop 1280×800 con mouse e tastiera: clic seleziona, doppio clic apre, Ctrl/Maiusc, tasto destro = menu
// Win11 (riga rapida, scorciatoie, sottomenu), F2, Canc con Annulla (Ctrl+Z), colonne ridimensionabili,
// Proprietà, Gestisci accesso, avviso di errore in basso a destra. Orizzontale 844×390: disposizione.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
const out = 'tests/visual/results-personal-esplora'; await mkdir(out, { recursive: true });
const PORTA = 5181;
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', String(PORTA), '--strictPort'], { stdio: 'ignore' });
const cart = (id, nome, padre_id, posizione = 0) => ({ id, nome, padre_id, colore: null, posizione, creato_il: '2026-11-01T10:00:00Z', modificato_il: '2026-11-01T10:00:00Z', archiviata_il: null, speciale: null, drive_cartella_id: null });
const doc = (id, titolo, fascicolo = 'utenze', mime = 'application/pdf', extra = {}) => ({ id, titolo, ente: 'Ente', fascicolo, data_documento: '2026-10-01', email_data: '2026-10-01T09:00:00Z', creato_il: '2026-10-01T09:00:00Z', drive_file_id: `f-${id}`, drive_url: `https://drive.google.com/file/d/f-${id}/view`, nome_file_originale: `${id}.pdf`, mime_type: mime, tag: [], azione_richiesta: false, dimensione_byte: 120000, ...extra });
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

const scenario = () => ({
  CARTELLE: [cart('casa', 'Casa', null, 0), cart('utenze', 'Utenze', 'casa'), cart('luce', 'Luce', 'utenze'), cart('auto', 'Auto', null, 1)],
  DOC: {
    rogito: doc('rogito', 'Rogito casa', 'immobili', 'application/pdf', { dimensione_byte: 2_400_000, creato_il: '2026-09-01T09:00:00Z' }),
    imu: doc('imu', 'IMU 2026', 'fiscale', 'application/pdf', { azione_richiesta: true, dimensione_byte: 80_000 }),
    gas: doc('gas', 'Contratto gas'), bol: doc('bol', 'Bolletta luce'),
    pol: doc('pol', 'Polizza auto', 'veicoli', 'image/png', { nome_file_originale: 'polizza.png' }),
    n1: doc('n1', 'Ricevuta nuova', 'utenze'), n2: doc('n2', 'Foglio spese', 'utenze', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', { nome_file_originale: 'spese.xlsx' }),
  },
  LINK: { casa: ['rogito', 'imu'], utenze: ['gas'], luce: ['bol'], auto: [] },
  SCRIVANIA: ['pol'],
  PREFERITI: [],
  PERMESSI: [{ id: 'own', type: 'user', role: 'owner', emailAddress: 'io@example.com', displayName: 'Io' }],
  chiamate: [], drive: [], driveGiu: false,
});

const avvia = async (browser, { width, height, nome, touch }) => {
  const S = scenario();
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, hasTouch: touch, isMobile: touch });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('**/*', async (route) => {
    const req = route.request(); const u = new URL(req.url());
    if (u.hostname === '127.0.0.1') return route.continue();
    if (u.hostname === 'script.google.com') {
      const b = JSON.parse(req.postData() || '{}'); S.drive.push(b);
      if (S.driveGiu && ['sposta_documenti', 'cartella_drive', 'rinomina_file'].includes(b.azione)) return route.abort();
      if (b.azione === 'file') return route.fulfill({ json: { ok: true, nome: 'polizza.png', mime: 'image/png', dati: PNG } });
      if (b.azione === 'proprieta_file') return route.fulfill({ json: { ok: true, nome: 'Rogito casa.pdf', dimensione: 2_400_000, creato: '2026-09-01T09:00:00Z', modificato: '2026-10-02T09:00:00Z', proprietario: 'io@example.com', percorso: 'Archivio personale / Casa', link: 'https://drive/x', versioni: [{ id: 'v2', quando: '2026-10-02T09:00:00Z', chi: 'Io', dimensione: 2_400_000 }, { id: 'v1', quando: '2026-09-01T09:00:00Z', chi: 'Io', dimensione: 2_300_000 }] } });
      if (b.azione === 'accesso_file') {
        if (b.azione === 'accesso_file' && b.email) S.PERMESSI.push({ id: `p${S.PERMESSI.length}`, type: 'user', role: b.ruolo, emailAddress: b.email });
        return route.fulfill({ json: { ok: true, clinico: false, link: 'https://drive/x', permessi: S.PERMESSI.map((p) => ({ id: p.id, tipo: p.type, ruolo: p.role, email: p.emailAddress, nome: p.displayName || null })) } });
      }
      if (b.azione === 'rinomina_file') return route.fulfill({ json: { ok: true, nome: `${b.nome}.pdf` } });
      if (b.azione === 'cestina') return route.fulfill({ json: { ok: true, cestinati: b.ids, non_trovati: [] } });
      return route.fulfill({ json: { ok: true, spostati: b.ids || [], senza_file: [], non_trovati: [], errori: [] } });
    }
    if (!u.hostname.endsWith('supabase.co')) return route.abort();
    const p = u.pathname; const m = req.method(); const corpo = () => JSON.parse(req.postData() || 'null');
    if (p.endsWith('/v_cartelle_mie')) return route.fulfill({ json: S.CARTELLE.filter((c) => !c.archiviata_il).map((c) => ({ ...c, n_documenti: (S.LINK[c.id] || []).length, n_sottocartelle: S.CARTELLE.filter((x) => x.padre_id === c.id).length })) });
    if (p.endsWith('/cartelle_mie') && m === 'POST') {
      const b = corpo(); const id = `nuova${S.CARTELLE.length}`; S.CARTELLE.push(cart(id, b.nome, b.padre_id)); S.LINK[id] = []; S.chiamate.push(['crea', b]);
      return route.fulfill({ json: { id, nome: b.nome, padre_id: b.padre_id } });
    }
    if (p.endsWith('/cartelle_mie') && m === 'PATCH') {
      const b = corpo(); const f = u.searchParams.get('id') || ''; const ids = f.startsWith('eq.') ? [f.slice(3)] : f.replace(/^in\.\(|\)$/g, '').split(',').map((x) => x.replace(/"/g, ''));
      S.chiamate.push(['cartelle', ids, b]);
      for (const c of S.CARTELLE) if (ids.includes(c.id)) Object.assign(c, b);
      return route.fulfill({ json: ids.length === 1 && f.startsWith('eq.') ? { id: ids[0], ...b } : ids.map((id) => ({ id, ...b })) });
    }
    if (p.endsWith('/rpc/sposta_documenti_mie')) {
      const b = corpo(); S.chiamate.push(['sposta', b]);
      const { p_documenti: ids, p_da: da, p_a: a } = b;
      if (a) S.LINK[a] = [...new Set([...(S.LINK[a] || []), ...ids])]; else S.SCRIVANIA = [...new Set([...S.SCRIVANIA, ...ids])];
      if (da) S.LINK[da] = S.LINK[da].filter((x) => !ids.includes(x)); else S.SCRIVANIA = S.SCRIVANIA.filter((x) => !ids.includes(x));
      return route.fulfill({ json: ids.length });
    }
    if (p.endsWith('/cartelle_mie_scrivania')) {
      if (m === 'POST') { const b = corpo(); S.chiamate.push(['scrivania+', b.map((r) => r.documento_id)]); S.SCRIVANIA.push(...b.map((r) => r.documento_id)); return route.fulfill({ json: b.map((r) => ({ documento_id: r.documento_id })) }); }
      if (m === 'DELETE') { const ids = (u.searchParams.get('documento_id') || '').replace(/^in\.\(|\)$/g, '').split(','); S.chiamate.push(['scrivania-', ids]); S.SCRIVANIA = S.SCRIVANIA.filter((x) => !ids.includes(x)); return route.fulfill({ json: ids.map((documento_id) => ({ documento_id })) }); }
      return route.fulfill({ json: S.SCRIVANIA.map((id) => ({ documento_id: id, aggiunto_il: '2026-11-01T10:00:00Z', documenti: S.DOC[id] })) });
    }
    if (p.endsWith('/cartelle_mie_documenti')) {
      if (m === 'POST') { const b = corpo(); S.chiamate.push(['aggiungi', b.map((r) => [r.cartella_id, r.documento_id])]); for (const r of b) S.LINK[r.cartella_id] = [...new Set([...(S.LINK[r.cartella_id] || []), r.documento_id])]; return route.fulfill({ json: b.map((r) => ({ documento_id: r.documento_id })) }); }
      const f = u.searchParams.get('cartella_id');
      if (f?.startsWith('eq.')) { const id = f.slice(3); return route.fulfill({ json: (S.LINK[id] || []).map((d) => ({ aggiunto_il: '2026-11-01T10:00:00Z', documenti: S.DOC[d] })) }); }
      return route.fulfill({ json: Object.entries(S.LINK).flatMap(([c, ds]) => ds.map((d) => ({ cartella_id: c, documento_id: d, documenti: { fascicolo: S.DOC[d].fascicolo } }))) });
    }
    if (p.endsWith('/impostazioni_app')) {
      if (m === 'POST') { const b = corpo(); S.PREFERITI = b.valore; S.chiamate.push(['preferiti', b.valore]); return route.fulfill({ json: [] }); }
      return route.fulfill({ json: { valore: S.PREFERITI } });
    }
    if (p.endsWith('/scadenze')) return route.fulfill({ json: [{ id: 's1', data: '2026-11-25', importo: 40, completata: false, storica: false, documento_id: 'gas', documento: { id: 'gas', titolo: 'Contratto gas', fascicolo: 'utenze', tipo_documento: 'avviso', tag: [] } }] });
    if (p.endsWith('/documenti') && m === 'PATCH') { const b = corpo(); S.chiamate.push(['documenti', u.searchParams.get('id'), b]); const id = (u.searchParams.get('id') || '').replace(/^eq\./, ''); if (S.DOC[id] && b.titolo) S.DOC[id].titolo = b.titolo; return route.fulfill({ json: { id, ...b } }); }
    if (p.endsWith('/documenti') && m === 'DELETE') { S.chiamate.push(['elimina', u.searchParams.get('id')]); return route.fulfill({ json: [] }); }
    if (p.endsWith('/documenti')) {
      if (m === 'HEAD') return route.fulfill({ status: 200, headers: { 'content-range': `*/${Object.keys(S.DOC).length}`, 'access-control-allow-origin': '*', 'access-control-expose-headers': 'Content-Range' }, body: '' });
      if (u.searchParams.get('azione_richiesta')) return route.fulfill({ json: Object.values(S.DOC).filter((d) => d.azione_richiesta).map(({ id, fascicolo }) => ({ id, fascicolo, azione_richiesta: true })) });
      const inn = u.searchParams.get('id');
      if (inn?.startsWith('in.')) { const ids = inn.slice(4, -1).split(','); return route.fulfill({ json: ids.map((i) => S.DOC[i]).filter(Boolean) }); }
      const fasc = u.searchParams.get('fascicolo');
      let righe = Object.values(S.DOC);
      if (fasc?.startsWith('eq.')) righe = righe.filter((d) => d.fascicolo === fasc.slice(3));
      return route.fulfill({ json: righe });
    }
    return route.fulfill({ json: [] });
  });
  await page.goto(`http://127.0.0.1:${PORTA}/tests/visual/personal-esplora.html`);
  await page.locator('.esp-contenuto').waitFor();
  await page.waitForTimeout(300);
  return { S, page, context, errors, cdp: touch ? await context.newCDPSession(page) : null, nome, width, height };
};

const centro = async (loc) => { const b = await loc.boundingBox(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; };
const premi = async ({ cdp, page }, loc, verso = null, foto = null) => {
  const a = typeof loc.x === 'number' ? loc : await centro(loc);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [a] });
  await page.waitForTimeout(650);
  if (!verso) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await page.waitForTimeout(250); return; }
  const b = typeof verso.x === 'number' ? verso : await centro(verso);
  for (let i = 1; i <= 12; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: a.x + ((b.x - a.x) * i) / 12, y: a.y + ((b.y - a.y) * i) / 12 }] });
  await page.waitForTimeout(100);
  if (foto) await page.screenshot({ path: `${out}/${foto}.png` });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(400);
};
const tessera = (page, nome) => page.locator(`.esp-contenuto [data-elemento][aria-label="${nome}"]`);
const ramo = (page, nome) => page.locator('.esp-albero-nome', { hasText: new RegExp(`^${nome}`) }).first();
// PR #337 §2: su mobile il pannello di navigazione è un cassetto (hamburger o swipe da sinistra).
const vaiRamo = async (page, nome) => {
  if (await page.locator('.esp-mobile').count() && !(await page.locator('.esp-cassetto').count())) {
    await page.getByRole('button', { name: 'Pannello di navigazione' }).tap();
    await page.locator('.esp-cassetto').waitFor();
  }
  await ramo(page, nome).tap();
  await page.locator('.esp-cassetto').waitFor({ state: 'detached' }).catch(() => {});
};
// Trascinamento col dito per tappe: verso il bordo sinistro (si apre il cassetto), poi sulla cartella.
const trascinaVia = async ({ cdp, page }, loc, tappe, foto = null) => {
  let a = await centro(loc);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [a] });
  await page.waitForTimeout(650);
  for (const t of tappe) {
    if (typeof t === 'number') { await page.waitForTimeout(t); continue; }
    const b = typeof t.x === 'number' ? t : await centro(typeof t === 'function' ? t() : t);
    for (let i = 1; i <= 10; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: a.x + ((b.x - a.x) * i) / 10, y: a.y + ((b.y - a.y) * i) / 10 }] });
    a = b;
  }
  await page.waitForTimeout(150);
  if (foto) await page.screenshot({ path: `${out}/${foto}.png` });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(400);
};
const dentroSchermo = async (page, sel) => page.evaluate((s) => { const r = document.querySelector(s)?.getBoundingClientRect(); return !!r && r.left >= -0.5 && r.top >= -0.5 && r.right <= innerWidth + 0.5 && r.bottom <= innerHeight + 0.5; }, sel);
const senzaSforamento = async (page) => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1 && document.querySelector('.esp').scrollWidth <= document.querySelector('.esp').clientWidth + 1);
const aspetta = async (cond, ms = 4000) => { for (let i = 0; i < ms / 50; i++) { if (await cond()) return true; await new Promise((r) => setTimeout(r, 50)); } return false; };
const voceMenu = (page, nome) => page.locator('.esp-menu-voce', { hasText: new RegExp(`^${nome.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`) }).first();
const sceltaMenu = async (page, nome) => { await page.waitForTimeout(500); await voceMenu(page, nome).click(); };

let browser;
try {
  for (let i = 0; i < 100; i++) { try { if ((await fetch(`http://127.0.0.1:${PORTA}`)).ok) break; } catch {} await new Promise((r) => setTimeout(r, 100)); }
  browser = await chromium.launch({ ...(process.env.CHROMIUM_EXECUTABLE ? { executablePath: process.env.CHROMIUM_EXECUTABLE } : {}), args: ['--no-sandbox', '--disable-dev-shm-usage'] });

  /* ================= TELEFONO 390×844 ================= */
  {
    const T = await avvia(browser, { width: 390, height: 844, nome: 'telefono', touch: true });
    const { page, S } = T;
    await tessera(page, 'Cartella Casa').waitFor();
    assert.equal(await page.locator('.esp-stato').textContent(), '3 elementi · 2 da gestire');
    // tocco su cartella = apre; tocco su immagine = anteprima nella finestra Win11
    await tessera(page, 'Cartella Casa').tap();
    await tessera(page, 'Rogito casa').waitFor();
    await vaiRamo(page, 'Personale');
    await tessera(page, 'Polizza auto').tap();
    const fin = page.getByRole('dialog', { name: 'Polizza auto' });
    await fin.waitFor();
    await fin.locator('img').waitFor();
    assert.ok(await fin.getByRole('button', { name: 'Riduci a icona' }).count() && await fin.getByRole('button', { name: 'Ingrandisci' }).count() && await fin.getByRole('button', { name: 'Chiudi' }).count());
    await page.screenshot({ path: `${out}/telefono-anteprima.png` });
    await fin.getByRole('button', { name: 'Riduci a icona' }).tap();
    await page.getByRole('button', { name: 'Ripristina Polizza auto' }).tap();
    await fin.getByRole('button', { name: 'Chiudi' }).tap();
    await fin.waitFor({ state: 'detached' });

    // trascina: PRIMA Drive (sposta_documenti), poi il database; Annulla rifà al contrario
    await tessera(page, 'Cartella Casa').tap();
    await tessera(page, 'Rogito casa').waitFor();
    const d0 = S.drive.length;
    await trascinaVia(T, tessera(page, 'Rogito casa'), [{ x: 6, y: 420 }, 700, () => ramo(page, 'Auto')], 'telefono-trascina');
    await page.locator('.esp-avviso', { hasText: 'Spostato in «Auto»' }).waitFor();
    assert.deepEqual(S.drive.slice(d0).map((b) => [b.azione, b.cartella_id, b.ids]), [['sposta_documenti', 'auto', ['rogito']]]);
    assert.deepEqual(S.chiamate.at(-1), ['sposta', { p_documenti: ['rogito'], p_da: 'casa', p_a: 'auto' }]);
    assert.equal(await tessera(page, 'Rogito casa').count(), 0);
    await page.locator('.esp-avviso button', { hasText: 'Annulla' }).tap();
    await tessera(page, 'Rogito casa').waitFor();
    assert.deepEqual(S.drive.at(-1).cartella_id, 'casa');
    assert.deepEqual(S.chiamate.at(-1), ['sposta', { p_documenti: ['rogito'], p_da: 'auto', p_a: 'casa' }]);

    // Drive giù: niente cambia nell'app, avviso con «Riprova»
    S.driveGiu = true;
    const c0 = S.chiamate.length;
    await trascinaVia(T, tessera(page, 'Rogito casa'), [{ x: 6, y: 420 }, 700, () => ramo(page, 'Auto')]);
    await page.locator('.esp-avviso.errore', { hasText: 'Non riuscito' }).waitFor();
    assert.equal(S.chiamate.length, c0, 'nessuna scrittura nel database se Drive non risponde');
    assert.equal(await tessera(page, 'Rogito casa').count(), 1, 'il documento resta dov’era');
    await page.screenshot({ path: `${out}/telefono-errore-riprova.png` });
    S.driveGiu = false;
    await page.locator('.esp-avviso button', { hasText: 'Riprova' }).tap();
    await page.locator('.esp-avviso', { hasText: 'Spostato in «Auto»' }).waitFor();
    assert.deepEqual(S.chiamate.at(-1), ['sposta', { p_documenti: ['rogito'], p_da: 'casa', p_a: 'auto' }]);

    // pressione ferma = selezione con caselle + menu dal basso con riga rapida e sottomenu
    await premi(T, tessera(page, 'IMU 2026'));
    const foglio = page.locator('.esp-foglio-menu');
    await foglio.waitFor();
    assert.ok(await dentroSchermo(page, '.esp-foglio-menu'));
    const fr = await foglio.boundingBox();
    assert.ok(Math.abs(fr.width - 390) < 1 && Math.abs(fr.y + fr.height - 844) < 2, 'foglio a tutta larghezza in basso');
    assert.deepEqual(await page.locator('.esp-menu-rapida').evaluateAll((e) => e.map((x) => x.getAttribute('aria-label'))), ['Taglia', 'Copia', 'Rinomina', 'Condividi', 'Elimina']);
    assert.ok(await page.locator('.esp-casella.attiva').count() >= 1, 'casella di selezione');
    await page.screenshot({ path: `${out}/telefono-menu.png` });
    await sceltaMenu(page, 'Apri con');
    assert.deepEqual(await page.locator('.esp-foglio-menu .esp-menu-voce:not(.esp-menu-indietro) .esp-menu-nome').allInnerTexts(), ['Anteprima Poliedra', 'Google Drive (visualizzatore)', 'Google Documenti / Fogli', 'Nuova scheda del browser', 'Scarica', 'Altra app… (condividi)']);
    await page.locator('.esp-menu-indietro').tap();
    await sceltaMenu(page, 'Sposta in…');
    await page.locator('.esp-sposta').waitFor(); await page.waitForTimeout(300);
    assert.ok(await dentroSchermo(page, '.esp-sposta'));
    await page.locator('.esp-sposta-lista button', { hasText: 'Luce' }).tap();
    await page.locator('.esp-avviso', { hasText: 'Spostato in «Luce»' }).waitFor();
    assert.deepEqual(S.drive.at(-1).cartella_id, 'luce');
    assert.equal(await page.locator('.esp-barra-selezione').count(), 0, 'selezione chiusa dopo l’azione');

    // Visualizza (in «Personale»): Dettagli ordinabile, salvato per cartella; Elenco con righe da 48 px
    await vaiRamo(page, 'Personale');
    await tessera(page, 'Polizza auto').waitFor();
    await page.getByRole('button', { name: /^Visualizza/ }).tap();
    await sceltaMenu(page, 'Dettagli');
    await page.locator('.esp-dettagli').waitFor();
    const nomi = () => page.locator('.esp-dettagli-riga .esp-dettagli-testo').allInnerTexts();
    assert.deepEqual(await nomi(), ['Auto', 'Casa', 'Polizza auto']);
    await page.getByRole('button', { name: /^Nome/ }).tap();
    assert.deepEqual(await nomi(), ['Casa', 'Auto', 'Polizza auto']); // cartelle sempre prima
    assert.equal(await page.getByRole('columnheader').first().getAttribute('aria-sort'), 'descending');
    await page.screenshot({ path: `${out}/telefono-dettagli.png` });
    await vaiRamo(page, 'Casa');
    await page.locator('.esp-griglia').waitFor();
    await vaiRamo(page, 'Personale');
    await page.locator('.esp-dettagli').waitFor(); // la vista di «Personale» è rimasta Dettagli
    await page.getByRole('button', { name: /^Visualizza/ }).tap();
    await page.locator('.esp-foglio-menu').waitFor();
    await sceltaMenu(page, 'Elenco');
    await page.locator('.esp-elenco').waitFor();
    const altezzaRiga = await page.locator('.esp-riga-bottone').first().evaluate((e) => e.getBoundingClientRect().height);
    assert.ok(altezzaRiga >= 48 && altezzaRiga < 50, `righe da 48 px (${altezzaRiga})`);
    assert.match(await page.locator('.esp-riga-testo small').last().textContent(), /\d{2}\/\d{2}\/\d{4} · \d/);
    await page.screenshot({ path: `${out}/telefono-elenco.png` });

    // spazio vuoto: Nuova cartella → database e gemella su Drive
    await page.locator('.esp-avviso').waitFor({ state: 'detached', timeout: 8000 });
    const bb = await page.locator('.esp-contenuto').boundingBox();
    await premi(T, { x: bb.x + bb.width / 2, y: bb.y + bb.height - 30 });
    await page.locator('.esp-foglio-menu').waitFor();
    await sceltaMenu(page, 'Nuova cartella');
    const campo = page.getByRole('textbox', { name: 'Nome della nuova cartella' });
    await campo.fill('Mutuo'); await campo.press('Enter');
    await page.locator('.esp-avviso', { hasText: 'Cartella «Mutuo» creata' }).waitFor();
    assert.deepEqual(S.chiamate.filter((c) => c[0] === 'crea').at(-1), ['crea', { nome: 'Mutuo', padre_id: null }]);
    assert.equal(S.drive.at(-1).azione, 'cartella_drive');

    // rinomina un documento: prima Drive (rinomina_file), poi il titolo
    await vaiRamo(page, 'Casa');
    await tessera(page, 'Cartella Utenze').tap();
    await tessera(page, 'Contratto gas').waitFor();
    await premi(T, tessera(page, 'Contratto gas'));
    await sceltaMenu(page, 'Rinomina');
    const rin = page.getByRole('textbox', { name: 'Nuovo nome' });
    await rin.fill('Contratto gas 2026'); await rin.press('Enter');
    await page.locator('.esp-avviso', { hasText: 'Rinominato' }).waitFor();
    assert.deepEqual(S.drive.find((b) => b.azione === 'rinomina_file'), { token: 'token-finto', azione: 'rinomina_file', id: 'gas', nome: 'Contratto gas 2026' });
    assert.deepEqual(S.chiamate.at(-1).slice(0, 2), ['documenti', 'eq.gas']);
    await tessera(page, 'Contratto gas 2026').waitFor();
    await page.locator('.esp-barra-selezione button', { hasText: 'Fine' }).tap().catch(() => {});

    // Copia / Incolla: il documento compare anche in «Auto», nessuna chiamata a Drive
    await premi(T, tessera(page, 'Contratto gas 2026'));
    await page.locator('.esp-menu-rapida[aria-label="Copia"]').waitFor(); await page.waitForTimeout(500);
    await page.locator('.esp-menu-rapida[aria-label="Copia"]').tap();
    await page.locator('.esp-barra-selezione button', { hasText: 'Fine' }).tap();
    await vaiRamo(page, 'Auto');
    await tessera(page, 'Rogito casa').waitFor();
    const nDrive = S.drive.length;
    await page.locator('.esp-avviso').waitFor({ state: 'detached', timeout: 8000 });
    const ab = await page.locator('.esp-contenuto').boundingBox();
    await premi(T, { x: ab.x + ab.width / 2, y: ab.y + ab.height - 30 });
    await sceltaMenu(page, 'Incolla «Contratto gas 2026»');
    await tessera(page, 'Contratto gas 2026').waitFor();
    assert.deepEqual(S.chiamate.at(-1), ['aggiungi', [['auto', 'gas']]]);
    assert.equal(S.drive.length, nDrive, 'Copia non tocca Drive');
    assert.ok(S.LINK.utenze.includes('gas'), 'resta anche in Utenze');

    // Da catalogare → Personale: prima Drive (radice), poi la scrivania
    await vaiRamo(page, 'Da catalogare');
    await tessera(page, 'Ricevuta nuova').waitFor();
    await trascinaVia(T, tessera(page, 'Ricevuta nuova'), [{ x: 6, y: 420 }, 700, () => ramo(page, 'Personale')]);
    await page.locator('.esp-avviso', { hasText: 'Spostato in «Personale»' }).waitFor();
    assert.deepEqual([S.drive.at(-1).azione, S.drive.at(-1).cartella_id], ['sposta_documenti', 'radice']);
    assert.ok(S.chiamate.some((c) => c[0] === 'scrivania+' && c[1].join() === 'n1'));

    assert.ok(await senzaSforamento(page), 'nessuno sforamento orizzontale (telefono)');
    assert.deepEqual(T.errors, []);
    await T.context.close();
  }

  /* ================= DESKTOP 1280×800: mouse e tastiera ================= */
  {
    const T = await avvia(browser, { width: 1280, height: 800, nome: 'desktop', touch: false });
    const { page, S } = T;
    await tessera(page, 'Cartella Casa').waitFor();
    // clic = seleziona; doppio clic = apre
    await tessera(page, 'Cartella Auto').click();
    assert.equal(await tessera(page, 'Cartella Auto').getAttribute('aria-pressed'), 'true');
    assert.equal(await page.locator('.esp-intestazione, .esp-percorso [aria-current="page"]').last().textContent(), 'Personale');
    await tessera(page, 'Cartella Casa').dblclick();
    await tessera(page, 'Rogito casa').waitFor();
    // Ctrl e Maiusc
    await tessera(page, 'Cartella Utenze').click();
    await tessera(page, 'Rogito casa').click({ modifiers: ['Shift'] }); // ordine per nome, cartelle prima
    assert.match(await page.locator('.esp-stato').textContent(), /3 elementi selezionati/);
    await tessera(page, 'IMU 2026').click({ modifiers: ['Control'] });
    assert.match(await page.locator('.esp-stato').textContent(), /2 elementi selezionati/);
    // tasto destro su un file = menu Win11: riga rapida, scorciatoie, sottomenu dentro lo schermo
    await tessera(page, 'Rogito casa').click();
    await tessera(page, 'Rogito casa').click({ button: 'right' });
    await page.locator('.esp-menu').first().waitFor();
    await page.waitForTimeout(500);
    assert.ok(await dentroSchermo(page, '.esp-menu'));
    assert.equal(await page.locator('.esp-menu-rapida').count(), 5);
    assert.deepEqual(await page.locator('.esp-menu-tasto').allInnerTexts().then((t) => t.slice(0, 3)), ['Invio', 'Ctrl+X', 'Ctrl+C']);
    assert.ok(await page.locator('.esp-menu-sep').count() >= 3);
    await voceMenu(page, 'Condividi').hover();
    await page.locator('.esp-sottomenu').waitFor(); await page.waitForTimeout(200);
    const [mm, ss] = [await page.locator('.esp-menu').first().boundingBox(), await page.locator('.esp-sottomenu').boundingBox()];
    assert.ok(Math.abs(ss.x - (mm.x + mm.width - 4)) < 2, 'sottomenu attaccato al menu');
    assert.ok(await dentroSchermo(page, '.esp-sottomenu'));
    assert.deepEqual(await page.locator('.esp-sottomenu .esp-menu-nome').allInnerTexts(), ['Condivisione di sistema', 'Copia link Drive', 'Email', 'WhatsApp', 'Gestisci accesso Drive']);
    await page.screenshot({ path: `${out}/desktop-menu.png` });
    // Gestisci accesso: lettura e aggiunta con conferma, senza email da Drive
    await page.locator('.esp-sottomenu .esp-menu-voce', { hasText: 'Gestisci accesso Drive' }).click();
    const acc = page.getByRole('dialog', { name: /Gestisci accesso/ });
    await acc.waitFor();
    await acc.getByText('Proprietario').waitFor();
    await acc.getByLabel('Email della persona').fill('anna@example.com');
    await acc.getByRole('button', { name: 'Aggiungi' }).click();
    await acc.getByRole('button', { name: 'Conferma' }).click();
    await acc.getByText('anna@example.com').waitFor();
    assert.deepEqual(S.drive.filter((b) => b.azione === 'accesso_file').at(-1), { token: 'token-finto', azione: 'accesso_file', id: 'rogito', operazione: 'aggiungi', email: 'anna@example.com', ruolo: 'reader' });
    await page.screenshot({ path: `${out}/desktop-accesso.png` });
    await acc.getByRole('button', { name: 'Chiudi' }).click();
    // Proprietà (Alt+Invio): dimensione, proprietario, versioni
    await tessera(page, 'Rogito casa').click();
    await page.keyboard.press('Alt+Enter');
    const pr = page.getByRole('dialog', { name: /Proprietà/ });
    await pr.getByText('io@example.com').waitFor();
    await pr.getByText('Cronologia versioni su Drive').waitFor();
    assert.match(await pr.textContent(), /2,3 MB/);
    await pr.getByRole('button', { name: 'Chiudi' }).click();
    // F2 rinomina, Esc annulla
    await tessera(page, 'Rogito casa').click();
    await page.keyboard.press('F2');
    await page.getByRole('textbox', { name: 'Nuovo nome' }).press('Escape');
    // Canc → conferma → Annulla con Ctrl+Z: niente va nel Cestino
    await page.keyboard.press('Delete');
    await page.getByRole('alertdialog', { name: 'Elimina' }).getByRole('button', { name: 'Elimina' }).click();
    await page.locator('.esp-avviso', { hasText: 'Cestino di Drive' }).waitFor();
    const av = await page.locator('.esp-avviso').boundingBox();
    assert.ok(Math.abs(1280 - (av.x + av.width) - 16) < 2, 'avviso in basso a destra');
    assert.equal(await tessera(page, 'Rogito casa').count(), 0);
    await page.keyboard.press('Control+z');
    await tessera(page, 'Rogito casa').waitFor();
    await page.waitForTimeout(5300);
    assert.ok(!S.drive.some((b) => b.azione === 'cestina'), 'annullato: nessun file nel Cestino');
    // Visualizza Dettagli: colonne ridimensionabili e ordinabili
    await page.getByRole('button', { name: /^Visualizza/ }).click();
    await page.waitForTimeout(500);
    await voceMenu(page, 'Dettagli').click();
    await page.locator('.esp-dettagli').waitFor();
    const col = page.getByRole('columnheader').nth(1);
    const w0 = (await col.boundingBox()).width;
    const handle = await page.locator('.esp-ridimensiona').first().boundingBox();
    await page.mouse.move(handle.x + 3, handle.y + 5); await page.mouse.down(); await page.mouse.move(handle.x + 83, handle.y + 5, { steps: 5 }); await page.mouse.up();
    const nome0 = (await page.getByRole('columnheader').first().boundingBox()).width;
    assert.ok(nome0 > 280 - 2, `colonna Nome allargata (${nome0})`);
    assert.ok((await col.boundingBox()).width === w0, 'le altre colonne restano uguali');
    await page.getByRole('button', { name: /^Dimensione/ }).click();
    assert.deepEqual(await page.locator('.esp-dettagli-riga .esp-dettagli-testo').allInnerTexts(), ['Utenze', 'IMU 2026', 'Rogito casa']);
    await page.getByRole('button', { name: /^Dimensione/ }).click();
    assert.deepEqual(await page.locator('.esp-dettagli-riga .esp-dettagli-testo').allInnerTexts(), ['Utenze', 'Rogito casa', 'IMU 2026']);
    assert.match(await page.getByRole('columnheader').nth(3).textContent(), /▼/);
    await page.screenshot({ path: `${out}/desktop-dettagli.png` });
    // errore con Riprova in basso a destra
    S.driveGiu = true;
    await page.locator('.esp-dettagli-riga', { hasText: 'IMU 2026' }).click();
    await page.keyboard.press('F2');
    const r2 = page.getByRole('textbox', { name: 'Nuovo nome' });
    await r2.fill('IMU saldo'); await r2.press('Enter');
    await page.locator('.esp-avviso.errore button', { hasText: 'Riprova' }).waitFor();
    assert.equal(await page.locator('.esp-dettagli-riga', { hasText: 'IMU 2026' }).count(), 1, 'il nome resta quello di prima');
    await page.screenshot({ path: `${out}/desktop-errore.png` });
    S.driveGiu = false;
    await page.locator('.esp-avviso button', { hasText: 'Riprova' }).click();
    await page.locator('.esp-dettagli-riga', { hasText: 'IMU saldo' }).waitFor();
    // Accesso rapido
    await page.locator('.esp-dettagli-riga', { hasText: 'Utenze' }).click({ button: 'right' });
    await page.waitForTimeout(500);
    await voceMenu(page, 'Aggiungi ad Accesso rapido').click();
    await page.locator('.esp-avviso', { hasText: 'Aggiunta ad Accesso rapido' }).waitFor();
    assert.deepEqual(S.PREFERITI, [{ tipo: 'cartella', id: 'utenze' }]);
    assert.ok(await page.locator('.esp-albero li[aria-expanded] ul .esp-albero-nome', { hasText: 'Utenze' }).count() >= 1);
    assert.ok(await senzaSforamento(page), 'nessuno sforamento orizzontale (desktop)');
    assert.deepEqual(T.errors, []);
    await T.context.close();
  }

  /* ================= TELEFONO ORIZZONTALE 844×390 ================= */
  {
    const T = await avvia(browser, { width: 844, height: 390, nome: 'orizzontale', touch: true });
    const { page } = T;
    await tessera(page, 'Cartella Casa').waitFor();
    assert.ok(await page.locator('.esp-orizzontale').count());
    // PR #337 §2: su un telefono anche in orizzontale il pannello è un cassetto (hamburger)
    assert.equal(await page.locator('.esp-albero').count(), 0);
    await page.getByRole('button', { name: 'Pannello di navigazione' }).tap();
    await page.locator('.esp-cassetto').waitFor(); await page.waitForTimeout(350);
    assert.ok(await dentroSchermo(page, '.esp-cassetto'));
    await page.locator('.esp-velo-cassetto').tap({ position: { x: 820, y: 200 } });
    await page.locator('.esp-cassetto').waitFor({ state: 'detached' });
    await page.screenshot({ path: `${out}/orizzontale.png` });
    await premi(T, tessera(page, 'Cartella Auto'));
    await page.locator('.esp-foglio-menu').waitFor(); await page.waitForTimeout(300);
    assert.ok(await dentroSchermo(page, '.esp-foglio-menu'));
    assert.ok(await senzaSforamento(page));
    assert.deepEqual(T.errors, []);
    await T.context.close();
  }

  /* modalità scura (foto) */
  {
    const T = await avvia(browser, { width: 1280, height: 800, nome: 'scura', touch: false });
    await T.page.emulateMedia({ colorScheme: 'dark' });
    await tessera(T.page, 'Cartella Casa').dblclick();
    await tessera(T.page, 'Rogito casa').click({ button: 'right' });
    await T.page.waitForTimeout(400);
    await T.page.screenshot({ path: `${out}/desktop-scura.png` });
    assert.deepEqual(T.errors, []);
    await T.context.close();
  }
  console.log('personal-esplora PASS');
} finally { await browser?.close(); server.kill(); }
