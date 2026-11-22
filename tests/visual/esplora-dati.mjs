// PR #337 — dati sintetici e risposte di rete comuni ai test visivi di Esplora (nessun dato reale).
export const cart = (id, nome, padre_id, posizione = 0) => ({ id, nome, padre_id, colore: null, posizione, creato_il: '2026-11-01T10:00:00Z', modificato_il: '2026-11-01T10:00:00Z', archiviata_il: null, speciale: null, drive_cartella_id: null });
export const doc = (id, titolo, fascicolo = 'utenze', mime = 'application/pdf', extra = {}) => ({ id, titolo, ente: 'Ente', fascicolo, data_documento: '2026-10-01', email_data: '2026-10-01T09:00:00Z', creato_il: '2026-10-01T09:00:00Z', drive_file_id: `f-${id}`, drive_url: `https://drive.google.com/file/d/f-${id}/view`, nome_file_originale: `${id}.pdf`, mime_type: mime, tag: [], azione_richiesta: false, dimensione_byte: 120000, ...extra });
export const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

export const scenario = () => ({
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

export const avvia = async (browser, { width, height, nome, touch, url = 'personal-esplora.html', porta = 5181, colore = 'light', attendi = '.esp-albero' }) => {
  const S = scenario();
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, hasTouch: touch, isMobile: touch, colorScheme: colore });
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
    if (p.endsWith('/rpc/cerca_archivio_v2')) { const q = (corpo()?.p_testo || '').toLowerCase(); S.chiamate.push(['cerca', q]); return route.fulfill({ json: Object.values(S.DOC).filter((d) => `${d.titolo} ${d.riassunto || ''}`.toLowerCase().includes(q) || (S.TESTI?.[d.id] || '').includes(q)) }); }
    if (S.extra) { const r = await S.extra(route, { u, p, m, corpo }); if (r !== undefined) return r; }
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
  await page.goto(`http://127.0.0.1:${porta}/tests/visual/${url}`);
  if (attendi) await page.locator(attendi).first().waitFor();
  await page.waitForTimeout(300);
  return { S, page, context, errors, cdp: touch ? await context.newCDPSession(page) : null, nome, width, height };
};

