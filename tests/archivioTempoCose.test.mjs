// POL-VITA-032 ARCHIVIO-TEMPO / ARCHIVIO-COSE — anni e mesi, fatti dai documenti, scadenze per cosa, vista solo additiva.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { COSE, cosaDi, anniDaMesi, mesiDaRighe, etichettaMese, fattiDaDocumenti, scadenzePerCosa, coseConPersone } from '../personal/src/lib/vita.js';

const righe = [
  { mese: '2026-10-01', fascicolo: 'utenze', n: 3 }, { mese: '2026-10-01', fascicolo: 'veicoli', n: 1 },
  { mese: '2026-02-01', fascicolo: 'conti', n: 2 }, { mese: '2025-12-01', fascicolo: 'utenze', n: 4 },
  { mese: '2025-12-01', fascicolo: 'pubblicita', n: 6 },
];

test('ogni categoria sta al massimo in una cosa; i pazienti in nessuna', () => {
  const tutte = COSE.flatMap((c) => c.fascicoli);
  assert.equal(new Set(tutte).size, tutte.length);
  assert.equal(cosaDi('clinico_pazienti'), null);
  assert.equal(cosaDi('veicoli').id, 'auto');
});

test('anni: totale e barra per cosa; filtro per cosa', () => {
  const a = anniDaMesi(righe);
  assert.deepEqual(a.map((x) => [x.anno, x.n]), [['2026', 6], ['2025', 10]]);
  assert.deepEqual(a[0].seg.map((s) => [s.id, s.n]), [['casa', 3], ['auto', 1], ['soldi', 2]]);
  assert.ok(a[1].seg.some((s) => s.id === 'altro' && s.n === 6));
  assert.deepEqual(anniDaMesi(righe, 'casa').map((x) => [x.anno, x.n]), [['2026', 3], ['2025', 4]]);
});

test('mesi dal più recente, per cosa e per anno', () => {
  assert.deepEqual(mesiDaRighe(righe).map((m) => [m.mese, m.n]), [['2026-10-01', 4], ['2026-02-01', 2], ['2025-12-01', 10]]);
  assert.deepEqual(mesiDaRighe(righe, 'auto').map((m) => m.mese), ['2026-10-01']);
  assert.deepEqual(mesiDaRighe(righe, 'tutto', '2025').map((m) => m.etichetta), ['Dicembre 2025']);
  assert.equal(etichettaMese('2026-03-01'), 'Marzo 2026');
});

test('fatti: il valore più recente per chiave, mai IBAN o codici fiscali', () => {
  const docs = [
    { id: 'a', data_documento: '2024-01-01', dati_estratti: { targa: 'AA111AA', 'numero polizza': 'P-1' } },
    { id: 'b', data_documento: '2026-01-01', dati_estratti: { targa: 'BB222BB', IBAN: 'IT00X', 'codice fiscale': 'XXX', note: 'x' } },
  ];
  const f = fattiDaDocumenti(docs, COSE.find((c) => c.id === 'auto').chiavi);
  assert.deepEqual(f.map((x) => [x.k, x.v, x.doc]), [['Targa', 'BB222BB', 'b'], ['Numero polizza', 'P-1', 'a']]);
  assert.deepEqual(fattiDaDocumenti(docs, [/.*/]).map((x) => x.k).filter((k) => /iban|codice fiscale/i.test(k)), []);
});

test('scadenze assegnate alla cosa giusta; persone per nome; pazienti esclusi', () => {
  const cose = coseConPersone(['Giulia Prova']);
  const s = scadenzePerCosa(
    [{ id: 1, documento_id: 'd1', descrizione: 'Revisione' }, { id: 2, documento_id: 'd2', descrizione: 'IMU saldo' }, { id: 3, documento_id: null, descrizione: 'Visita di Giulia' }, { id: 4, documento_id: 'p', descrizione: 'Controllo' }],
    [{ id: 'd1', fascicolo: 'veicoli' }, { id: 'd2', fascicolo: 'immobili' }, { id: 'p', fascicolo: 'clinico_pazienti' }], cose);
  assert.deepEqual(s.auto.map((x) => x.id), [1]);
  assert.deepEqual(s.casa.map((x) => x.id), [2]);
  assert.deepEqual(s['persona:Giulia Prova'].map((x) => x.id), [3]);
  assert.ok(!Object.values(s).flat().some((x) => x.id === 4));
});

test('vista v_tempo_mesi: solo aggiunta, RLS di chi legge, pazienti e poco utili esclusi', () => {
  const sql = readFileSync('supabase/archivio/migrations/20261113120000_pol_vita_032_tempo.sql', 'utf8').toLowerCase();
  assert.match(sql, /security_invoker = true/);
  assert.match(sql, /is distinct from 'clinico_pazienti'/);
  assert.match(sql, /rilevanza <> 'bassa'/);
  assert.ok(!/\b(drop|delete|alter table|truncate)\b/.test(sql.replace(/revoke[^;]*;/g, '')));
});

test('Documenti: tre porte e vista classica', () => {
  const src = readFileSync('personal/src/sezioni/documenti/Documenti.jsx', 'utf8');
  assert.match(src, /\['chiedi', 'Chiedi'\], \['cose', 'Le mie cose'\], \['tempo', 'Tempo'\]/);
  assert.match(src, /<VistaCose ctx=\{ctx\} \/>/);
  assert.match(src, /<VistaTempo ctx=\{ctx\} \/>/);
  assert.match(readFileSync('personal/src/sezioni/documenti/index.jsx', 'utf8'), /cosa: \{ titolo: 'Le mie cose'/);
});
