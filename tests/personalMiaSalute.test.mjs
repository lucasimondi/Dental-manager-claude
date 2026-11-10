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

// --- seconda richiesta: ritaglio, PDF, Mail/WhatsApp, scansione ---
import { limitaRitaglio, muoviRitaglio, rettangoloPixel, RITAGLIO_INTERO } from '../personal/src/lib/scansione.js';
import { urlInvio, inviaCon } from '../personal/src/lib/condividi.js';
import { tipoFile, nomePdf, unisciInPdf } from '../personal/src/lib/pdfUnico.js';
import { PDFDocument } from 'pdf-lib';

test('crop: corners and move stay inside the image with a minimum size', () => {
  assert.deepEqual(muoviRitaglio(RITAGLIO_INTERO, 'nw', 0.1, 0.2), { x: 0.1, y: 0.2, w: 0.9, h: 0.8 });
  const se = muoviRitaglio(RITAGLIO_INTERO, 'se', -0.3, -0.5);
  assert.ok(Math.abs(se.w - 0.7) < 1e-9 && Math.abs(se.h - 0.5) < 1e-9);
  assert.equal(muoviRitaglio({ x: 0.5, y: 0.5, w: 0.1, h: 0.1 }, 'nw', 0.5, 0.5).w >= 0.05, true);
  assert.deepEqual(muoviRitaglio({ x: 0.2, y: 0.2, w: 0.5, h: 0.5 }, 'centro', 0.9, -0.9), { x: 0.5, y: 0, w: 0.5, h: 0.5 });
  assert.deepEqual(limitaRitaglio({ x: -1, y: 2, w: 3, h: 0 }), { x: 0, y: 0.95, w: 1, h: 0.05 });
  assert.deepEqual(rettangoloPixel({ x: 0.1, y: 0.25, w: 0.5, h: 0.5 }, 1000, 2000), { x: 100, y: 500, w: 500, h: 1000 });
});
test('Mail and WhatsApp: share sheet with files, links as fallback, never automatic sending', async () => {
  assert.match(urlInvio('whatsapp', { titolo: 'Referti', links: ['https://drive/x'] }), /^https:\/\/wa\.me\/\?text=Referti%0Ahttps/);
  assert.match(urlInvio('mail', { titolo: 'Referti', links: ['https://drive/x'] }), /^mailto:\?subject=Referti&body=/);
  let condivisi = null; let aperto = null;
  const nav = { canShare: () => true, share: async (d) => { condivisi = d; } };
  assert.equal(await inviaCon('whatsapp', { titolo: 'T', files: [{ name: 'a.pdf' }] }, nav, (u) => { aperto = u; }), 'files');
  assert.equal(condivisi.files.length, 1); assert.equal(aperto, null);
  assert.equal(await inviaCon('whatsapp', { titolo: 'T', files: [{}], links: ['https://drive/x'] }, {}, (u) => { aperto = u; }), 'link');
  assert.match(aperto, /wa\.me/);
  assert.equal(await inviaCon('mail', { titolo: 'T', files: [{}] }, {}, () => {}), 'non_disponibile');
  assert.equal(await inviaCon('mail', { files: [{}] }, { canShare: () => true, share: async () => { throw Object.assign(new Error('x'), { name: 'AbortError' }); } }), 'annullato');
});
test('one PDF: photos become pages, PDFs are appended in order, other formats are reported', async () => {
  assert.equal(tipoFile({ type: 'image/jpeg' }), 'immagine');
  assert.equal(tipoFile({ name: 'x.PDF' }), 'pdf');
  assert.equal(tipoFile({ name: 'fattura.xml', type: 'application/octet-stream' }), 'altro');
  assert.equal(nomePdf('Referti / esami: 2026'), 'Referti esami 2026.pdf');
  const pdfDi = async (pagine) => { const d = await PDFDocument.create(); for (let i = 0; i < pagine; i++) d.addPage(); return d.save(); };
  const comeFileFinto = (bytes, name, type) => ({ name, type, arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) });
  const pdf2 = comeFileFinto(await pdfDi(2), 'a.pdf', 'application/pdf');
  const foto = { name: 'b.jpg', type: 'image/jpeg' };
  const xml = { name: 'c.xml', type: 'application/octet-stream' };
  const { unisciPdf } = await import('../personal/src/pdf/operazioni.js');
  const strumenti = { unisciPdf, elaboraPagina: async () => ({ url: 'x', larghezza: 1, altezza: 1 }), creaPdf: async () => { const b = await pdfDi(1); return { arrayBuffer: async () => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) }; } };
  const r = await unisciInPdf([pdf2, foto, xml], 'Referti', strumenti);
  assert.equal(r.file.type, 'application/pdf'); assert.equal(r.file.name, 'Referti.pdf');
  assert.deepEqual(r.esclusi, ['c.xml']);
  assert.equal((await PDFDocument.load(await r.file.arrayBuffer())).getPageCount(), 3);
  await assert.rejects(unisciInPdf([xml], 'x', strumenti), /Nessuna foto o PDF/);
});
test('UI wiring: Mail/WhatsApp buttons, single PDF option, scan and crop entries', () => {
  const p = (f) => readFileSync(new URL(`../personal/src/${f}`, import.meta.url), 'utf8');
  const sel = p('sezioni/documenti/Selezione.jsx');
  assert.match(sel, /inviaScelti\('mail'\)/); assert.match(sel, /inviaScelti\('whatsapp'\)/); assert.match(sel, /Unisci in un solo PDF/);
  const sal = p('sezioni/documenti/Salute.jsx');
  assert.match(sal, /tipo: 'scansione', opzioni/); assert.match(sal, /Seleziona e invia/); assert.match(sal, /selezioneIniziale/);
  assert.match(p('sezioni/documenti/Documento.jsx'), /tipo: 'modifica-immagine'/);
  assert.match(p('sezioni/documenti/index.jsx'), /'modifica-immagine': \{/);
  assert.match(p('Aggiungi.jsx'), /opzioni: \{ \.\.\.opzioni, descrizione/);
  assert.match(p('Aggiungi.jsx'), /<Ritaglio /);
});
