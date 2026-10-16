// PO (2026-10-16): "Il pdf preventivo non è impaginato bene … metti un tastino
// preventivo … quando scarichi il preventivo poi non c'è modo di tornare
// indietro alla scheda paziente … quando chiedo preventivo [Poliedron] deve
// generare piano di cura sulla scheda paziente e darmi il preventivo in chat".
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildPreventivoPdf, totaliPreventivo, numeroPreventivo, euroIt } from '../src/lib/documenti/preventivoPdf.js';
import { preparaPreventivo, preparePiani, executePiani, STRUMENTO_PREVENTIVO } from '../supabase/functions/agente-assistente/piani.js';
import { documentRequestFromModel, isQuoteRequest } from '../src/lib/poliedron/poliedraCore.js';

const source = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const si = { nome: 'Studio Test', spec: 'Odontoiatra', tel: '0123', email: 's@t.it', piva: '01234567890', addr1: 'Via Roma 1' };
const paziente = { id: 7, nome: 'Mario', cognome: 'Rossi', cf: 'rssmra80a01d205x' };
const piano = { id: 1760000000030, titolo: 'Protesi', voci: [{ prestazione: 'Corona composito ceramica', dente: '27', prezzo: 350 }, { prestazione: 'Impianto', dente: '16', prezzo: 1000, eseguita: true }], sconto: 10, scontoTipo: 'pct' };

test('totals, number and euro format of the quote', () => {
  assert.deepEqual(totaliPreventivo(piano), { subtotale: 1350, sconto: 10, scontato: 135, totale: 1215 });
  assert.equal(totaliPreventivo({ voci: [{ prezzo: 100 }], sconto: 500, scontoTipo: 'valore' }).totale, 0);
  assert.equal(numeroPreventivo(piano), '000030');
  assert.equal(euroIt(1358), '€ 1.358,00');
  assert.equal(euroIt(12222.5), '€ 12.222,50');
});

test('the quote PDF has header, patient box with C.F., plan, rows, total and signatures', () => {
  const pdf = buildPreventivoPdf({ si, paziente, piano, data: '2026-10-16' });
  assert.equal(pdf.filename, 'Mario Rossi.pdf');
  assert.equal(pdf.tipoDoc, 'preventivo');
  const bytes = Buffer.from(pdf.dataUrl.split(',')[1], 'base64').toString('latin1');
  assert.match(bytes, /^%PDF-/);
  for (const t of ['PREVENTIVO', 'Mario Rossi', 'C.F. RSSMRA80A01D205X', 'PIANO DI CURA', 'Protesi', 'Corona composito ceramica', 'TOTALE', 'Il paziente, per accettazione', 'Studio Test']) assert.ok(bytes.includes(t), t);
});

test('a long plan flows onto more pages with numbered pages', () => {
  const voci = Array.from({ length: 40 }, (_, i) => ({ prestazione: `Prestazione ${i + 1}`, dente: String(11 + i), prezzo: 100 }));
  const pdf = buildPreventivoPdf({ si, paziente, piano: { ...piano, voci } });
  const bytes = Buffer.from(pdf.dataUrl.split(',')[1], 'base64').toString('latin1');
  assert.match(bytes, /Pagina 2 di [23]/);
  assert.ok(bytes.includes('Prestazione 40'));
});

test('the PDF opens inside the app (with Chiudi), never in a new window', () => {
  const view = source('src/components/PdfView.jsx');
  assert.match(view, /buildPreventivoPdf\(\{ si, paziente: paz, piano: pl \}\)/);
  assert.match(view, /<PdfViewerModal titolo=\{pdf\.titolo\} dataUrl=\{pdf\.dataUrl\} filename=\{pdf\.filename\} zIndex=\{3100\}/);
  assert.doesNotMatch(view, /window\.open\(\)|document\.write|datauristring/);
  assert.match(view, /env\(safe-area-inset-top\)/);
  assert.match(source('src/components/ui/PdfViewerModal.jsx'), /Chiudi\n/);
});

test('a "Preventivo" button in the patient record and on every plan', () => {
  const scheda = source('src/components/SchedaPaz.jsx');
  assert.match(scheda, /<Btn ch="Preventivo" ic="file" v="sec" sz="sm" onClick=\{apriPreventivo\} \/>/);
  assert.match(scheda, /<PdfView pl=\{preventivo\} paz=\{paz\}/);
  assert.match(source('src/components/PianoDrillDown.jsx'), /aria-label="Preventivo"/);
});

const fakeClient = ({ patient = { id: 7, nome: 'Mario', cognome: 'Rossi' }, plan = { id: 5, paziente_id: 7, titolo: 'Protesi', voci: [{ prestazione: 'Corona', prezzo: 350 }] } } = {}) => {
  const calls = [];
  const q = (table, data) => {
    const chain = { select: () => chain, eq: (k, v) => { calls.push([table, k, v]); return chain; }, limit: () => Promise.resolve({ data: [], error: null }), single: () => Promise.resolve({ data, error: data ? null : { message: 'none' } }) };
    return chain;
  };
  return { calls, from: (t) => (t === 'patients' ? q(t, patient) : q(t, plan)) };
};

