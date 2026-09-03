import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { creaRicettaPdf, creaAnamnesiPdf } from '../src/lib/pdfDocs.js';
import { getStableViewportSize } from '../src/lib/poliedron/poliedronSafeBounds.js';

const src = (path) => fs.readFileSync(path, 'utf8');
const pannello = src('src/components/ui/PannelloInvioDocumento.jsx');
const condivisione = src('src/lib/condivisionePdf.js');
const docFiscale = src('src/components/DocFiscale.jsx');
const clinical = src('src/components/PatientClinicalHistory.jsx');
const schedaPaz = src('src/components/SchedaPaz.jsx');
const mobilePos = src('src/components/poliedron/usePoliedronPosition.js');
const edgePos = src('src/components/poliedron/usePoliedronEdgePosition.js');

// A/B — Ricetta: PDF reale (già coperto in patientPreMergeQa.test.mjs) + anteprima reale collegata.
test('A. Genera PDF apre davvero la preview storica (PdfViewerModal), non solo condividi/scarica', () => {
  assert.match(pannello, /lazy\(\(\) => import\('\.\/PdfViewerModal\.jsx'\)\)/);
  assert.match(pannello, /Apri anteprima/);
  assert.match(pannello, /<PdfViewerModal titolo=\{pronto\.titolo\} dataUrl=\{pronto\.dataUrl\} filename=\{pronto\.filename\}/);
});

test('B. Ricetta conserva paziente/firma/timbro nel documento generato', () => {
  const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFhQGAWjR9WQAAAABJRU5ErkJggg==';
  const result = creaRicettaPdf({ paziente: { nome: 'Anna', cognome: 'Bianchi' }, studio: { nome: 'Studio QA', firma_b64: png }, data: '2026-08-26', farmaci: [{ nome: 'Farmaco X' }] });
  assert.match(result.filename, /Bianchi/);
  assert.ok(result.doc.output('arraybuffer').byteLength > 1000);
});

// C/D — Fattura e Rimborso: struttura del PDF (stessa funzione generaPdf, invariata da questo QA).
test('C. Fattura genera un documento con titolo, box paziente e timbro configurato', () => {
  assert.match(docFiscale, /const titoloDoc = tipo === 'fattura' \? 'FATTURA' : 'RIMBORSO SPESE'/);
  assert.match(docFiscale, /drawFiscalStamp\(doc, STUDIO\)/);
  assert.match(docFiscale, /txt\(`\$\{paz\.nome\} \$\{paz\.cognome\}`, M \+ 90, y \+ 12\)/);
});

test('D. Rimborso include IBAN e dicitura dedicata, distinta dalla Fattura', () => {
  assert.match(docFiscale, /tipo === 'rimborso' && iban/);
  assert.match(docFiscale, /COORDINATE BANCARIE PER IL RIMBORSO/);
  assert.match(docFiscale, /Il presente documento attesta il rimborso delle spese sanitarie/);
});

// E — root cause reale del bug "prestazioni casuali": voci/selectedPiani non
// venivano azzerate cambiando tipo (Fattura ↔ Rimborso), quindi il PDF
// generato poteva contenere prestazioni scelte per l'altro documento.
test('E. Cambiare tipo Fattura/Rimborso azzera sempre le prestazioni selezionate', () => {
  assert.match(docFiscale, /if \(val === tipo\) return;/);
  assert.match(docFiscale, /setTipo\(val\); setGenerated\(false\); setVoci\(\[\]\); setSelectedPiani\(\[\]\); clearVociDraft\(\);/);
});

// F — Il payload "WhatsApp" per Fattura/Rimborso è la condivisione nativa
// dello STESSO file generato (pronto.dataUrl): non esiste un secondo
// generatore di testo/prestazioni che potrebbe divergere dal PDF.
test('F. Condivisione (WhatsApp incluso) invia esattamente lo stesso PDF mostrato in anteprima', () => {
  assert.match(pannello, /condividiPdf\(pronto\.dataUrl, pronto\.filename\)/);
  assert.doesNotMatch(docFiscale, /navigator\.share|WhatsApp|wa\.me/);
});

