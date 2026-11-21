// PERSONAL-ESPLORA-WIN11 fase 1: synthetic data only, real touch (CDP) at 390×844 and 844×390.
// Tree + grid, tap opens, long press + move drags (file and folder), long press still = context menu,
// Annulla reverses, invalid targets refused, Sposta in…, new folder inline, Da catalogare → Personale.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
const out = 'tests/visual/results-personal-esplora'; await mkdir(out, { recursive: true });
const PORTA = 5181;
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', String(PORTA), '--strictPort'], { stdio: 'ignore' });
const cart = (id, nome, padre_id, posizione = 0) => ({ id, nome, padre_id, colore: null, posizione, creato_il: '2026-11-01T10:00:00Z', modificato_il: '2026-11-01T10:00:00Z', archiviata_il: null, speciale: null, drive_cartella_id: null });
const doc = (id, titolo, fascicolo = 'utenze', mime = 'application/pdf', extra = {}) => ({ id, titolo, ente: 'Ente', fascicolo, data_documento: '2026-10-01', email_data: '2026-10-01T09:00:00Z', creato_il: '2026-10-01T09:00:00Z', drive_file_id: `f-${id}`, nome_file_originale: `${id}.pdf`, mime_type: mime, tag: [], azione_richiesta: false, ...extra });

const scenario = () => {
  const s = {
    CARTELLE: [cart('casa', 'Casa', null, 0), cart('utenze', 'Utenze', 'casa'), cart('luce', 'Luce', 'utenze'), cart('auto', 'Auto', null, 1)],
    DOC: {
      rogito: doc('rogito', 'Rogito casa', 'immobili'), imu: doc('imu', 'IMU 2026', 'fiscale', 'application/pdf', { azione_richiesta: true }),
      gas: doc('gas', 'Contratto gas'), bol: doc('bol', 'Bolletta luce'), pol: doc('pol', 'Polizza auto', 'veicoli', 'image/jpeg'),
      n1: doc('n1', 'Ricevuta nuova', 'utenze'), n2: doc('n2', 'Foglio spese', 'utenze', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'),
    },
    LINK: { casa: ['rogito', 'imu'], utenze: ['gas'], luce: ['bol'], auto: [] },
    SCRIVANIA: ['pol'],
    chiamate: [],
    drive: [],
    driveGiu: false,
  };
  return s;
};

const avvia = async (browser, { width, height, nome }) => {
  const S = scenario();
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const catalogati = () => new Set([...Object.values(S.LINK).flat(), ...S.SCRIVANIA]);
  await page.route('**/*', async (route) => {
    const req = route.request(); const u = new URL(req.url());
    if (u.hostname === '127.0.0.1') return route.continue();
    if (u.hostname === 'script.google.com') {
      const b = JSON.parse(req.postData() || '{}'); S.drive.push(b);
      if (S.driveGiu) return route.abort();
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
      return route.fulfill({ json: ids.map((id) => ({ id, ...b })) });
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
      if (m === 'DELETE') { const ids = (u.searchParams.get('documento_id') || '').replace(/^in\.\(|\)$/g, '').split(',').map((x) => x.replace(/"/g, '')); S.chiamate.push(['scrivania-', ids]); S.SCRIVANIA = S.SCRIVANIA.filter((x) => !ids.includes(x)); return route.fulfill({ json: ids.map((documento_id) => ({ documento_id })) }); }
      return route.fulfill({ json: S.SCRIVANIA.map((id) => ({ documento_id: id, aggiunto_il: '2026-11-01T10:00:00Z', documenti: S.DOC[id] })) });
    }
    if (p.endsWith('/cartelle_mie_documenti')) {
      const f = u.searchParams.get('cartella_id');
      if (f?.startsWith('eq.')) { const id = f.slice(3); return route.fulfill({ json: (S.LINK[id] || []).map((d) => ({ aggiunto_il: '2026-11-01T10:00:00Z', documenti: S.DOC[d] })) }); }
      return route.fulfill({ json: Object.entries(S.LINK).flatMap(([c, ds]) => ds.map((d) => ({ cartella_id: c, documento_id: d, documenti: { fascicolo: S.DOC[d].fascicolo } }))) });
    }
    if (p.endsWith('/scadenze')) return route.fulfill({ json: [{ id: 's1', data: '2026-11-25', importo: 40, completata: false, storica: false, documento_id: 'gas', documento: { id: 'gas', titolo: 'Contratto gas', fascicolo: 'utenze', tipo_documento: 'avviso', tag: [] } }] });
    if (p.endsWith('/documenti') && m === 'PATCH') { S.chiamate.push(['documenti', u.searchParams.get('id'), corpo()]); return route.fulfill({ json: [] }); }
    if (p.endsWith('/documenti')) {
      if (m === 'HEAD') return route.fulfill({ status: 200, headers: { 'content-range': `*/${Object.keys(S.DOC).length}`, 'access-control-allow-origin': '*', 'access-control-expose-headers': 'Content-Range' }, body: '' });
      if (u.searchParams.get('azione_richiesta')) return route.fulfill({ json: Object.values(S.DOC).filter((d) => d.azione_richiesta).map(({ id, fascicolo }) => ({ id, fascicolo, azione_richiesta: true })) });
      const fasc = u.searchParams.get('fascicolo');
      let righe = Object.values(S.DOC);
      if (fasc?.startsWith('eq.')) righe = righe.filter((d) => d.fascicolo === fasc.slice(3));
      return route.fulfill({ json: righe });
    }
    return route.fulfill({ json: [] });
  });
  await page.goto(`http://127.0.0.1:${PORTA}/tests/visual/personal-esplora.html`);
  await page.locator('.esp-albero').waitFor();
  return { S, page, context, errors, cdp: await context.newCDPSession(page), catalogati, nome, width, height };
};

const centro = async (loc) => { const b = await loc.boundingBox(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; };
const premi = async ({ cdp, page }, loc, verso = null, foto = null, out2 = null) => {
  const a = await centro(loc);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [a] });
  await page.waitForTimeout(560);
  if (!verso) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await page.waitForTimeout(250); return; }
  const b = await centro(verso);
  for (let i = 1; i <= 12; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: a.x + ((b.x - a.x) * i) / 12, y: a.y + ((b.y - a.y) * i) / 12 }] });
  await page.waitForTimeout(100);
  if (foto) await page.screenshot({ path: `${out2}/${foto}.png` });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(300);
};
const tessera = (page, nome) => page.locator(`.esp-griglia .esp-tessera-bottone[aria-label="${nome}"]`);
const ramo = (page, nome) => page.locator('.esp-albero-nome', { hasText: new RegExp(`^${nome}`) }).first();
const dentroSchermo = async (page, sel) => page.evaluate((s) => { const r = document.querySelector(s)?.getBoundingClientRect(); return !!r && r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight; }, sel);
const senzaSforamento = async (page) => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1 && document.querySelector('.esp').scrollWidth <= document.querySelector('.esp').clientWidth + 1);

