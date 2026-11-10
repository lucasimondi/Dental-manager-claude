import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { eMiaSalute, tipoSalute, tagSalute, ordinaSalute, documentiSalute, impostaSalute, TAG_SALUTE, TAG_NON_SALUTE, io } from '../personal/src/lib/salute.js';
import { condividi } from '../personal/src/lib/condividi.js';

const IO = 'Persona Uno';
test('La mia salute: tag or own sanitario_famiglia; never patients; explicit removal wins', () => {
  assert.equal(eMiaSalute({ fascicolo: 'sanitario_famiglia', persona: IO }, IO), true);
  assert.equal(eMiaSalute({ fascicolo: 'sanitario_famiglia', persona: 'Persona Due' }, IO), false);
  assert.equal(eMiaSalute({ fascicolo: 'sanitario_famiglia', persona: null }, IO), false);
  assert.equal(eMiaSalute({ fascicolo: 'foto_video', tag: [TAG_SALUTE] }, IO), true);
  assert.equal(eMiaSalute({ fascicolo: 'clinico_pazienti', tag: [TAG_SALUTE], persona: IO }, IO), false);
  assert.equal(eMiaSalute({ fascicolo: 'sanitario_famiglia', persona: IO, tag: [TAG_NON_SALUTE] }, IO), false);
  assert.equal(io({ persone: [IO, 'Persona Due'] }), IO);
});
test('tipo: receipts, prescriptions, reports', () => {
  assert.equal(tipoSalute({ tipo_documento: 'fattura', titolo: 'Fattura visita' }), 'spese');
  assert.equal(tipoSalute({ titolo: 'Ricetta elettronica – NRE 010A' }), 'ricette');
  assert.equal(tipoSalute({ titolo: 'Referto – visita gastroenterologica' }), 'referti');
  assert.equal(tipoSalute({ titolo: 'Ecografia addome' }), 'referti');
  assert.equal(tipoSalute({ titolo: 'Informativa privacy' }), 'altro');
});
test('tags are toggled without losing others; order newest first', () => {
  assert.deepEqual(tagSalute(['portafoglio', TAG_NON_SALUTE], true), ['portafoglio', TAG_SALUTE]);
  assert.deepEqual(tagSalute([TAG_SALUTE, 'x'], false), ['x', TAG_NON_SALUTE]);
  assert.deepEqual(ordinaSalute([{ id: 1, data_documento: '2025-01-01' }, { id: 2, email_data: '2026-02-01' }]).map((d) => d.id), [2, 1]);
});
function finto(righe) {
  const log = [];
  const q = { select: () => q, or: (f) => { log.push(['or', f]); return q; }, limit: async () => ({ data: righe, error: null }),
    update: (v) => { log.push(['update', v]); return q; }, eq: (k, v) => { log.push(['eq', k, v]); return q; } };
  q.select = (s) => (log.length && log.at(-1)[0] === 'eq' ? Promise.resolve({ data: [], error: null }) : q);
  return { db: { from: () => q }, log };
}
test('query asks for tag or own health docs and filters patients client-side', async () => {
  const { db, log } = finto([{ id: 'a', fascicolo: 'clinico_pazienti', tag: [TAG_SALUTE] }, { id: 'b', fascicolo: 'sanitario_famiglia', persona: IO, data_documento: '2026-01-01' }]);
  const r = await documentiSalute(db, IO);
  assert.deepEqual(r.map((d) => d.id), ['b']);
  assert.equal(log[0][1], `tag.cs.{${TAG_SALUTE}},and(fascicolo.eq.sanitario_famiglia,persona.eq."${IO}")`);
});
test('bulk toggle skips patient documents', async () => {
  const { db, log } = finto([]);
  await impostaSalute(db, [{ id: 'p', fascicolo: 'clinico_pazienti' }, { id: 'x', fascicolo: 'altro', tag: [] }], true);
  assert.deepEqual(log.filter((l) => l[0] === 'eq').map((l) => l[2]), ['x']);
});
test('several files are shared in a single sheet', async () => {
  const files = Array.from({ length: 14 }, (_, i) => ({ name: `f${i}` }));
  let condivisi = null;
  const r = await condividi({ titolo: 'x', files }, { canShare: () => true, share: async (d) => { condivisi = d.files; } });
  assert.equal(r, 'files'); assert.equal(condivisi.length, 14);
});
test('UI wiring: Personali entry, page, selection actions and 20-file limit', () => {
  const p = (f) => readFileSync(new URL(`../personal/src/${f}`, import.meta.url), 'utf8');
  assert.match(p('sezioni/personali/Personali.jsx'), /apri\(\{tipo:'salute'\}\)/);
  assert.match(p('sezioni/documenti/index.jsx'), /salute: \{ titolo: 'La mia salute ed esami'/);
  assert.match(p('sezioni/documenti/Salute.jsx'), /maxCondivisi=\{MAX_SALUTE\}/);
  assert.match(p('sezioni/documenti/Selezione.jsx'), /salute_si/);
  assert.match(p('sezioni/documenti/Carica.jsx'), /opzioni\.salute/);
});
