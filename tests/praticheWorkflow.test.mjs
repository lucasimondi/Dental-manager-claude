// PRATICHE-WORKFLOW — PO 2026-11-18: filo temporale, verifica della scheda da parte di Luca, avanzamento in Legal,
// schede di Claude Code non sovrascritte dallo script.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { filoOrdinato, avanzamentoSchede, confermaScheda, STATI_ANALISI } from '../personal/src/lib/legal.js';

const sql = readFileSync('supabase/archivio/migrations/20261118230000_pratiche_workflow.sql', 'utf8');
const codice = readFileSync('poliedron/archivio/Code.gs', 'utf8');
const scheda = readFileSync('personal/src/sezioni/legal/SchedaPratica.jsx', 'utf8');

test('filo temporale in ordine di data, eventi senza data in fondo, righe vuote scartate', () => {
  const f = filoOrdinato([{ data: '2026-11-02', evento: 'Notifica' }, { evento: 'Senza data' }, { data: '2026-10-01', evento: 'Ricorso' }, { data: '2026-01-01' }, null]);
  assert.deepEqual(f.map((x) => x.evento), ['Ricorso', 'Notifica', 'Senza data']);
  assert.deepEqual(filoOrdinato(undefined), []);
});

test('avanzamento: solo pratiche in corso, analizzate e verificate', () => {
  const pratiche = [{ id: 'a', stato: 'aperta' }, { id: 'b', stato: 'in_corso' }, { id: 'c', stato: 'aperta' }, { id: 'd', stato: 'archiviata' }];
  const schede = [{ pratica_id: 'a', stato_analisi: 'verificata' }, { pratica_id: 'b', stato_analisi: 'analizzata' }, { pratica_id: 'd', stato_analisi: 'verificata' }];
  assert.deepEqual(avanzamentoSchede(pratiche, schede), { totale: 3, analizzate: 2, verificate: 1 });
  assert.equal(STATI_ANALISI.da_aggiornare.length > 0, true);
});

test('conferma passa dalla RPC, non da una scrittura diretta', async () => {
  let chiamata;
  const db = { rpc: async (nome, arg) => { chiamata = [nome, arg]; return { data: '2026-11-18T22:00:00Z', error: null }; } };
  assert.equal(await confermaScheda(db, 'p1'), '2026-11-18T22:00:00Z');
  assert.deepEqual(chiamata, ['conferma_scheda', { p_pratica: 'p1', p_conferma: true }]);
  await assert.rejects(confermaScheda({ rpc: async () => ({ data: null, error: { message: 'non autorizzato' } }) }, 'p1'), /non autorizzato/);
});

test('migrazione additiva; la RPC controlla il proprietario e non è per anon', () => {
  assert.doesNotMatch(sql, /\bdrop\b|\bdelete\b|truncate/i);
  for (const c of ['tipo', 'parti', 'filo', 'mancanti', 'stato_analisi', 'verificata_il']) assert.match(sql, new RegExp(`add column if not exists ${c}\\b`));
  assert.match(sql, /if not e_proprietario\(\) then/);
  assert.match(sql, /revoke all on function conferma_scheda\(uuid, boolean\) from public, anon/);
});

test('lo script non riscrive le schede di Claude Code e una scheda riscritta perde la conferma', () => {
  assert.match(codice, /vecchia\.modello === 'claude-code'/);
  assert.match(codice, /stato_analisi: 'da_aggiornare', verificata_il: null/);
  assert.match(codice, /stato_analisi: 'analizzata', verificata_il: null/);
  assert.match(codice, /stato_analisi=neq\.da_aggiornare/);
});

test('la scheda mostra filo temporale, parti, documenti mancanti e il pulsante Conferma', () => {
  for (const t of ['Filo temporale', 'Parti', 'Documenti mancanti', 'Conferma', 'Togli conferma']) assert.ok(scheda.includes(t), t);
});
