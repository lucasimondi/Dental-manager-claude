// PREVENTIVI-LINEARI (PO 2026-11-25): «ha aggiunto prestazioni due volte [...] se poi modifico una
// prestazione deve segnalarmi che è già stata preventivata quindi il preventivo precedente perde di
// validità». Casi presi dal piano reale che ha dato il problema (dati ridotti, senza nomi).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  stessaCura, giaPreventivate, messaggioGiaPreventivate, confrontaPreventivo,
  preventiviResiNonValidi, messaggioPreventiviNonValidi, applicaVociAlPiano,
} from '../src/lib/domain/preventivoValidita.js';
import { preparePatientEntry, GIA_PREVENTIVATE } from '../src/lib/appointmentEntry.js';

const sp = (t) => String(t).replace(/[\u00a0\u202f]/g, ' ');
const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
const voce = (prestazione, dente, prezzo, extra = {}) => ({ prestazione, dente, prezzo, eseguita: false, incassata: false, ...extra });
const piano41 = { id: 41, pazienteId: 130, titolo: 'Preventivo', data: '2026-11-25', stato: 'attivo', sconto: 0, scontoTipo: 'pct', voci: [
  voce('Estrazione', '44', 50), voce('Devitalizzazione', '13', 90), voce('Ricostruzione con perno', '13', 104), voce('Igiene orale', '', 40),
] };

test('the same cure under another name is the same cure; different cures are not', () => {
  assert.ok(stessaCura('Devitalizzazione', 'Devitalizzazione un canale'));
  assert.ok(stessaCura('Estrazione', 'Estrazione semplice'));
  assert.ok(stessaCura('Riparazione scheletrato superiore', 'Modifica scheletrato'));
  assert.ok(stessaCura('Igiene', 'Igiene orale'));
  assert.ok(!stessaCura('Ricostruzione con perno', 'Corona'));
  assert.ok(!stessaCura('Devitalizzazione', 'Estrazione'));
});

