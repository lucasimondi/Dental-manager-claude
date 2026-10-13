// PO: "Devi fare un modo che io possa passare da app all'altra senza perdere quello che stavo
// facendo tipo una ricetta, deve rimanere aperto il documento anche quando cambio app e ritorno".
// Su iPhone l'app installata viene ricaricata da zero al ritorno: qui si verifica che il
// documento aperto e il suo contenuto vengano ripristinati.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import React from 'react';
import { renderToString } from 'react-dom/server';

const memoria = new Map();
globalThis.localStorage = {
  getItem: (k) => (memoria.has(k) ? memoria.get(k) : null),
  setItem: (k, v) => memoria.set(k, String(v)),
  removeItem: (k) => memoria.delete(k),
  clear: () => memoria.clear(),
};
beforeEach(() => memoria.clear());

const { segnaDocumentoAperto, documentoAperto, DURATA_BOZZE_MS, leggiPosizione } = await import('../src/lib/posizioneNavigazione.js');
const { useFormPersistente } = await import('../src/lib/useFormPersistente.js');

test('documento aperto: si ricorda dove, per quale paziente e quale documento', () => {
  segnaDocumentoAperto('scheda', 42, 'ricetta');
  assert.equal(documentoAperto('scheda', 42).flusso, 'ricetta');
  assert.equal(documentoAperto('scheda', '42').flusso, 'ricetta', 'id numerico o stringa');
  assert.equal(documentoAperto('scheda', 7), null, 'altro paziente: niente');
  assert.equal(documentoAperto('home'), null, 'altro punto dell\'app: niente');
  segnaDocumentoAperto('scheda', 42, null);
  assert.equal(documentoAperto('scheda', 42), null, 'chiuso: niente da riaprire');
});

test('documento aperto: ricetta dalla Home anche senza paziente scelto', () => {
  segnaDocumentoAperto('home', '', 'ricetta');
  assert.deepEqual({ ...documentoAperto('home'), t: 0 }, { dove: 'home', pazId: '', flusso: 'ricetta', t: 0 });
});

test('documento aperto: scade dopo 12 ore', () => {
  segnaDocumentoAperto('scheda', 1, 'medico');
  const pos = leggiPosizione();
  pos.documentoAperto.t = Date.now() - DURATA_BOZZE_MS - 1000;
  localStorage.setItem('dm_posizione_navigazione', JSON.stringify(pos));
  assert.equal(documentoAperto('scheda', 1), null);
});

const Form = ({ chiave, opzioni, onValore }) => {
  const [valore] = useFormPersistente(chiave, 'vuoto', opzioni);
  onValore(valore);
  return null;
};
const valoreDopoRicaricamento = (chiave, salvatoMinutiFa, opzioni) => {
  localStorage.setItem(`dm_form_draft::${chiave}`, JSON.stringify({ v: 'Amoxicillina 1 g', t: Date.now() - salvatoMinutiFa * 60000 }));
  let letto;
  renderToString(React.createElement(Form, { chiave, opzioni, onValore: (v) => { letto = v; } }));
  return letto;
};

test('bozza di un documento: dopo un\'ora in un\'altra app il testo c\'è ancora', () => {
  assert.equal(valoreDopoRicaricamento('doc_medico_1', 60, { durata: DURATA_BOZZE_MS }), 'Amoxicillina 1 g');
  assert.equal(valoreDopoRicaricamento('doc_medico_1', 11 * 60, { durata: DURATA_BOZZE_MS }), 'Amoxicillina 1 g');
  assert.equal(valoreDopoRicaricamento('doc_medico_1', 13 * 60, { durata: DURATA_BOZZE_MS }), 'vuoto', 'oltre 12 ore si riparte puliti');
});

test('bozza degli altri moduli: 30 minuti (era 2), poi si riparte puliti', () => {
  assert.equal(valoreDopoRicaricamento('nuovo_pagamento_studio', 10), 'Amoxicillina 1 g');
  assert.equal(valoreDopoRicaricamento('nuovo_pagamento_studio', 31), 'vuoto');
});

const src = (f) => readFileSync(f, 'utf8');

test('ricetta e documenti: bozza di 12 ore, cancellata solo alla chiusura volontaria', () => {
  const doc = src('src/components/DocMedico.jsx');
  assert.match(doc, /useFormPersistente\(`doc_medico_\$\{paz\?\.id \|\| 'x'\}`, \{[\s\S]*?\}, \{ durata: DURATA_BOZZE_MS \}\)/);
  assert.match(doc, /useFormPersistente\(`doc_medico_tipo_\$\{paz\?\.id \|\| 'x'\}`, null, \{ durata: DURATA_BOZZE_MS \}\)/);
  assert.match(doc, /const chiudi = \(\) => \{ clearContenutoDraft\(\); clearTipoDraft\(\); onClose\?\.\(\); \};/);
  assert.doesNotMatch(doc, /=\{onClose\}/, 'ogni chiusura volontaria passa da chiudi');
  const fiscale = src('src/components/DocFiscale.jsx');
  assert.match(fiscale, /\{ durata: DURATA_BOZZE_MS \}/);
  assert.doesNotMatch(fiscale, /=\{onClose\}/);
});

test('scheda paziente, Scheda 2.0 e Home riaprono il documento rimasto aperto', () => {
  const scheda = src('src/components/SchedaPaz.jsx');
  assert.match(scheda, /documentoAperto\('scheda', paz\?\.id\)\?\.flusso/);
  assert.match(scheda, /const setDocumentFlow = \(flusso\) => \{ setDocumentFlowStato\(flusso\); if \(paz\?\.id != null\) segnaDocumentoAperto\('scheda', paz\.id, flusso\); \};/);
  const v2 = src('src/components/PatientWorkspaceV2.jsx');
  assert.match(v2, /documentoAperto\('scheda', patient\?\.id\)\?\.flusso/);
  assert.match(v2, /segnaDocumentoAperto\('scheda', patient\.id, kind === 'prescription' \? 'ricetta'/);
  const home = src('src/components/Dashboard.jsx');
  assert.match(home, /useState\(\(\) => Boolean\(documentoAperto\('home'\)\)\)/);
  assert.match(home, /segnaDocumentoAperto\('home', ricettaPazienteId, 'ricetta'\)/);
  const app = src('src/App.jsx');
  assert.match(app, /segnaDocumentoAperto\('scheda', patient\.id, 'ricetta'\)/);
  assert.match(app, /if \(phoneApp && !documentoAperto\('scheda', pos\.schedaPazId\)\) return;/, 'anche nell\'app Poliedron del telefono');
  assert.match(app, /pulisciPosizione\(\['schedaPazId', 'schedaPazTab', 'documentoAperto'\]\)/);
});
