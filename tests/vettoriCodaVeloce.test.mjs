// VETTORI-CODA-VELOCE — PO 2026-11-18 ("Sì fai il punto 1"): la coda dei vettori andava oltre il tempo
// massimo (5,6 s). Stessa firma e stessi risultati, verificati sul database in una transazione annullata
// (0 differenze su 100, stessa data per posizione; 37 ms); qui la forma della migrazione.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const sql = readFileSync('supabase/archivio/migrations/20261118200000_vettori_coda_veloce.sql', 'utf8');

test('solo aggiunte: niente drop né cancellazioni; unico update = segnare i vettori già diversi', () => {
  assert.doesNotMatch(sql, /\bdrop\s+(table|column|function|view|policy|trigger|index)\b/i);
  assert.doesNotMatch(sql, /\bdelete\s+from\b|\btruncate\b/i);
  assert.equal((sql.match(/^update /gm) || []).length, 1);
  assert.match(sql, /^update documenti_vettori v set da_rifare = true\nfrom documenti d, documenti_testo t/m);
  assert.match(sql, /add column if not exists da_rifare boolean not null default false/);
});

test('coda: prima i mai calcolati (solo id, poi la scheda), poi i segnati da rifare; mai i clinici; solo service_role', () => {
  assert.match(sql, /and not exists \(select 1 from documenti_vettori v where v\.documento_id = d0\.id\)\n\s+order by coalesce\(d0\.data_documento, d0\.email_data::date\) desc nulls last\n\s+limit v_lim/);
  assert.match(sql, /if v_n >= v_lim then\n\s+return;/);
  assert.match(sql, /where v\.da_rifare\n\s+and d\.fascicolo <> 'clinico_pazienti'\n\s+and t\.stato <> 'escluso'\n\s+and v\.impronta is distinct from md5\(x\.testo\)/);
  assert.equal((sql.match(/<> 'clinico_pazienti'/g) || []).length, 2);
  assert.match(sql, /revoke all on function documenti_senza_vettore\(integer\) from public, anon, authenticated;\ngrant execute on function documenti_senza_vettore\(integer\) to service_role;/);
});

test('trigger: scheda o testo cambiati accendono «da rifare» (anche dall\'app), il vettore salvato lo spegne', () => {
  assert.match(sql, /after update of titolo, ente, tipo_documento, riassunto, azione_descrizione, tag, persona, email_oggetto, nome_file_originale/);
  assert.match(sql, /after update of testo on documenti_testo for each row\n\s+when \(old\.testo is distinct from new\.testo\)/);
  assert.equal((sql.match(/^security definer$/gm) || []).length, 2, 'le due funzioni che scrivono da documenti/testo');
  assert.match(sql, /revoke all on function documenti_vettori_segna_da_rifare\(\) from public, anon, authenticated;/);
  assert.match(sql, /if tg_op = 'INSERT' or new\.impronta is distinct from old\.impronta or new\.aggiornato_il is distinct from old\.aggiornato_il then\n\s+new\.da_rifare := false;/);
});
