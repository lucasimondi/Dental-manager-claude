import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// POL-UI-020: Product Owner — la nuova azione veloce "Spesa" in scheda
// paziente "deve aggiornare sezione spese... il popup nuova spesa è lo
// stesso di spese va aggiornato se si vuole opzionalmente associarla ad
// un paziente". Il modale "nuova/modifica spesa", prima solo dentro
// Spese.jsx, è stato estratto in SpesaModal.jsx così entrambi i
// chiamanti (la pagina Spese e le azioni veloci del paziente) usano lo
// stesso identico form — mai una seconda implementazione.
const modal = fs.readFileSync(new URL('../src/components/SpesaModal.jsx', import.meta.url), 'utf8');
const spese = fs.readFileSync(new URL('../src/components/Spese.jsx', import.meta.url), 'utf8');

test('SpesaModal scrive davvero su spese (insert/update), mai un flag cosmetico', () => {
  assert.match(modal, /supabase\.from\('spese'\)\.update\(record\)\.eq\('id', editItem\.id\)/);
  assert.match(modal, /supabase\.from\('spese'\)\.insert\(\[\{ \.\.\.record, id: Date\.now\(\) \}\]\)/);
});

test('SpesaModal associa il paziente in modo facoltativo, riusando SelettorePaziente (che offre già la rimozione)', () => {
  assert.match(modal, /<SelettorePaziente patients=\{patients\} value=\{form\.pazienteId\}/);
  assert.match(modal, /paziente_id: form\.pazienteId \? Number\(form\.pazienteId\) : null,/);
});

test('Spese.jsx riusa SpesaModal invece di una seconda implementazione del form', () => {
  assert.match(spese, /import SpesaModal from '\.\/SpesaModal\.jsx';/);
  assert.match(spese, /<SpesaModal\s*\n\s*editItem=\{editItem\}\s*\n\s*patients=\{patients\}/);
  // ConfermaEstrazioneSpesa (a different feature — AI extraction review)
  // legitimately keeps its own small form; only the old nuova/modifica
  // spesa form (data_fine/n_rate/haTermine fields) must be gone.
  assert.doesNotMatch(spese, /haTermine: false, n_rate: '', data_fine: ''/);
  assert.doesNotMatch(spese, /const calcolaDataFineDaRate = /);
});