test('prepara_preventivo reads only the studio’s own plan of that patient', async () => {
  assert.equal(STRUMENTO_PREVENTIVO.name, 'prepara_preventivo');
  const client = fakeClient();
  const doc = await preparaPreventivo(client, { paziente_id: 7, piano_id: 5 }, 'studio-1');
  assert.equal(doc.tipo, 'preventivo');
  assert.equal(doc.piano_id, 5);
  assert.equal(doc.paziente_nome, 'Mario Rossi');
  assert.ok(client.calls.some(([t, k, v]) => t === 'plans' && k === 'studio_id' && v === 'studio-1'));
  assert.ok(client.calls.some(([t, k, v]) => t === 'plans' && k === 'paziente_id' && v === 7));
  await assert.rejects(() => preparaPreventivo(fakeClient({ plan: null }), { paziente_id: 7, piano_id: 5 }, 's'), /Piano non trovato/);
  await assert.rejects(() => preparaPreventivo(fakeClient({ plan: { id: 5, voci: [] } }), { paziente_id: 7, piano_id: 5 }, 's'), /non ha prestazioni/);
});

test('a plan created by Poliedron brings its quote back to the chat', async () => {
  const client = {
    from(t) {
      if (t === 'patients') return { select() { return this; }, eq() { return this; }, single: () => Promise.resolve({ data: { id: 7, nome: 'Mario', cognome: 'Rossi' }, error: null }) };
      if (t === 'poliedron_action_claims') return { insert: () => Promise.resolve({ error: null }) };
      const x = { select() { return x; }, eq() { return x; }, limit: () => Promise.resolve({ data: [], error: null }) };
      x.insert = (row) => { x.single = () => Promise.resolve({ data: { ...row }, error: null }); return x; };
      return x;
    },
  };
  const prepared = await preparePiani(client, 'crea_piano_cura', { paziente_id: 7, titolo: 'Protesi', voci: [{ prestazione: 'Corona', prezzo: 350, dente: '27' }] }, 'studio', { patients: new Set([7]) });
  const out = await executePiani(client, { id: 'c', studioId: 'studio', userId: 'u', name: 'crea_piano_cura', piani: prepared });
  assert.equal(out.documento.tipo, 'preventivo');
  assert.equal(out.documento.paziente_id, 7);
  assert.equal(out.documento.piano.titolo, 'Protesi');
});

test('the app maps the server quote to its plan shape and checks the patient', () => {
  const raw = { documento: { tipo: 'preventivo', paziente_id: 7, paziente_nome: 'Mario Rossi', piano_id: 5, piano: { id: 5, paziente_id: 7, titolo: 'Protesi', voci: [{ prestazione: 'Corona', dente: '27', prezzo: '350' }], sconto: 5, sconto_tipo: 'valore', scadenza_pagamento: null } } };
  const req = documentRequestFromModel({ raw });
  assert.equal(req.type, 'preventivo');
  assert.deepEqual(req.plan.voci, [{ prestazione: 'Corona', dente: '27', prezzo: 350, eseguita: false }]);
  assert.equal(req.plan.scontoTipo, 'valore');
  assert.equal(req.plan.pazienteId, 7);
  assert.equal(documentRequestFromModel({ raw: { documento: { ...raw.documento, piano: { ...raw.documento.piano, paziente_id: 8 } } } }), null);
  assert.equal(documentRequestFromModel({ raw: { documento: { ...raw.documento, piano: { id: 5, voci: [] } } } }), null);
});

test('"preventivo" requests go to Poliedron; statistics and the bare word do not', () => {
  for (const q of ['Preventivo per Fabrizio Vaioli corona composito ceramica sul 27', 'fammi il preventivo di Mario Rossi', 'crea un preventivo per Rossi: impianto 16 a 1000 euro']) assert.ok(isQuoteRequest(q), q);
  for (const q of ['preventivi', 'preventivo', 'quanti preventivi in attesa?', 'preventivi scaduti']) assert.equal(isQuoteRequest(q), false, q);
});

test('agent wiring: tool exposed with reads, prompt asks to create the plan, chat shows the quote', () => {
  const index = source('supabase/functions/agente-assistente/index.ts');
  assert.match(index, /if \(lettureAmmesse\) toolsFinali = \[\.\.\.toolsFinali, STRUMENTO_PREVENTIVO\];/);
  assert.match(index, /if \(out\.documento\) documentoPreparato = out\.documento;/);
  assert.doesNotMatch(index, /i piani di cura per ora vanno fatti nei moduli/);
  const poliedron = source('src/components/poliedron/Poliedron.jsx');
  assert.match(poliedron, /buildPreventivoPdf\(\{ si: studioInfo, paziente: patient, piano: documentRequest\.plan, data \}\)/);
  assert.match(poliedron, /if \(documentRequest\) prepareDocumentInChat\(documentRequest\);/);
  assert.match(source('src/App.jsx'), /plans: \['dm_pl', setPlans\]/);
  const card = source('src/components/poliedron/PoliedronPreparedDocument.jsx');
  assert.match(card, /onClick=\{onOpenPatient\}[^>]*>Apri la scheda/);
  assert.match(card, /setConfirming\(false\); onSend\?\.\(\);[^>]*>Sì, invia/);
});
