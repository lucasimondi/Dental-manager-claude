// DOCUMENTI-FIRMATI e FIRMA-BIRO — PO 2026-11-17: firmare e allegare a una risposta (solo bozza),
// cartella «Documenti firmati» in Poliedron e su Drive, titolo «… firmato» modificabile e suggerito dal
// contenuto, firma come una biro (pressione, sfumature, Bic nera e blu), foglio di salvataggio semplice
// con cartelle nuove create sia in Poliedron sia su Drive.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { INCHIOSTRI, PUNTA, pressioneUtile, pressioneDaVelocita, larghezzaDaPressione, densitaDaPressione, densita, tracce, gocce, nuovoTratto, aggiungiPunto, chiudiTratto, larghezze, contorno, salti, trama, riquadro, casuale, smorza } from '../personal/src/pdf/biro.js';
import { titoloIniziale, conFirmato } from '../personal/src/pdf/titoloFirmato.js';
import { caricaDocumento, suggerisciTitolo, bozzaConAllegato, daEmail } from '../personal/src/lib/archivio.js';

const codice = readFileSync('poliedron/archivio/Code.gs', 'utf8');
const migrazione = readFileSync('supabase/archivio/migrations/20261117120000_documenti_firmati.sql', 'utf8');
const firma = readFileSync('personal/src/pdf/Firma.jsx', 'utf8');
const salva = readFileSync('personal/src/pdf/SalvaArchivio.jsx', 'utf8');
const gestore = readFileSync('personal/src/pdf/GestorePdf.jsx', 'utf8');
const documenti = readFileSync('personal/src/sezioni/documenti/Documenti.jsx', 'utf8');
const indice = readFileSync('personal/src/sezioni/documenti/index.jsx', 'utf8');

/* ---------- biro ---------- */

// FIRMA-BIRO-2 (piano PO 2026-11-24): tratto vettoriale con pressione dalla velocità, attacco, coda,
// salti d'inchiostro e grana della carta, tutto ripetibile con seme fisso.
// Un tratto sintetico: n campioni in linea retta a passo costante (px) ogni dt ms.
const traccia = (n, passo, dt, { pressione = null, x0 = 10, y0 = 50 } = {}) => {
  const s = nuovoTratto({ x: x0, y: y0, t: 0, pressione });
  for (let i = 1; i <= n; i++) aggiungiPunto(s, { x: x0 + i * passo, y: y0 + Math.sin(i / 3) * 4, t: i * dt, pressione });
  return s;
};

test('biro: pressione dal dito ricavata dalla velocità con curva a coseno (lento = 1, ≥ 1,6 px/ms = 0,28)', () => {
  assert.equal(pressioneDaVelocita(0), 1);
  assert.ok(Math.abs(pressioneDaVelocita(1.6) - 0.28) < 1e-9);
  assert.ok(Math.abs(pressioneDaVelocita(9) - 0.28) < 1e-9);
  assert.ok(Math.abs(pressioneDaVelocita(0.8) - 0.64) < 1e-9, 'a metà corsa: metà della discesa');
  let prima = 2; for (const v of [0, 0.2, 0.5, 0.9, 1.3, 1.6]) { const p = pressioneDaVelocita(v); assert.ok(p <= prima); prima = p; }
  assert.ok(Math.abs(pressioneUtile({ pointerType: 'pen', pressure: 0.5 }) - Math.pow(0.5, 0.75)) < 1e-9, 'penna: p^0,75');
  assert.equal(pressioneUtile({ pointerType: 'pen', pressure: 0 }, 0), 1, 'penna senza pressione → come il dito');
  assert.equal(pressioneUtile({ pointerType: 'touch', pressure: 1 }, 0), 1);
  assert.ok(Math.abs(pressioneUtile({ pointerType: 'touch', pressure: 1 }, 5) - 0.28) < 1e-9, 'col dito la pressure del browser è ignorata');
  assert.ok(Math.abs(larghezzaDaPressione(1) - PUNTA * 1.1) < 1e-9 && Math.abs(larghezzaDaPressione(0) - PUNTA * 0.82) < 1e-9, 'FIRMA-BIRO-3: riga quasi costante');
  assert.equal(densitaDaPressione(1), 1); assert.equal(densitaDaPressione(0), 0.5);
  assert.equal(smorza(null, 2), 2);
  assert.equal(smorza(0, 2, 0.5), 1);
});

