import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const dir = 'supabase/archivio/migrations';
const leggi = (nome) => readFileSync(`${dir}/${nome}`, 'utf8');
const migrazioni = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
const sicurezza = leggi('20261013090000_pol_vita_001_sicurezza_e_cancellazione.sql');

test('le migrazioni dell\'archivio personale non finiscono nella produzione dello studio', () => {
  const produzione = readdirSync('supabase/migrations');
  for (const nome of migrazioni) assert.ok(!produzione.includes(nome), nome);
  for (const nome of produzione) {
    const sql = readFileSync(`supabase/migrations/${nome}`, 'utf8');
    assert.doesNotMatch(sql, /\b(registra_documento|elimina_documento|documenti_soggetti)\b/, nome);
  }
});

test('lo schema di Cowork è la base, seguito dalla migrazione di sicurezza', () => {
  assert.deepEqual(migrazioni, [
    '20261012201509_schema_archivio_documenti.sql',
    '20261013090000_pol_vita_001_sicurezza_e_cancellazione.sql',
    '20261013200000_lotti_importazione.sql',
    '20261015200000_pol_vita_003_personal.sql',
    '20261016090000_pol_vita_006_movimenti.sql',
    '20261016120000_pol_vita_007_catalogazione.sql',
    '20261017120000_pol_vita_013_riserva_e_drive.sql',
    '20261017200000_pol_vita_014_pagamenti_attuali.sql',
    '20261018100000_pol_vita_015_foto_video.sql',
  ]);
});

test('il proprietario richiede un utente reale con email confermata', () => {
  assert.match(sicurezza, /u\.id = auth\.uid\(\)/);
  assert.match(sicurezza, /email_confirmed_at is not null/);
  assert.match(sicurezza, /before insert or update of email on auth\.users/);
});

test('anon non ha accesso e authenticated non può svuotare le tabelle', () => {
  assert.match(sicurezza, /revoke all on all tables in schema public from anon;/);
  assert.match(sicurezza, /revoke truncate, references, trigger on all tables in schema public from authenticated;/);
  assert.match(sicurezza, /revoke execute on all functions in schema public from public, anon;/);
  assert.match(sicurezza, /revoke execute on function registra_documento\(jsonb\) from public, anon, authenticated;/);
});

test('la cancellazione è definitiva e restituisce i file Drive da cancellare', () => {
  for (const fn of ['elimina_documento', 'elimina_pratica']) {
    assert.match(sicurezza, new RegExp(`function ${fn}\\(p_id uuid\\) returns jsonb\\s+language plpgsql security invoker`));
  }
  assert.match(sicurezza, /'drive_file_ids'/);
  assert.match(sicurezza, /delete from log_elaborazione/);
  assert.doesNotMatch(sicurezza, /\b(eliminato_il|deleted_at|cestino)\b/);
});

test('registra_documento non fallisce senza azione_richiesta', () => {
  assert.match(sicurezza, /v_azione boolean := coalesce\(\(p->>'azione_richiesta'\) = 'true', false\);/);
});