// G — root cause reale del bug "su mobile il Rimborso non scarica": il
// download usava un <a href="data:..."> diretto, inaffidabile su iOS
// Safari/WebView per payload non banali. Ora passa sempre da un blob: URL.
test('G. Il download (Rimborso incluso) usa un blob: URL, non il data: URI grezzo', () => {
  assert.match(condivisione, /export function scaricaPdf\(dataUrl, filename\) \{/);
  const body = condivisione.split('export function scaricaPdf')[1].split('\n\n')[0];
  assert.match(body, /dataUrlToFile\(dataUrl, filename\)/);
  assert.match(body, /URL\.createObjectURL\(file\)/);
  assert.doesNotMatch(body, /a\.href = dataUrl/);
  // Anche gli scarichi dall'archivio fiscale (non solo il flusso "appena generato") passano dallo stesso helper.
  assert.doesNotMatch(docFiscale, /a\.href = full\.pdf_base64/);
  assert.match(docFiscale, /scaricaPdf\(full\.pdf_base64,/);
});

// H — root cause reale del bug Anamnesi: il salvataggio produceva solo una
// nota testuale, mai un documento. Ora genera un vero PDF (stesso motore
// jsPDF/timbro degli altri documenti) e lo mostra tramite lo stesso pannello.
test('H. Anamnesi produce un documento PDF reale, visualizzabile e scaricabile', () => {
  const result = creaAnamnesiPdf({
    paziente: { nome: 'Luca', cognome: 'Verdi' },
    studio: { nome: 'Studio QA' },
    risposte: [{ titolo: 'Diabete', valore: 'si', note: 'compensato' }],
    farmaci: [{ nome: 'Metformina' }],
    allergie: [{ sostanza: 'Penicillina' }],
    data: '2026-08-27',
  });
  assert.match(result.dataUrl, /^data:application\/pdf;/);
  assert.match(result.filename, /anamnesi_Verdi_2026-08-27\.pdf/);
  assert.ok(result.doc.output('arraybuffer').byteLength > 1000);
});

test('H2. Il flusso Anamnesi genera e mostra davvero il documento dopo il salvataggio, senza inventare RPC/firma', () => {
  assert.match(clinical, /import \{ creaAnamnesiPdf \} from '\.\.\/lib\/pdfDocs\.js';/);
  assert.match(clinical, /const \{ doc, dataUrl, filename \} = creaAnamnesiPdf\(/);
  assert.match(clinical, /setPronto\(\{ dataUrl, filename, titolo: 'Modulo anamnesi', tipoDoc: 'anamnesi' \}\)/);
  assert.match(clinical, /\{pronto && \(/);
  assert.match(clinical, /<PannelloInvioDocumento/);
  // Il blocker reale (firma/RPC non verificate) resta esplicito, non aggirato.
  assert.match(clinical, /Firma anamnesi non disponibile/);
  assert.doesNotMatch(clinical, /\.rpc\(/);
  // L'archiviazione è additiva e best-effort: non deve mai bloccare la produzione del documento.
  assert.match(clinical, /catch \{ \/\* archiviazione best-effort/);
});

test('N. Anamnesi non fa query all\'apertura generale: la query resta dentro saveHistory, dopo la compilazione', () => {
  assert.match(clinical, /const saveHistory = async \(data\) => \{[\s\S]*supabase\.from\('documenti_medici'\)/);
  assert.doesNotMatch(clinical, /useEffect\(\(\) => \{[^}]*documenti_medici/);
});

// I/J/K — Note, Richiamo, Appuntamento: verifica end-to-end del cablaggio
// reale (già presente su entrambi i mount point), non solo della UI.
test('I/J/K. Note, richiamo e appuntamento restano cablati end-to-end su entrambi i mount point', () => {
  const app = src('src/App.jsx');
  const pazienti = src('src/components/Pazienti.jsx');
  for (const wiring of ['richiami={richiami}', 'setRichiami={setRichiamiSync}', 'onNuovoAppuntamento=', 'onPatientChange=']) {
    assert.match(app, new RegExp(wiring.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  for (const wiring of ['richiami={richiami}', 'setRichiami={setRichiami}', 'onNuovoAppuntamento={onNuovoAppuntamento}', 'onPatientChange={setScheda}']) {
    assert.match(pazienti, new RegExp(wiring.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});

// L — visualViewport è proprio la superficie che varia con chrome/tastiera.
// La posizione fixed deve usare il layout viewport (documentElement).
test('L1. getStableViewportSize ignora visualViewport e innerHeight transitori', () => {
  const originalWindow = globalThis.window;
  const originalDocument = globalThis.document;
  try {
    globalThis.window = { innerWidth: 390, innerHeight: 844, visualViewport: { width: 390, height: 780 } };
    globalThis.document = { documentElement: { clientWidth: 390, clientHeight: 844 } };
    const before = getStableViewportSize();
    assert.deepEqual(before, { width: 390, height: 844 });

    globalThis.window.innerHeight = 600;
    globalThis.window.visualViewport.height = 560;
    const during = getStableViewportSize();
    assert.deepEqual(during, { width: 390, height: 844 });
    assert.deepEqual(before, during, 'la posizione calcolata da questi valori deve restare identica prima/durante');
  } finally {
    globalThis.window = originalWindow;
    globalThis.document = originalDocument;
  }
});

test('L2. getStableViewportSize ricade su window.innerWidth/innerHeight quando visualViewport non esiste', () => {
  const originalWindow = globalThis.window;
  try {
    globalThis.window = { innerWidth: 1280, innerHeight: 800 };
    assert.deepEqual(getStableViewportSize(), { width: 1280, height: 800 });
  } finally {
    globalThis.window = originalWindow;
  }
});

test('L3. Entrambi gli hook di posizionamento usano la sorgente stabile, non più window.innerWidth/innerHeight grezzi', () => {
  assert.match(mobilePos, /getStableViewportSize/);
  assert.match(edgePos, /getStableViewportSize/);
  assert.doesNotMatch(mobilePos, /viewportWidth: window\.innerWidth/);
  assert.doesNotMatch(mobilePos, /viewportHeight: window\.innerHeight/);
  assert.doesNotMatch(edgePos, /viewportWidth: window\.innerWidth/);
});

test('L4. La posizione "docked" si aggiorna anche su resize/orientationchange (niente più no-op quando fraction è null)', () => {
  assert.doesNotMatch(mobilePos, /setFraction\(\(current\) => \(current \? \{ \.\.\.current \} : current\)\)/);
  assert.match(mobilePos, /const reclamp = \(\) => \{\s*safeAreaInsetsRef\.current = readSafeAreaInsets\(\);\s*setLayoutRevision\(\(revision\) => revision \+ 1\);/);
});

test('L5. Nessun frame di posizione bloccata "stantia" dopo lo sblocco (lock solo mentre positionLocked è vero)', () => {
  assert.doesNotMatch(mobilePos, /\} else if \(lockedPositionRef\.current\) position = lockedPositionRef\.current;/);
  assert.doesNotMatch(edgePos, /\} else if \(lockedPlacementRef\.current\) placement = lockedPlacementRef\.current;/);
});

// M — Product Owner follow-up: every destination must be visible without
// horizontal scrolling. POL-FIN-007f replaced the grid (itself a previous
// fix for "troppo ingombrante", then rejected again as not "pro") with a
// persistent sidebar (desktop) / dropdown selector (mobile) — same
// no-horizontal-scroll guarantee, different implementation.
test('M. Tutte le sezioni della Scheda Paziente sono raggiungibili senza scroll orizzontale', () => {
  assert.match(schedaPaz, /className="patient-record-nav"/);
  assert.match(schedaPaz, /className="patient-record-nav-mobile"/);
  assert.doesNotMatch(schedaPaz, /overflowX: 'auto', WebkitOverflowScrolling: 'touch'/);
  // Tutte le tab, incluse Documenti, restano presenti e invariate nel comportamento.
  for (const id of ['info', 'clinical', 'piani', 'paga', 'foto', 'app', 'doc']) assert.match(schedaPaz, new RegExp(`id: '${id}'`));
});

// POL-UI-020: Product Owner — tasti chiamata/WhatsApp in header, più una
// croce a 3 stati (bianca=anamnesi mancante, verde=nessun allarme, rossa
// lampeggiante=allarme) che apre un popup di dettaglio; se in allarme il
// popup compare già da solo all'apertura della scheda.
const css2 = fs.readFileSync('src/components/PremiumVisualSystem.css', 'utf8');

test('O. Header scheda paziente ha i tasti chiamata e WhatsApp', () => {
  assert.match(schedaPaz, /href=\{`tel:\+39\$\{paz\.telefono\.replace\(\/\\D\/g, ''\)\}`\}/);
  assert.match(schedaPaz, /<WaAction tel=\{paz\.telefono\} features=\{features\} variant="icon"/);
});

test('O2. La croce anamnesi ha 3 stati (bianca/verde/rossa lampeggiante) derivati dai campi anamnesi reali del paziente', () => {
  assert.match(schedaPaz, /const anamnesiState = !paz\.anamnesiCompilataIl \? 'mancante' : \(paz\.anamnesiAllarme \? 'allarme' : 'ok'\);/);
  assert.match(schedaPaz, /className=\{anamnesiState === 'allarme' \? 'anamnesi-cross anamnesi-cross--allarme' : 'anamnesi-cross'\}/);
  assert.match(css2, /\.anamnesi-cross--allarme\{animation:anamnesi-cross-blink/);
  assert.match(css2, /@media\(prefers-reduced-motion:reduce\)\{\.anamnesi-cross--allarme\{animation:none\}\}/);
});

test('O3. In allarme il popup anamnesi si apre da solo all\'apertura della scheda, senza un effetto post-mount vietato in questo file', () => {
  assert.doesNotMatch(schedaPaz, /useEffect/);
  assert.match(schedaPaz, /const \[anamnesiPopup, setAnamnesiPopup\] = useState\(\(\) => anamnesiState === 'allarme'\);/);
});

test('O4. Il popup mostra il contenuto giusto per ciascuno dei 3 stati anamnesi', () => {
  assert.match(schedaPaz, /Compila anamnesi/);
  assert.match(schedaPaz, /nessuna condizione a rischio riferita/);
  assert.match(schedaPaz, /\(paz\.anamnesiAllarmeDettagli \|\| \[\]\)\.map/);
});

// N — nessuna query eager per le sezioni pesanti, invariato da prima di questo QA.
test('N2. Foto/Fisio/Documenti restano lazy e montati solo per la propria tab', () => {
  assert.match(schedaPaz, /lazy\(\(\) => import\('\.\/PatientPhotos\.jsx'\)\)/);
  assert.match(schedaPaz, /lazy\(\(\) => import\('\.\/PhysioCartella\.jsx'\)\)/);
  assert.match(schedaPaz, /lazy\(\(\) => import\('\.\/PatientWorkspaceDocuments\.jsx'\)\)/);
  assert.match(schedaPaz, /\{tab === 'foto' &&/);
  assert.match(schedaPaz, /\{tab === 'fisio' && canAccessPhysio &&/);
});