test('biro: spessore quasi costante (la sfera), è la densità a cambiare: lento carico, veloce chiaro; stabilizzazione 55%', () => {
  const lento = traccia(30, 2, 40), veloce = traccia(30, 40, 10);
  const media = (s, k) => s.punti.slice(8).reduce((t, p) => t + p[k], 0) / (s.punti.length - 8);
  assert.ok(media(lento, 'w') > media(veloce, 'w') && media(lento, 'w') < media(veloce, 'w') * 1.45, `${media(lento, 'w')} vs ${media(veloce, 'w')}`);
  assert.ok(media(lento, 'd') > 0.95 && media(veloce, 'd') < 0.7, `densità ${media(lento, 'd')} vs ${media(veloce, 'd')}`);
  assert.ok(lento.punti.every((p) => p.w >= PUNTA * 0.82 * 0.9 && p.w <= PUNTA * 1.1 * 1.09), 'tremolio piccolo');
  const s = nuovoTratto({ x: 0, y: 0, t: 0 });
  aggiungiPunto(s, { x: 100, y: 0, t: 50 });
  assert.ok(Math.abs(s.punti[1].x - 55) < 1e-9, 'il punto si sposta del 55% verso quello reale');
  aggiungiPunto(s, { x: 55.5, y: 0, t: 60 });
  assert.equal(s.punti.length, 2, 'micro-spostamenti scartati');
  const penna = traccia(20, 3, 16, { pressione: 1 }), leggera = traccia(20, 3, 16, { pressione: 0.1 });
  assert.ok(penna.punti.at(-1).w > leggera.punti.at(-1).w * 1.15 && penna.punti.at(-1).d > leggera.punti.at(-1).d + 0.3, 'con la penna conta la pressione reale');
});

test('biro: densità a gruppi (niente sovrapposizioni), tracce della sfera spezzate se veloce, gocce dove si ferma o gira', () => {
  assert.equal(densita(traccia(30, 2, 40).punti).length, 0, 'lento: inchiostro pieno');
  const g = densita(traccia(30, 40, 10).punti);
  assert.ok(g.length >= 1 && g.every((x) => x.a > 0 && x.a <= 0.45 && x.punti.length >= 2));
  const tv = tracce(traccia(30, 40, 10, {})), tl = tracce(traccia(30, 2, 40));
  assert.equal(tv.length, 2); assert.equal(tl.length, 2);
  const vuoto = (t) => t.trattini.filter((_, i) => i % 2).reduce((a, b) => a + b, 0) / t.trattini.reduce((a, b) => a + b, 0);
  assert.ok(vuoto(tv[0]) > vuoto(tl[0]), 'veloce: tracce più spezzate');
  assert.ok(tv[0].a > tl[0].a);
  assert.deepEqual(tracce(traccia(30, 40, 10)), tracce(traccia(30, 40, 10)), 'ripetibile col seme');
  const angolo = nuovoTratto({ x: 0, y: 0, t: 0 });
  for (let i = 1; i <= 20; i++) aggiungiPunto(angolo, { x: i * 4, y: 0, t: i * 30 });
  for (let i = 1; i <= 20; i++) aggiungiPunto(angolo, { x: 80, y: i * 4, t: 600 + i * 30 });
  assert.ok(gocce(angolo).length >= 1, 'goccia alla curva stretta');
  const dritta = nuovoTratto({ x: 0, y: 0, t: 0 });
  for (let i = 1; i <= 30; i++) aggiungiPunto(dritta, { x: i * 5, y: i, t: i * 16 });
  assert.equal(gocce(dritta).length, 0, 'riga dritta e scorrevole: nessuna goccia');
});

