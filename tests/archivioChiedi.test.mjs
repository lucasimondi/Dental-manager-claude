// POL-VITA-030 ARCHIVIO-CHIEDI — interprete della domanda, ricerca nuova con ritorno a quella vecchia,
// migrazioni solo additive, Documenti che si apre su «Chiedi» con la vista classica raggiungibile.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { interpretaDomanda, riepilogoImporti } from '../personal/src/lib/interpreta.js';
import { cercaChiedi } from '../personal/src/lib/archivio.js';

const oggi = new Date(2026, 10, 12); // 12 novembre 2026
const persone = ['Giulia Rossi', 'Martina'];

test('anno, importo minimo e parole restanti', () => {
  const r = interpretaDomanda('bollette luce 2025 sopra 100 €', { oggi, persone });
  assert.equal(r.testo, 'bollette luce');
  assert.deepEqual(r.filtri, { importo_min: 100, da: '2025-01-01', a: '2025-12-31' });
  assert.ok(r.etichette.includes('Anno 2025'));
  assert.equal(r.somma, false);
});

test('"quanto ho speso … quest\'anno" chiede un totale', () => {
  const r = interpretaDomanda('quanto ho speso di pellet quest’anno?', { oggi, persone });
  assert.equal(r.testo, 'pellet');
  assert.equal(r.somma, true);
  assert.equal(r.filtri.da, '2026-01-01');
  assert.ok(r.etichette.includes('Totale degli importi'));
});

test('mese senza anno: se è più avanti di oggi vale l\'anno scorso', () => {
  assert.deepEqual(interpretaDomanda('fatture marzo', { oggi }).filtri, { da: '2026-03-01', a: '2026-03-31' });
  assert.deepEqual(interpretaDomanda('dicembre', { oggi }).filtri, { da: '2025-12-01', a: '2025-12-31' });
  assert.deepEqual(interpretaDomanda('luce mese scorso', { oggi }).filtri, { da: '2026-10-01', a: '2026-10-31' });
  assert.deepEqual(interpretaDomanda('febbraio 2024', { oggi }).filtri, { da: '2024-02-01', a: '2024-02-29' });
});

test('intervallo di importi con migliaia', () => {
  const r = interpretaDomanda('polizza auto tra 50 e 1.200 euro', { oggi });
  assert.equal(r.testo, 'polizza auto');
  assert.equal(r.filtri.importo_min, 50);
  assert.equal(r.filtri.importo_max, 1200);
});

test('accenti e apostrofi non contano; la persona resta parola di ricerca', () => {
  const r = interpretaDomanda('carta d\'identità di Giulia', { oggi, persone });
  assert.equal(r.testo, 'carta identita giulia');
  assert.equal(r.persona, 'Giulia Rossi');
  assert.ok(r.etichette.includes('Persona: Giulia Rossi'));
  assert.equal(r.filtri.persona, undefined);
});

test('domanda vuota o di sole parole inutili', () => {
  assert.equal(interpretaDomanda('', { oggi }).vuota, true);
  assert.equal(interpretaDomanda('i miei documenti', { oggi }).vuota, true);
});

test('riepilogo importi: totale e barre per mese', () => {
  const r = riepilogoImporti([
    { importo: 100, data_documento: '2026-01-10' }, { importo: '50.5', data_documento: '2026-01-20' },
    { importo: 200, email_data: '2026-03-02T10:00:00Z' }, { importo: null, data_documento: '2026-02-01' },
  ]);
  assert.equal(r.totale, 350.5);
  assert.equal(r.n, 3);
  assert.deepEqual(r.barre.map((b) => [b.chiave, b.altezza]), [['2026-01', 75], ['2026-03', 100]]);
});

function db(rispostaRpc) {
  const chiamate = [];
  const catena = (q) => new Proxy({}, { get(_t, m) {
    if (m === 'then') return (ok) => Promise.resolve(q.risposta).then(ok);
    return (...a) => { q.passi.push([m, ...a]); return catena(q); };
  } });
  return {
    chiamate,
    rpc(nome, arg) { const q = { nome, arg, passi: [], risposta: rispostaRpc }; chiamate.push(q); return catena(q); },
    from(t) { const q = { nome: `from:${t}`, passi: [], risposta: { data: [{ id: 'vecchia' }], error: null } }; chiamate.push(q); return catena(q); },
  };
}

test('cercaChiedi usa cerca_archivio_v2 con i filtri interpretati', async () => {
  const d = db({ data: [{ id: 'a' }], error: null });
  const r = await cercaChiedi(d, { testo: 'luce', filtri: { da: '2025-01-01', a: '2025-12-31' }, limite: 50 });
  assert.deepEqual(r, [{ id: 'a' }]);
  assert.equal(d.chiamate[0].nome, 'cerca_archivio_v2');
  assert.deepEqual(d.chiamate[0].arg, { p_testo: 'luce', p_filtri: { da: '2025-01-01', a: '2025-12-31', poco_utili: false }, p_lim: 50 });
});

test('se la funzione nuova manca torna alla ricerca di prima', async () => {
  const d = db({ data: null, error: { message: 'function not found' } });
  const r = await cercaChiedi(d, { testo: 'luce', filtri: { da: '2025-01-01', a: '2025-12-31' } });
  assert.deepEqual(r, [{ id: 'vecchia' }]);
  assert.equal(d.chiamate[1].nome, 'from:documenti');
});

test('migrazioni POL-VITA-030 solo additive, funzione con RLS del chiamante', () => {
  const dir = 'supabase/archivio/migrations';
  const file = readdirSync(dir).filter((f) => f.includes('pol_vita_030'));
  assert.equal(file.length, 3);
  for (const f of file) {
    const sql = readFileSync(`${dir}/${f}`, 'utf8').toLowerCase();
    assert.ok(!/\bdrop\s+(table|column|function|index|trigger)\b/.test(sql), `${f}: niente drop`);
    assert.ok(!/\bdelete\s+from\b/.test(sql), `${f}: niente delete`);
    assert.ok(!/\btruncate\s+(table\s+)?\w/.test(sql.replace(/revoke[^;]*;/g, '')), `${f}: niente truncate`);
    if (sql.includes('function cerca_archivio_v2')) {
      assert.match(sql, /security invoker/);
      assert.match(sql, /revoke all on function cerca_archivio_v2\(text, jsonb, integer\) from public, anon/);
    }
  }
  const sinonimi = readFileSync(`${dir}/${file.find((f) => f.includes('chiedi'))}`, 'utf8');
  assert.match(sinonimi, /create policy proprietario on sinonimi_ricerca[\s\S]*e_proprietario/);
});

test('Documenti si apre su Chiedi e la vista classica resta raggiungibile', () => {
  const src = readFileSync('personal/src/sezioni/documenti/Documenti.jsx', 'utf8');
  assert.match(src, /<VistaChiedi ctx=\{ctx\} onClassica=/);
  assert.match(src, /Torna a «Chiedi»/);
  assert.match(src, /function VistaClassica/);
  const chiedi = readFileSync('personal/src/sezioni/documenti/Chiedi.jsx', 'utf8');
  assert.match(chiedi, /Vista classica/);
  assert.match(chiedi, /cercaChiedi\(/);
  assert.ok(!/anthropic|gemini|fetch\(/i.test(chiedi), 'nessun modello o servizio esterno');
});