let browser;
try {
  for (let i = 0; i < 100; i++) { try { if ((await fetch(`http://127.0.0.1:${PORTA}`)).ok) break; } catch {} await new Promise((r) => setTimeout(r, 100)); }
  browser = await chromium.launch({ ...(process.env.CHROMIUM_EXECUTABLE ? { executablePath: process.env.CHROMIUM_EXECUTABLE } : {}), args: ['--no-sandbox', '--disable-dev-shm-usage'] });

  /* ---------- verticale 390×844 ---------- */
  {
    const T = await avvia(browser, { width: 390, height: 844, nome: 'verticale' });
    const { page, S } = T;
    await tessera(page, 'Cartella Casa').waitFor();
    assert.ok(await page.locator('.esp-verticale').count(), 'disposizione verticale');
    // pallini: Casa = IMU (azione) + gas (scadenza entro 14 giorni, in Utenze) = 2
    assert.equal(await page.locator('.esp-griglia .esp-tessera-bottone[aria-label="Cartella Casa"] .esp-pallino').textContent(), '2');
    assert.equal(await ramo(page, 'Da catalogare').locator('.esp-pallino').textContent(), '2');
    assert.equal(await page.locator('.esp-stato').textContent(), '3 elementi · 2 da gestire');
    await page.screenshot({ path: `${out}/verticale-personale.png` });

    // tocco su una cartella = la apre
    await tessera(page, 'Cartella Casa').click();
    await tessera(page, 'Rogito casa').waitFor();
    assert.equal(await page.locator('.esp-intestazione strong').textContent(), 'Casa');
    assert.equal(await page.locator('.esp-percorso').innerText(), 'Personale\n›\nCasa');
    // tocco su un file = anteprima (pagina Documento)
    await tessera(page, 'Rogito casa').click();
    assert.deepEqual(await page.evaluate(() => window.espTest.aperti.at(-1)), { tipo: 'documento', id: 'rogito' });

    // trascina un file su una cartella dell'albero, poi Annulla
    await premi(T, tessera(page, 'Rogito casa'), ramo(page, 'Auto'), 'verticale-trascina', out);
    await page.locator('.esp-avviso', { hasText: 'Spostato in «Auto»' }).waitFor();
    assert.deepEqual(S.chiamate.at(-1), ['sposta', { p_documenti: ['rogito'], p_da: 'casa', p_a: 'auto' }]);
    assert.equal(await tessera(page, 'Rogito casa').count(), 0);
    // fase 2: subito anche su Drive
    for (let i = 0; i < 30 && !S.drive.length; i++) await page.waitForTimeout(100);
    assert.deepEqual(S.drive.at(-1), { token: 'token-finto', azione: 'sposta_documenti', ids: ['rogito'], cartella_id: 'auto' });
    await page.locator('.esp-avviso button', { hasText: 'Annulla' }).click();
    await tessera(page, 'Rogito casa').waitFor();
    assert.deepEqual(S.chiamate.at(-1), ['sposta', { p_documenti: ['rogito'], p_da: 'auto', p_a: 'casa' }]);

    // una cartella non va dentro una sua sottocartella: nessuna chiamata
    const prima = S.chiamate.length;
    await ramo(page, 'Casa').locator('..').locator('.esp-albero-freccia').click(); // apri Casa nell'albero (era già aperta: richiudi/riapri)
    if (!(await ramo(page, 'Utenze').isVisible())) await ramo(page, 'Casa').locator('..').locator('.esp-albero-freccia').click();
    await premi(T, tessera(page, 'Cartella Utenze'), ramo(page, 'Utenze'));
    assert.equal(S.chiamate.length, prima, 'nessuno spostamento dentro sé stessa');

    // pressione prolungata ferma = menu contestuale, dentro lo schermo
    await premi(T, tessera(page, 'IMU 2026'));
    await page.locator('.esp-menu').waitFor(); await page.waitForTimeout(500);
    assert.deepEqual(await page.locator('.esp-menu-voce').allInnerTexts(), ['Apri', 'Taglia', 'Sposta in…', 'Rinomina', 'Elimina']);
    assert.ok(await dentroSchermo(page, '.esp-menu'), 'menu dentro lo schermo');
    await page.screenshot({ path: `${out}/verticale-menu-file.png` });
    await page.locator('.esp-menu-voce', { hasText: 'Sposta in…' }).click();
    await page.locator('.esp-sposta').waitFor();
    await page.waitForTimeout(300); // fine dell'animazione dal basso
    assert.ok(await dentroSchermo(page, '.esp-sposta'), 'foglio dentro lo schermo');
    assert.ok(await page.locator('.esp-sposta-lista button', { hasText: 'Casa' }).locator('em', { hasText: 'attuale' }).count());
    assert.equal(await page.locator('.esp-sposta-lista button', { hasText: 'Casa' }).isDisabled(), true);
    await page.screenshot({ path: `${out}/verticale-sposta-in.png` });
    await page.locator('.esp-sposta-lista button', { hasText: 'Luce' }).click();
    await page.locator('.esp-avviso', { hasText: 'Spostato in «Luce»' }).waitFor();
    assert.deepEqual(S.chiamate.at(-1), ['sposta', { p_documenti: ['imu'], p_da: 'casa', p_a: 'luce' }]);
    // il pallino si ricalcola: Utenze ora conta anche IMU (in Luce, sua sottocartella)
    assert.equal(await page.locator('.esp-griglia .esp-tessera-bottone[aria-label="Cartella Utenze"] .esp-pallino').textContent(), '2');

    // pressione prolungata sullo spazio vuoto: Nuova cartella inline
    await page.locator('.esp-avviso').waitFor({ state: 'detached', timeout: 8000 }); // l'avviso sparisce da solo dopo 4,5 s
    const vuoto = page.locator('.esp-contenuto');
    const bb = await vuoto.boundingBox();
    await T.cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: bb.x + bb.width / 2, y: bb.y + bb.height - 30 }] });
    await page.waitForTimeout(600);
    await T.cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.locator('.esp-menu').waitFor(); await page.waitForTimeout(500);
    assert.deepEqual(await page.locator('.esp-menu-voce').allInnerTexts(), ['Nuova cartella', 'Incolla', 'Aggiorna']);
    await page.locator('.esp-menu-voce', { hasText: 'Nuova cartella' }).click();
    const campo = page.getByRole('textbox', { name: 'Nome della nuova cartella' });
    await campo.waitFor();
    assert.equal(await campo.inputValue(), 'Nuova cartella');
    assert.equal(await campo.evaluate((el) => el.selectionStart === 0 && el.selectionEnd === el.value.length), true, 'nome già selezionato');
    await page.screenshot({ path: `${out}/verticale-nuova-cartella.png` });
    await campo.fill('Mutuo');
    await campo.press('Enter');
    await tessera(page, 'Cartella Mutuo').waitFor();
    assert.deepEqual(S.chiamate.at(-1), ['crea', { nome: 'Mutuo', padre_id: 'casa' }]);
    for (let i = 0; i < 30 && S.drive.at(-1)?.azione !== 'cartella_drive'; i++) await page.waitForTimeout(100);
    assert.equal(S.drive.at(-1).azione, 'cartella_drive');
    // Drive non raggiungibile: lo spostamento resta fatto nell'app e lo script lo recupera
    S.driveGiu = true;

    // Esc annulla una nuova cartella
    await page.locator('.esp-cmd-testo').click();
    await page.getByRole('textbox', { name: 'Nome della nuova cartella' }).press('Escape');
    await page.waitForTimeout(200);
    assert.equal(S.chiamate.filter((c) => c[0] === 'crea').length, 1, 'Esc non crea niente');
    assert.equal(await page.getByRole('textbox', { name: 'Nome della nuova cartella' }).count(), 0);

    // Da catalogare: in sola lettura; trascina un documento su «Personale»
    await ramo(page, 'Da catalogare').click();
    await tessera(page, 'Ricevuta nuova').waitFor();
    assert.equal(await tessera(page, 'Rogito casa').count(), 0, 'i documenti già in cartella non sono da catalogare');
    await page.screenshot({ path: `${out}/verticale-da-catalogare.png` });
    await premi(T, tessera(page, 'Ricevuta nuova'), ramo(page, 'Personale'));
    await page.locator('.esp-avviso', { hasText: 'Spostato in «Personale»' }).waitFor();
    assert.ok(S.chiamate.some((c) => c[0] === 'scrivania+' && c[1].join() === 'n1'));
    await page.locator('.esp-avviso', { hasText: 'Su Drive lo sistemo al prossimo giro' }).waitFor();
    assert.ok(S.chiamate.some((c) => c[0] === 'documenti' && c[1] === 'in.(n1)' && c[2].drive_cartella === '>cartella:radice' && c[2].drive_fissa === true));
    S.driveGiu = false;
    assert.equal(await tessera(page, 'Ricevuta nuova').count(), 0);
    // nelle cartelle virtuali non si lascia niente
    const n = S.chiamate.length;
    await premi(T, tessera(page, 'Foglio spese'), ramo(page, 'Per categoria'));
    assert.equal(S.chiamate.length, n);

    // menu della cartella «Personale»: voci non applicabili disattivate
    await premi(T, ramo(page, 'Personale'));
    await page.locator('.esp-menu').waitFor(); await page.waitForTimeout(500);
    const dis = await page.locator('.esp-menu-voce').evaluateAll((els) => els.map((e) => `${e.textContent}:${e.disabled ? 'no' : 'si'}`));
    assert.deepEqual(dis, ['Apri:si', 'Nuova cartella qui:si', 'Taglia:no', 'Sposta in…:no', 'Rinomina:no', 'Elimina:no']);
    await page.locator('.esp-velo-menu').click({ position: { x: 5, y: 5 } });

    // Per categoria: niente pazienti
    await ramo(page, 'Per categoria').click();
    await tessera(page, 'Cartella Utenze').waitFor();
    assert.equal(await tessera(page, 'Cartella Pazienti').count(), 0);

    assert.ok(await senzaSforamento(page), 'nessuno sforamento orizzontale (verticale)');
    assert.deepEqual(T.errors, []);
    await T.context.close();
  }

  /* ---------- orizzontale 844×390 ---------- */
  {
    const T = await avvia(browser, { width: 844, height: 390, nome: 'orizzontale' });
    const { page, S } = T;
    await tessera(page, 'Cartella Casa').waitFor();
    assert.ok(await page.locator('.esp-orizzontale').count(), 'disposizione orizzontale');
    await page.waitForTimeout(400); // fine dell'animazione d'ingresso della pagina
    const albero = await page.locator('.esp-albero').boundingBox();
    const contenuto = await page.locator('.esp-contenuto').boundingBox();
    assert.ok(Math.abs(albero.width - 200) < 2 && contenuto.x >= albero.x + albero.width - 1, 'albero a sinistra, contenuto di fianco');
    const colonne = await page.locator('.esp-griglia').evaluate((g) => getComputedStyle(g).gridTemplateColumns.split(' ').length);
    assert.equal(colonne, 6);
    await page.screenshot({ path: `${out}/orizzontale-personale.png` });
    // trascina una cartella su un'altra (Auto dentro Casa) e Annulla
    await premi(T, tessera(page, 'Cartella Auto'), tessera(page, 'Cartella Casa'), 'orizzontale-trascina-cartella', out);
    await page.locator('.esp-avviso', { hasText: 'Spostato in «Casa»' }).waitFor();
    assert.deepEqual(S.chiamate.at(-1), ['cartelle', ['auto'], { padre_id: 'casa' }]);
    await page.locator('.esp-avviso button', { hasText: 'Annulla' }).click();
    await tessera(page, 'Cartella Auto').waitFor();
    assert.deepEqual(S.chiamate.at(-1), ['cartelle', ['auto'], { padre_id: null }]);
    // menu su cartella e foglio Sposta in… come finestra di dialogo
    await premi(T, tessera(page, 'Cartella Auto'));
    await page.locator('.esp-menu').waitFor(); await page.waitForTimeout(500);
    assert.ok(await dentroSchermo(page, '.esp-menu'), 'menu dentro lo schermo (orizzontale)');
    await page.screenshot({ path: `${out}/orizzontale-menu-cartella.png` });
    await page.locator('.esp-menu-voce', { hasText: 'Sposta in…' }).click();
    await page.locator('.esp-dialogo-orizzontale.esp-sposta').waitFor();
    assert.ok(await dentroSchermo(page, '.esp-sposta'), 'dialogo dentro lo schermo');
    await page.screenshot({ path: `${out}/orizzontale-sposta-in.png` });
    await page.getByRole('dialog').getByRole('button', { name: 'Annulla' }).click();
    // Elimina cartella = archivia, con Annulla
    await premi(T, tessera(page, 'Cartella Auto'));
    await page.locator('.esp-menu').waitFor(); await page.waitForTimeout(500);
    await page.locator('.esp-menu-voce', { hasText: 'Elimina' }).click();
    await page.locator('.esp-avviso', { hasText: 'archiviata' }).waitFor();
    assert.equal(S.chiamate.at(-1)[0], 'cartelle');
    assert.ok(S.chiamate.at(-1)[2].archiviata_il);
    await page.locator('.esp-avviso button', { hasText: 'Annulla' }).click();
    await tessera(page, 'Cartella Auto').waitFor();
    assert.equal(S.chiamate.at(-1)[2].archiviata_il, null);
    assert.ok(await senzaSforamento(page), 'nessuno sforamento orizzontale (orizzontale)');
    assert.deepEqual(T.errors, []);
    await T.context.close();
  }

  /* ---------- modalità scura (solo foto) ---------- */
  {
    const T = await avvia(browser, { width: 390, height: 844, nome: 'scura' });
    await T.page.emulateMedia({ colorScheme: 'dark' });
    await tessera(T.page, 'Cartella Casa').waitFor();
    await T.page.screenshot({ path: `${out}/verticale-scura.png` });
    assert.deepEqual(T.errors, []);
    await T.context.close();
  }
  console.log('personal-esplora PASS');
} finally { await browser?.close(); server.kill(); }