test('biro: attacco dal 62% e coda assottigliata fino al 20% quando il gesto finale è veloce', () => {
  const s = traccia(30, 2, 40);
  const grezze = s.punti.map((p) => p.w);
  const aperto = larghezze(s);
  assert.ok(Math.abs(aperto[0] / grezze[0] - (0.62 + 0.38 * Math.sin(Math.PI / 12))) < 1e-9);
  assert.ok(aperto[0] / grezze[0] < aperto[4] / grezze[4] && aperto[4] / grezze[4] < 1);
  assert.equal(aperto[10], grezze[10], 'in mezzo nessuna modifica');
  assert.equal(aperto.at(-1), grezze.at(-1), 'tratto ancora aperto: niente coda');
  const lento = larghezze(chiudiTratto(traccia(30, 2, 40))), veloce = larghezze(chiudiTratto(traccia(30, 40, 10)));
  const sLento = traccia(30, 2, 40), sVeloce = traccia(30, 40, 10);
  const rapportoLento = lento.at(-1) / sLento.punti.at(-1).w, rapportoVeloce = veloce.at(-1) / sVeloce.punti.at(-1).w;
  assert.ok(Math.abs(rapportoVeloce - 0.2) < 1e-9, `coda veloce ${rapportoVeloce}`);
  assert.ok(rapportoLento > 0.6 && rapportoLento <= 0.75, `coda lenta ${rapportoLento}`);
  assert.equal(lento[lento.length - 9], sLento.punti[sLento.punti.length - 9].w, 'solo gli ultimi 8 punti');
});

test('biro: poligono pieno (bordi a metà larghezza lungo le normali), salti solo sui segmenti veloci', () => {
  const punti = [{ x: 0, y: 0, w: 2, v: 0 }, { x: 10, y: 0, w: 4, v: 0 }, { x: 20, y: 0, w: 2, v: 0 }];
  const { L, R } = contorno(punti, punti.map((p) => p.w));
  assert.deepEqual(L.map((p) => Math.abs(p.y)), [1, 2, 1]);
  assert.deepEqual(R.map((p) => Math.abs(p.y)), [1, 2, 1]);
  assert.ok(L.every((p, i) => Math.sign(p.y) === -Math.sign(R[i].y)), 'bordi sui due lati');
  assert.equal(salti(traccia(30, 2, 40).punti).length, 0, 'lento: inchiostro pieno');
  const k = salti(traccia(30, 40, 10).punti);
  assert.ok(k.length > 10 && k.every((x) => x.a > 0 && x.a <= 0.28 + 1e-9 && x.larghezza < PUNTA * 0.5));
});

test('biro: grana della carta 96×96 ripetibile col seme, riquadro dell\'inchiostro', () => {
  const a = trama(casuale(17)), b = trama(casuale(17)), c = trama(casuale(18));
  assert.equal(a.length, 96 * 96);
  assert.deepEqual(a, b, 'stesso seme, stessa grana');
  assert.notDeepEqual(a, c);
  const marcati = a.filter((x) => x >= 200).length / a.length, vuoti = a.filter((x) => x === 0).length / a.length;
  assert.ok(marcati > 0.04 && marcati < 0.1 && vuoti > 0.55 && vuoti < 0.75, `${marcati} ${vuoti}`);
  assert.equal(riquadro([]), null);
  const r = riquadro([{ punti: [{ x: 10, y: 20, w: 2 }, { x: 30, y: 5, w: 1 }] }]);
  assert.deepEqual(r, { x0: 8, y0: 4, x1: 31, y1: 22 });
});

