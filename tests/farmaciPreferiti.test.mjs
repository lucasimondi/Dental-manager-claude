import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  FARMACI_PREFERITI_DEFAULT, MAX_FARMACI_PREFERITI,
  applicaFarmacoPreferito, normalizzaListaFarmaciPreferiti, resolveFarmaciPreferiti,
} from '../src/lib/farmaciPreferiti.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const docMedicoSrc = read('src/components/DocMedico.jsx');
const impostazioniSrc = read('src/components/Impostazioni.jsx');
const settingsSrc = read('src/components/FarmaciPreferitiSettings.jsx');
const migrationSrc = read('supabase/migrations/20261004120000_pol_ui_044_farmaci_preferiti.sql');

test('POL-UI-044: la lista iniziale contiene i farmaci richiesti dal Product Owner', () => {
  const nomi = FARMACI_PREFERITI_DEFAULT.map((f) => f.farmaco.toLowerCase());
  for (const atteso of ['enteroboulardi', 'zitromax', 'toradol', 'xanax', 'pantoprazolo 20 mg']) {
    assert.ok(nomi.some((n) => n.includes(atteso)), `manca ${atteso}`);
  }
  assert.equal(new Set(FARMACI_PREFERITI_DEFAULT.map((f) => f.id)).size, FARMACI_PREFERITI_DEFAULT.length);
});

test('POL-UI-044: lista effettiva — salvata se presente, iniziale solo per odontoiatria, [] resta vuota', () => {
  assert.equal(resolveFarmaciPreferiti({ vertical: 'dentistico' }).length, FARMACI_PREFERITI_DEFAULT.length);
  assert.equal(resolveFarmaciPreferiti({}).length, FARMACI_PREFERITI_DEFAULT.length);
  assert.deepEqual(resolveFarmaciPreferiti({ vertical: 'medico_chirurgo' }), []);
  assert.deepEqual(resolveFarmaciPreferiti({ vertical: 'dentistico', farmaci_preferiti: [] }), []);
  const salvata = resolveFarmaciPreferiti({ farmaci_preferiti: [{ id: 'a', farmaco: '  Zitromax 500 mg ', posologia: '1 cp/die' }] });
  assert.deepEqual(salvata, [{ id: 'a', farmaco: 'Zitromax 500 mg', dosaggio: '', posologia: '1 cp/die', durata: '', note: '' }]);
});

test('POL-UI-044: normalizzazione — scarta voci senza nome, deduplica id, rispetta il massimo', () => {
  const out = normalizzaListaFarmaciPreferiti([{ id: 'x', farmaco: 'A' }, { id: 'x', farmaco: 'B' }, { farmaco: '   ' }, null, 'testo']);
  assert.equal(out.length, 2);
  assert.notEqual(out[0].id, out[1].id);
  const tante = Array.from({ length: MAX_FARMACI_PREFERITI + 5 }, (_, i) => ({ farmaco: `F${i}` }));
  assert.equal(normalizzaListaFarmaciPreferiti(tante).length, MAX_FARMACI_PREFERITI);
});

test('POL-UI-044: applicare una scorciatoia riempie la prima riga vuota, poi aggiunge, senza duplicare', () => {
  const zitro = { farmaco: 'Zitromax 500 mg', dosaggio: '500 mg', posologia: '1 cp al giorno', durata: 'Per 3 giorni', note: '' };
  const vuota = [{ farmaco: '', dosaggio: '', posologia: '', durata: '', note: '' }];
  const una = applicaFarmacoPreferito(vuota, zitro);
  assert.equal(una.length, 1);
  assert.equal(una[0].posologia, '1 cp al giorno');
  assert.equal(applicaFarmacoPreferito(una, { ...zitro, farmaco: ' zitromax 500 MG' }), una, 'stesso farmaco: nessun duplicato');
  const due = applicaFarmacoPreferito(una, { farmaco: 'Pantoprazolo 20 mg' });
  assert.equal(due.length, 2);
  assert.equal(due[1].farmaco, 'Pantoprazolo 20 mg');
});

test('POL-UI-044: DocMedico mostra le scorciatoie nella card Farmaci prescritti', () => {
  assert.match(docMedicoSrc, /import \{ applicaFarmacoPreferito, resolveFarmaciPreferiti \} from '\.\.\/lib\/farmaciPreferiti\.js';/);
  assert.match(docMedicoSrc, /const farmaciPreferiti = resolveFarmaciPreferiti\(si\);/);
  assert.match(docMedicoSrc, /onClick=\{\(\) => setFarmaci\(\(f\) => applicaFarmacoPreferito\(f, fp\)\)\}/);
  assert.ok(docMedicoSrc.indexOf('data-farmaci-preferiti') > docMedicoSrc.indexOf('Farmaci prescritti</div>'));
});

test('POL-UI-044: Impostazioni → Documenti gestisce le scorciatoie e salva solo quel campo', () => {
  assert.match(impostazioniSrc, /<FarmaciPreferitiSettings si=\{si\} onSalva=\{salvaFarmaciPreferiti\} \/>/);
  assert.match(impostazioniSrc, /setStudioInfo\(\(prev\) => \(\{ \.\.\.prev, farmaci_preferiti: lista \}\)\);/);
  assert.match(impostazioniSrc, /\(VERTICALI_CON_RICETTA\.has\(si\.vertical\) \|\| !si\.vertical\) && \(/);
  for (const azione of ['Aggiungi farmaco', 'Salva scorciatoia', 'Sposta su', 'Sposta giù', 'Modifica', 'Elimina', 'Ripristina lista iniziale']) {
    assert.ok(settingsSrc.includes(azione), `manca l'azione ${azione}`);
  }
});

test('POL-UI-044: migration — sola colonna jsonb con CHECK, nessuna policy toccata', () => {
  assert.match(migrationSrc, /ADD COLUMN IF NOT EXISTS farmaci_preferiti jsonb;/);
  assert.match(migrationSrc, /jsonb_typeof\(farmaci_preferiti\) = 'array' AND jsonb_array_length\(farmaci_preferiti\) <= 60/);
  assert.doesNotMatch(migrationSrc, /(CREATE|ALTER|DROP) POLICY|\bGRANT\b|\bREVOKE\b|ROW LEVEL SECURITY/);
  assert.equal(MAX_FARMACI_PREFERITI, 60, 'il limite JS deve coincidere con il CHECK SQL');
});
