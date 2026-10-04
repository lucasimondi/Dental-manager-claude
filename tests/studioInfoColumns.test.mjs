import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

// POL-UI-045: colonne di public.studio_info lette in produzione (sola
// lettura, 2026-10-04, prima di POL-UI-044/045). studio_info non ha una
// migration di creazione nel repository, quindi questa è la fotografia di
// riferimento; le colonne aggiunte dopo arrivano dalle migration.
const COLONNE_PRODUZIONE = [
  'user_id', 'nome', 'spec', 'iscr', 'addr1', 'addr2', 'tel', 'email', 'piva', 'note', 'updated_at',
  'studio_id', 'vertical', 'iban', 'firma_b64', 'vertical_altro', 'custom_logo_b64',
  'custom_colore_primario', 'custom_colore_accento', 'agenda_settings', 'dock_settings', 'config_orario',
  'regime_fiscale', 'aliquota_iva', 'progressivo_invio_sdi', 'cap', 'comune', 'provincia', 'via',
  'nome_cognome_titolare', 'costi_variabili_metodo', 'costi_variabili_percentuale',
  'categorie_spesa_custom', 'header_colore', 'header_opacita', 'management_control_mode',
];

const colonneDaMigration = () => {
  const dir = new URL('../supabase/migrations/', import.meta.url);
  const out = new Set();
  for (const f of readdirSync(dir)) {
    const sql = readFileSync(new URL(f, dir), 'utf8');
    for (const m of sql.matchAll(/ALTER TABLE public\.studio_info\s+ADD COLUMN IF NOT EXISTS (\w+)/g)) out.add(m[1]);
  }
  return out;
};

test('POL-UI-045: ogni campo che Impostazioni salva in studio_info esiste come colonna', () => {
  const src = read('src/components/Impostazioni.jsx');
  const scritti = new Set([...src.matchAll(/\bS\(\{\s*(\w+):/g)].map((m) => m[1]));
  assert.ok(scritti.size > 10, 'il parser deve trovare i campi salvati');
  const note = new Set([...COLONNE_PRODUZIONE, ...colonneDaMigration()]);
  const mancanti = [...scritti].filter((k) => !note.has(k));
  assert.deepEqual(mancanti, [], `campi salvati senza colonna in studio_info: ${mancanti.join(', ')} — serve una migration`);
});

test('POL-UI-045: documenti_settings e farmaci_preferiti hanno la loro migration', () => {
  const daMigration = colonneDaMigration();
  assert.ok(daMigration.has('documenti_settings'));
  assert.ok(daMigration.has('farmaci_preferiti'));
  const sql = read('supabase/migrations/20261004150000_pol_ui_045_documenti_settings.sql');
  assert.match(sql, /CHECK \(documenti_settings IS NULL OR jsonb_typeof\(documenti_settings\) = 'object'\)/);
  assert.doesNotMatch(sql, /(CREATE|ALTER|DROP) POLICY|\bGRANT\b|\bREVOKE\b|ROW LEVEL SECURITY/);
});