test('already quoted and not done: found across open plans, same tooth only, never in refused or done items', () => {
  const nuove = [voce('Devitalizzazione un canale', '13', 95), voce('Estrazione', '23', 50), voce('Igiene', '', 40)];
  const trovate = giaPreventivate([piano41], 130, nuove);
  assert.deepEqual(trovate.map((t) => `${t.voce.prestazione}|${t.esistente.prestazione}`), ['Devitalizzazione un canale|Devitalizzazione', 'Igiene|Igiene orale']);
  const msg = sp(messaggioGiaPreventivate(trovate));
  assert.match(msg, /Devitalizzazione un canale sul 13: già in «Preventivo» del 25\/11\/2026 come Devitalizzazione sul 13 \(90,00 €\)/);
  assert.match(msg, /modifica la voce che c'è già/);
  assert.equal(giaPreventivate([{ ...piano41, stato: 'rifiutato' }], 130, nuove).length, 0);
  assert.equal(giaPreventivate([{ ...piano41, voci: piano41.voci.map((v) => ({ ...v, eseguita: true })) }], 130, nuove).length, 0);
  assert.equal(giaPreventivate([piano41], 999, nuove).length, 0, 'other patients never count');
  assert.equal(giaPreventivate([piano41], 130, [voce('Devitalizzazione', '13', 95)], { escludi: [{ pianoId: 41, indice: 1 }] }).length, 0, 'the item being edited does not match itself');
});

test('an issued quote stays valid while its items are in the plan as quoted; a change makes it no longer valid', () => {
  const snapshot = { voci: piano41.voci, sconto: 0, scontoTipo: 'pct' };
  assert.deepEqual(confrontaPreventivo(snapshot, piano41), { valido: true, motivi: [] });
  const conVoceNuova = { ...piano41, voci: [...piano41.voci, voce('Corona', '13', 300)] };
  assert.equal(confrontaPreventivo({ ...snapshot, sconto: 0 }, conVoceNuova).valido, true, 'adding another cure does not change what was quoted');
  const prezzo = { ...piano41, voci: piano41.voci.map((v, i) => (i === 1 ? { ...v, prezzo: 95 } : v)) };
  assert.deepEqual(confrontaPreventivo(snapshot, prezzo).motivi.map(sp), ['Devitalizzazione sul 13: 90,00 € → 95,00 €']);
  const nome = { ...piano41, voci: piano41.voci.map((v, i) => (i === 1 ? { ...v, prestazione: 'Devitalizzazione un canale', prezzo: 95 } : v)) };
  assert.match(confrontaPreventivo(snapshot, nome).motivi[0], /ora è Devitalizzazione un canale sul 13/);
  const tolta = { ...piano41, voci: piano41.voci.filter((_, i) => i !== 0) };
  assert.deepEqual(confrontaPreventivo(snapshot, tolta).motivi.map(sp), ['Estrazione sul 44 non è più nel piano']);
  assert.match(confrontaPreventivo(snapshot, { ...piano41, sconto: 10 }).motivi[0], /Sconto: nessuno → 10%/);
  assert.equal(confrontaPreventivo({ voci: [piano41.voci[0]] }, { ...piano41, sconto: 10 }).valido, true, 'a single-item extract has no discount to compare');
  assert.equal(confrontaPreventivo(snapshot, piano41.voci.length && { ...piano41, voci: piano41.voci.map((v) => ({ ...v, eseguita: true })) }).valido, true, 'doing the work does not invalidate the quote');
  assert.deepEqual(confrontaPreventivo(snapshot, undefined), { valido: false, motivi: ['Il piano di cura non esiste più.'] });
});

test('the warning names exactly the quotes that the change would invalidate', () => {
  const emessi = [
    { id: 'a', piano_id: 41, numero: 'B83CD8E6A7', data: '2026-11-25', archiviato: false, plan_snapshot: { voci: piano41.voci, sconto: 0, scontoTipo: 'pct' } },
    { id: 'b', piano_id: 41, numero: 'OLD', data: '2026-11-01', archiviato: false, plan_snapshot: { voci: [voce('Estrazione', '44', 40)] } },
    { id: 'c', piano_id: 7, numero: 'ALTRO', data: '2026-11-25', archiviato: false, plan_snapshot: { voci: piano41.voci } },
  ];
  const dopo = { ...piano41, voci: piano41.voci.map((v, i) => (i === 1 ? { ...v, prezzo: 95 } : v)) };
  const nonValidi = preventiviResiNonValidi(emessi, piano41, dopo);
  assert.deepEqual(nonValidi.map((q) => q.numero), ['B83CD8E6A7'], 'already stale quotes and other plans are not repeated');
  assert.match(messaggioPreventiviNonValidi(nonValidi), /già nel preventivo N° B83CD8E6A7 del 25\/11\/2026[\s\S]*non sarà più valido/);
});

test('«Modifica / nuova versione» edits the same plan instead of duplicating it', () => {
  const righe = [voce('Estrazione', '44', 50), voce('Devitalizzazione un canale', '13', 95), voce('Corona', '13', 300)];
  const { piano, cambiate, aggiunte } = applicaVociAlPiano(piano41, righe);
  assert.equal(cambiate, 1); assert.equal(aggiunte, 1);
  assert.deepEqual(piano.voci.map((v) => `${v.prestazione} ${v.dente} ${v.prezzo}`), [
    'Estrazione 44 50', 'Devitalizzazione un canale 13 95', 'Ricostruzione con perno 13 104', 'Igiene orale  40', 'Corona 13 300',
  ]);
  const fatta = { ...piano41, voci: piano41.voci.map((v, i) => (i === 0 ? { ...v, eseguita: true } : v)) };
  assert.equal(applicaVociAlPiano(fatta, [voce('Estrazione', '44', 50)]).aggiunte, 0, 'an executed item is never duplicated');
});

test('new quote or new treatment with an already-quoted cure stops with a code until confirmed', () => {
  const patient = { id: 130 };
  const riga = (description, tooth, price) => ({ description, tooth, price: String(price) });
  const quoteDraft = { items: [], quoteItems: [riga('Devitalizzazione un canale', '13', 95)], quoteTitle: 'Preventivo' };
  assert.throws(() => preparePatientEntry({ patient, plans: [piano41], draft: quoteDraft }), (e) => e.code === GIA_PREVENTIVATE && /già preventivata/.test(e.message));
  assert.ok(preparePatientEntry({ patient, plans: [piano41], draft: { ...quoteDraft, confermaGiaPreventivate: true } }).quote);
  const treatmentDraft = { items: [riga('Estrazione semplice', '44', 50)], quoteItems: [], planId: '41' };
  assert.throws(() => preparePatientEntry({ patient, plans: [piano41], draft: treatmentDraft }), (e) => e.code === GIA_PREVENTIVATE);
  const identica = preparePatientEntry({ patient, plans: [piano41], draft: { items: [riga('Estrazione', '44', 50)], quoteItems: [], planId: '41' } });
  assert.equal(identica.treatment.kind, 'existing', 'the exact same item is still skipped silently, as before');
  assert.equal(preparePatientEntry({ patient, plans: [piano41], draft: { items: [riga('Corona', '13', 300)], quoteItems: [], planId: '41' } }).treatment.kind, 'update');
});

test('wiring: warnings in plans, Denti e cure, entry forms, Preventivi badge; Poliedron uses the same rule', () => {
  for (const file of ['PianoDrillDown.jsx', 'PatientDentalOverview.jsx', 'Piani.jsx']) assert.match(read(`../src/components/${file}`), /avvisoPrev\.chiedi\(/, file);
  assert.match(read('../src/components/PatientPlanEntry.jsx'), /Aggiungi comunque/);
  assert.match(read('../src/components/AppointmentWorkspace.jsx'), /Aggiungi comunque/);
  assert.match(read('../src/components/Agenda.jsx'), /Aggiungi comunque e salva/);
  assert.match(read('../src/components/Preventivi.jsx'), /Non più valido/);
  assert.match(read('../src/components/PatientPlanEntry.jsx'), /onUpdateSourcePlan\(dopo\)/);
  assert.match(read('../supabase/functions/agente-assistente/piani.js'), /from '\.\.\/_shared\/preventivoValidita\.js'/);
});