test('firma: Bic nera o blu ricordata, tratti vettoriali su livello opaco a 0,95, salti e grana tolti, data nello stesso colore', () => {
  assert.deepEqual(Object.keys(INCHIOSTRI), ['nero', 'blu']);
  assert.match(firma, /role="radiogroup" aria-label="Colore della biro"/);
  assert.match(firma, /personal-pdf-inchiostro-v1/);
  assert.match(firma, /globalCompositeOperation = 'destination-out'/);
  assert.match(firma, /quadraticCurveTo/);
  assert.match(firma, /globalAlpha = OPACITA_LIVELLO;/);
  assert.match(firma, /globalAlpha = OPACITA_TRATTO; dx\.drawImage/, 'ogni tratto sovrapposto: incroci più scuri');
  assert.match(firma, /aggiungiPunto\(s, campione\(ev\)\)/);
  assert.match(firma, /Annulla tratto/);
  assert.match(firma, /pngTesto\(testoOggi\(\), \{ colore \}\)/);
  assert.match(firma, /onUsa\(await ricolora\(png, colore\)/, 'anche la firma salvata esce nel colore scelto');
  assert.doesNotMatch(firma, /tocchi\(/, 'niente più tratto a tocchi sovrapposti (perline)');
});

/* ---------- foglio di salvataggio ---------- */

test('foglio: titolo «… firmato» modificabile, suggerimento, Documenti firmati predefinita, nuova cartella, altro facoltativo', () => {
  assert.equal(titoloIniziale({ origine: { titolo: 'Contratto luce' }, firmato: true }), 'Contratto luce firmato');
  assert.equal(titoloIniziale({ nomeFile: 'Copia di Modulo.pdf', firmato: false }), 'Modulo');
  assert.equal(titoloIniziale({ origine: { titolo: 'Modulo firmato' }, firmato: true }), 'Modulo firmato');
  assert.equal(titoloIniziale({ nomeFile: '', firmato: true }), 'Documento firmato');
  assert.equal(titoloIniziale({ nomeFile: 'Delega banca - modificato.pdf', firmato: true }), 'Delega banca firmato');
  assert.equal(conFirmato('Delega – Banca X', true), 'Delega – Banca X firmato');
  assert.equal(conFirmato('Delega firmata', true), 'Delega firmata');
  assert.equal(conFirmato('Delega', false), 'Delega');
  assert.match(salva, /useState\(firmato \? FIRMATI : AUTOMATICO\)/);
  assert.match(salva, /<option value=\{FIRMATI\}>Documenti firmati<\/option>/);
  assert.match(salva, /<option value=\{NUOVA\}>\+ Nuova cartella…<\/option>/);
  assert.match(salva, /creaCartella\(archivioDb, \{ nome: nuova\.nome, padre_id: nuova\.padre \|\| null \}\)/);
  assert.match(salva, /Suggerito dal contenuto/);
  assert.match(salva, /Altro \(facoltativo\): categoria, persona, tipo, tag/);
  assert.match(salva, /if \(clinico \|\| !testoPdf\) return undefined;/, 'mai il suggerimento per i pazienti');
  assert.match(salva, /Si crea solo una bozza in Gmail: la invii tu\./);
  assert.match(gestore, /if \(tipo !== 'data'\) firmatoRef\.current = true;/);
  assert.match(gestore, /'Salva firmato nell’archivio'/);
});

test('Documenti: sottosezione «Documenti firmati» a un tocco', () => {
  assert.match(documenti, /ctx\.apri\(\{ tipo: 'firmati' \}\)/);
  assert.match(documenti, /<span>Documenti firmati<\/span>/);
  assert.match(indice, /firmati: \{ titolo: 'Documenti firmati'/);
});

/* ---------- app → script ---------- */

test('app: caricamento con titolo esatto e cartella; titolo suggerito; bozza con allegato; daEmail', async () => {
  const inviati = [];
  const f = (risposta) => async (_u, o) => { inviati.push(JSON.parse(o.body)); return { json: async () => risposta }; };
  await caricaDocumento({ token: 't', dati: 'AA', nome: 'x.pdf', mime: 'application/pdf', titolo: 'Delega firmato', firmati: true }, f({ ok: true, id: 'd1' }));
  assert.equal(inviati[0].titolo, 'Delega firmato');
  assert.equal(inviati[0].firmati, true);
  assert.equal('cartella' in inviati[0], false);
  await caricaDocumento({ token: 't', dati: 'AA', nome: 'x.pdf', mime: 'application/pdf', cartella: 'c-1' }, f({ ok: true, id: 'd2' }));
  assert.equal(inviati[1].cartella, 'c-1');
  assert.equal('firmati' in inviati[1], false);

  assert.equal(await suggerisciTitolo({ token: 't', testo: 'Contratto di fornitura energia elettrica tra le parti', nome: 'x.pdf' }, f({ ok: true, titolo: 'Contratto – Enel – 2026' })), 'Contratto – Enel – 2026');
  assert.equal(inviati[2].azione, 'titolo_suggerito');
  const prima = inviati.length;
  assert.equal(await suggerisciTitolo({ token: 't', testo: 'testo lungo abbastanza per chiedere', clinico: true }, f({ ok: true, titolo: 'X' })), null);
  assert.equal(await suggerisciTitolo({ token: 't', testo: 'corto' }, f({ ok: true, titolo: 'X' })), null);
  assert.equal(inviati.length, prima, 'clinico o testo corto: nessuna chiamata');

  const r = await bozzaConAllegato({ token: 't', documento: 'd1', origine: 'o1', testo: 'Ecco' }, f({ ok: true, risposta: true, link: 'L' }));
  assert.equal(r.link, 'L');
  assert.deepEqual(inviati.at(-1), { token: 't', azione: 'bozza_allegato', documento: 'd1', origine: 'o1', testo: 'Ecco', a: '', oggetto: '' });
  await assert.rejects(bozzaConAllegato({ token: 't', documento: 'd1' }, f({ ok: false, errore: 'Il file supera 24 MB' })), /24 MB/);

  assert.equal(daEmail({ gmail_message_id: '18c2f' }), true);
  for (const id of ['caricato:1', 'drivefile:2', 'drivefoto:3', '', null]) assert.equal(daEmail({ gmail_message_id: id }), false);
});

/* ---------- script ---------- */

function scriptFinto({ cartelle = [], documenti = {}, rispostaAI = 'Contratto – Rossi – via Roma 1', messaggio = null } = {}) {
  const chiamate = [];
  const cartelleDrive = [];
  const bozze = [];
  const inviate = [];
  let ai = 0;
  const cartellaFinta = (id, nome) => ({ getId: () => id, getName: () => nome, isTrashed: () => false,
    createFolder: (n) => { const f = cartellaFinta('drv-' + n, n); cartelleDrive.push({ padre: id, nome: n }); return f; } });
  const ctx = {
    console: { log() {}, warn() {}, error() {} }, JSON, Date, Math, String, Number, Array, Object, RegExp, Error, encodeURIComponent, isFinite,
    PropertiesService: { getScriptProperties: () => ({ getProperty: () => null, setProperty() {} }) },
    Utilities: { sleep() {}, formatDate: (d) => d.toISOString().slice(0, 10) },
    DriveApp: {
      getFolderById: (id) => { if (id === 'sparita') throw new Error('not found'); return cartellaFinta(id, id); },
      getFileById: (id) => ({ getSize: () => (id === 'grande' ? 30e6 : 1000), getBlob: () => ({ blob: id }) }),
    },
    GmailApp: {
      createDraft: (a, oggetto, testo, opz) => { bozze.push({ nuova: true, a, oggetto, testo, opz }); return { getMessage: () => ({ getId: () => 'm-nuova' }) }; },
      sendEmail: () => inviate.push(1), getThreadById: () => ({ getMessages: () => (messaggio ? [messaggio] : []) }), getMessageById: () => messaggio,
    },
  };
  vm.createContext(ctx);
  vm.runInContext(codice, ctx);
  ctx.logErrore_ = () => {};
  ctx.cartellaRadice_ = () => cartellaFinta('radice', 'Archivio personale');
  ctx.testoAI_ = () => { ai++; return rispostaAI; };
  ctx.sb_ = (percorso, opzioni = {}) => {
    chiamate.push({ percorso, metodo: opzioni.method || 'get', corpo: opzioni.body });
    if (percorso.startsWith('cartelle_mie?select=id&speciale=eq.firmati')) return cartelle.filter((c) => c.speciale === 'firmati');
    if (percorso.startsWith('cartelle_mie?select=id') && opzioni.method === 'post') return [{ id: 'nuova-firmati' }];
    if (percorso.startsWith('cartelle_mie?select=id,nome,padre_id,drive_cartella_id,archiviata_il&id=eq.')) return cartelle.filter((c) => c.id === decodeURIComponent(percorso.split('id=eq.')[1]));
    if (percorso.startsWith('documenti?select=')) { const id = percorso.split('id=eq.')[1]; return documenti[id] ? [documenti[id]] : []; }
    return null;
  };
  return { ctx, chiamate, cartelleDrive, bozze, inviate, ai: () => ai };
}

test('script: «Documenti firmati» esiste o si crea; cartelle gemelle su Drive annidate come in Poliedron', () => {
  const vuoto = scriptFinto();
  assert.equal(vuoto.ctx.cartellaFirmati_(), 'nuova-firmati');
  assert.deepEqual(JSON.parse(JSON.stringify(vuoto.chiamate.at(-1).corpo)), { nome: 'Documenti firmati', speciale: 'firmati' });

  const { ctx, chiamate, cartelleDrive } = scriptFinto({ cartelle: [
    { id: 'casa', nome: 'Casa', padre_id: null, drive_cartella_id: null },
    { id: 'contratti', nome: 'Contratti: luce/gas', padre_id: 'casa', drive_cartella_id: 'sparita' },
  ] });
  const f = ctx.cartellaDriveDi_('contratti');
  assert.equal(f.getName(), 'Contratti- luce-gas');
  assert.deepEqual(cartelleDrive, [{ padre: 'radice', nome: 'Casa' }, { padre: 'drv-Casa', nome: 'Contratti- luce-gas' }]);
  const patch = chiamate.filter((c) => c.metodo === 'patch').map((c) => [c.percorso, c.corpo.drive_cartella_id]);
  assert.deepEqual(patch, [['cartelle_mie?id=eq.casa', 'drv-Casa'], ['cartelle_mie?id=eq.contratti', 'drv-Contratti- luce-gas']]);
  assert.throws(() => ctx.cartellaDriveDi_('inesistente'), /Cartella non trovata/);
});

test('script: titolo suggerito mai da un modello per i pazienti o con poco testo', () => {
  const s = scriptFinto();
  const ok = s.ctx.titoloSuggerito_({ testo: 'Contratto di locazione ad uso abitativo tra Rossi Mario e Luca', nome: 'scan.pdf' });
  assert.equal(ok.titolo, 'Contratto – Rossi – via Roma 1');
  assert.equal(s.ai(), 1);
  for (const req of [
    { testo: 'Consenso informato alle cure odontoiatriche del paziente', nome: 'modulo.pdf' },
    { testo: 'Documento qualsiasi con abbastanza testo da leggere', nome: 'referto_paziente.pdf' },
    { testo: 'Documento qualsiasi con abbastanza testo da leggere', nome: 'x.pdf', clinico: true },
    { testo: 'corto', nome: 'x.pdf' },
  ]) assert.equal(s.ctx.titoloSuggerito_(req).titolo, null);
  assert.equal(s.ai(), 1, 'nessuna altra chiamata al modello');
});

test('script: risposta con allegato — tutte le persone (mittente, A, Cc; mai Luca), scelta di Luca, stessa conversazione, mai inviata', () => {
  const uuid = (n) => `00000000-0000-4000-8000-00000000000${n}`;
  const intestazioni = { 'Message-ID': '<abc@ente.it>', References: '<prima@ente.it>' };
  const messaggio = {
    getFrom: () => 'Ufficio Ente <uff@ente.it>', getReplyTo: () => '', getSubject: () => 'Modulo da firmare',
    getTo: () => 'luca.simondi@gmail.com, "Rossi, Mario" <mario@studio.it>', getCc: () => 'avv@legale.it, uff@ente.it',
    getHeader: (h) => intestazioni[h] || '', getThread: () => ({ getId: () => 'thr1' }),
  };
  const documenti = {
    [uuid(1)]: { id: uuid(1), titolo: 'Modulo firmato', drive_file_id: 'f1' },
    [uuid(2)]: { gmail_message_id: '18c', gmail_thread_id: 'thr1' },
    [uuid(3)]: { gmail_message_id: 'caricato:x', gmail_thread_id: null },
    [uuid(4)]: { id: uuid(4), titolo: 'Grande', drive_file_id: 'grande' },
  };
  const s = scriptFinto({ documenti, messaggio });
  const bozzeApi = [];
  s.ctx.Utilities.base64Encode = (x) => Buffer.from(typeof x === 'string' ? x : Uint8Array.from(x)).toString('base64');
  s.ctx.Utilities.base64EncodeWebSafe = (x) => Buffer.from(x).toString('base64url');
  s.ctx.Utilities.getUuid = () => 'u1';
  s.ctx.Utilities.Charset = { UTF_8: 'UTF-8' };
  s.ctx.DriveApp.getFileById = (id) => ({ getSize: () => (id === 'grande' ? 30e6 : 1000), getBlob: () => ({ getName: () => 'Modulo firmato.pdf', getContentType: () => 'application/pdf', getBytes: () => [37, 80, 68, 70] }) });
  s.ctx.Gmail = { Users: { Drafts: { create: (r, utente) => { bozzeApi.push({ r, utente }); return { id: 'd1' }; } } } };

  const persone = s.ctx.destinatariRisposta_({ origine: uuid(2) }).persone;
  assert.deepEqual(JSON.parse(JSON.stringify(persone)), [
    { email: 'uff@ente.it', nome: 'Ufficio Ente', ruolo: 'mittente' },
    { email: 'mario@studio.it', nome: 'Rossi, Mario', ruolo: 'a' },
    { email: 'avv@legale.it', nome: '', ruolo: 'cc' },
  ]);
  assert.equal(s.ctx.destinatariRisposta_({ origine: uuid(3) }).ok, false);

  // Luca toglie il mittente: resta Mario in A e l'avvocato in Cc, nella stessa conversazione.
  const r = s.ctx.bozzaConAllegato_({ documento: uuid(1), origine: uuid(2), testo: '', destinatari: [{ email: 'mario@studio.it', ruolo: 'a' }, { email: 'avv@legale.it', ruolo: 'cc' }, { email: 'luca.simondi@gmail.com', ruolo: 'a' }] });
  assert.equal(r.ok, true); assert.equal(r.risposta, true);
  assert.equal(r.link, 'https://mail.google.com/mail/u/0/#all/thr1');
  assert.equal(bozzeApi[0].utente, 'me');
  assert.equal(bozzeApi[0].r.message.threadId, 'thr1');
  const raw = Buffer.from(bozzeApi[0].r.message.raw, 'base64url').toString();
  assert.match(raw, /^To: mario@studio\.it\r\nCc: avv@legale\.it\r\n/);
  assert.doesNotMatch(raw, /uff@ente\.it|luca\.simondi/);
  assert.match(raw, /In-Reply-To: <abc@ente\.it>\r\nReferences: <prima@ente\.it> <abc@ente\.it>/);
  assert.match(raw, /Content-Disposition: attachment; filename="=\?UTF-8\?B\?/);
  assert.match(Buffer.from(raw.match(/base64\r\n\r\n([^\r]+)/)[1], 'base64').toString(), /in allegato il documento firmato/);

  // Senza scelta: tutti. Gmail API non disponibile → email nuova solo con le persone scelte.
  s.ctx.Gmail.Users.Drafts.create = () => { throw new Error('Gmail API has not been used'); };
  const riserva = s.ctx.bozzaConAllegato_({ documento: uuid(1), origine: uuid(2), testo: 'Ciao' });
  assert.equal(riserva.risposta, false);
  assert.deepEqual(JSON.parse(JSON.stringify(s.bozze.map((b) => [b.a, b.oggetto, b.opz.cc]))), [['uff@ente.it,mario@studio.it', 'Re: Modulo da firmare', 'avv@legale.it']]);
  assert.equal(s.ctx.bozzaConAllegato_({ documento: uuid(1), origine: uuid(2), destinatari: [] }).errore, 'Scegli almeno un destinatario.');

  // Email nuova (originale non da email), file troppo grande, documento assente.
  const nuova = s.ctx.bozzaConAllegato_({ documento: uuid(1), origine: uuid(3), a: 'x@y.it', testo: 'Ciao' });
  assert.equal(nuova.risposta, false);
  assert.equal(s.bozze.at(-1).a, 'x@y.it');
  assert.match(s.ctx.bozzaConAllegato_({ documento: uuid(4) }).errore, /24 MB/);
  assert.equal(s.ctx.bozzaConAllegato_({ documento: 'non-uuid' }).ok, false);
  assert.equal(s.inviate.length, 0, 'mai inviata');
  const blocco = codice.slice(codice.indexOf('function bozzaConAllegato_'), codice.indexOf('CARICAMENTO DALL\'APP (Poliedron Personal)'));
  assert.doesNotMatch(blocco, /sendEmail|\.send\(|Drafts\.send|Messages\.send/);
  assert.match(readFileSync('poliedron/archivio/appsscript.json', 'utf8'), /"serviceId": "gmail"/);
});

test('script: caricamento nella cartella scelta (nome = titolo, file fisso), ordinaDrive_ non lo sposta, azioni nuove', () => {
  assert.match(codice, /const idCartella = req\.firmati \? cartellaFirmati_\(\) : \(UUID_\.test\(String\(req\.cartella \|\| ''\)\) \? String\(req\.cartella\) : null\);/);
  assert.match(codice, /const cartella = idCartella \? cartellaDriveDi_\(idCartella\)/);
  assert.match(codice, /if \(titoloScelto\) analisi\.titolo = titoloScelto;/);
  assert.match(codice, /file\.setName\(idCartella \? pulisciNome_\(analisi\.titolo/);
  assert.match(codice, /body: \{ drive_fissa: true, drive_cartella: 'cartella:' \+ idCartella \}/);
  assert.match(codice, /&drive_fissa=is\.false&gmail_message_id=not\.like\.drivefoto/);
  assert.match(codice, /if \(req\.azione === 'titolo_suggerito'\) return rispostaJson_\(titoloSuggerito_\(req\)\);/);
  assert.match(codice, /if \(req\.azione === 'bozza_allegato'\) return rispostaJson_\(bozzaConAllegato_\(req\)\);/);
  assert.match(codice, /try \{ allineaCartelleDrive_\(\); \} catch \(e\) \{ logErrore_\('cartelle Drive', e\); \}/);
});

test('migrazione: solo aggiunte, cartella speciale unica, file fisso con default false', () => {
  assert.doesNotMatch(migrazione, /\bdrop\s+(table|column|function|view|policy|trigger)\b/i);
  assert.doesNotMatch(migrazione, /\bdelete\s+from\b|\bupdate\s+\w+\s+set\b/i);
  assert.match(migrazione, /add column if not exists drive_cartella_id text/);
  assert.match(migrazione, /check \(speciale is null or speciale in \('firmati'\)\)/);
  assert.match(migrazione, /create unique index if not exists cartelle_mie_speciale_unica on cartelle_mie \(speciale\) where speciale is not null/);
  assert.match(migrazione, /add column if not exists drive_fissa boolean not null default false/);
  assert.match(migrazione, /insert into cartelle_mie \(nome, speciale\)\s+select 'Documenti firmati', 'firmati'\s+where not exists/);
  assert.match(migrazione, /c\.drive_cartella_id, c\.speciale\s+from cartelle_mie c;/);
  assert.match(migrazione, /revoke all on v_cartelle_mie from anon;/);
});
