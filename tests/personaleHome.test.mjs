// PERSONALE-HOME (PO 2026-11-16, mockup approvato): Home «Personale» e Conti coordinati.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(p, 'utf8');

test('dock: «Personale» apre direttamente la Home personale, in Personal e in Studio', () => {
  // PERSONAL-ESPLORA-WIN11 fase 3: la barra stile Windows 11 tiene «Personale» → stessa vista.
  assert.match(read('personal/src/lib/barra.js'), /\{ id: 'altro', nome: 'Personale', vista: 'altro' \}/);
  assert.doesNotMatch(read('personal/src/lib/barra.js'), /Per te/);
  assert.match(read('src/components/poliedron/PoliedronMobileDock.jsx'), /\{ id: 'perte', label: 'Personale', icon: 'user' \}/);
  assert.match(read('personal/src/sezioni/altro/index.jsx'), /id: 'altro', nome: 'Personale', Icona: IconaPerTe, Vista: VistaPersonale/);
});

test('Home personale: Da fare, Conti, Documenti, Scan, Il tuo spazio, Recenti', () => {
  const h = read('personal/src/sezioni/altro/Personale.jsx');
  for (const t of ['Da fare', 'Conti', 'Documenti', 'Scan', 'Il tuo spazio', 'Recenti', 'Cerca nelle tue cose', 'Impostazioni e account']) assert.match(h, new RegExp(t));
  for (const v of ["'personali', 'Identità'", "'foto', 'Foto'", "'note', 'Note'", "'legal', 'Pratiche'", "'diario', 'Diario'", "'didattica', 'Biblioteca'", "'password', 'Password'", "'oggi', 'Oggi'"]) assert.ok(h.includes(v), v);
  assert.match(h, /apri\(\{ tipo: 'scan' \}\)/); // SCAN-APP: Scan come app dentro Personal
  assert.match(h, /onClick=\{ctx\.apriAggiungi\}/);
  assert.match(read('personal/src/App.jsx'), /apriAggiungi: \(\) => setFoglio\(true\)/);
});

test('Home personale: i documenti clinici dei pazienti non compaiono tra i recenti', () => {
  assert.match(read('personal/src/sezioni/altro/Personale.jsx'), /filter\(\(x\) => x\.fascicolo !== 'clinico_pazienti'\)/);
});

test('Home personale: la ricerca filtra le sezioni (PER_TE) e non tocca il database', () => {
  const h = read('personal/src/sezioni/altro/Personale.jsx');
  assert.match(h, /PER_TE\.filter/);
  assert.doesNotMatch(h, /\.insert\(|\.update\(|\.delete\(|\.upsert\(/);
});

test('Conti: prossima scadenza in Movimenti e «Da valutare» che apre la revisione', () => {
  const c = read('personal/src/sezioni/conti/Conti.jsx');
  assert.match(c, /function ProssimaScadenza\(\{ s, onApri \}\)/);
  assert.match(c, /!s\.completata && s\.importo != null/);
  assert.match(c, /function Periodo\(\{ tipo, rif, onTipo, onRif, apri \}\)/);
  assert.match(c, /<Periodo [^>]*apri=\{apri\} \/>/);
});

test('stile: personale.css caricato dopo pro.css; Conti restilizzato solo nella sua vista', () => {
  const m = read('personal/src/main.jsx');
  assert.ok(m.indexOf("'./personale.css'") > m.indexOf("'./pro.css'"));
  const css = read('personal/src/personale.css');
  assert.match(css, /\.pp-vista-conti \.pp-saldo \{/);
  assert.match(css, /prefers-color-scheme: dark/);
  assert.doesNotMatch(css.replace(/\.pp-vista-conti [^{]+\{[^}]*\}/g, ''), /\.pp-saldo|\.pp-segmenti|\.pp-movimento/);
});

test('PERSONALE-GRAFICA: niente più «Per te»; Home con testata propria; dock e Da fare coordinati', () => {
  for (const f of ['personal/src/Aggiungi.jsx', 'personal/src/sezioni/agenda/AgendaGriglia.jsx', 'src/components/Agenda.jsx', 'shared/note/note.js']) assert.doesNotMatch(read(f), /'Per te'/, f);
  assert.match(read('shared/note/note.js'), /\{ id: 'personale', nome: 'Personale'/);
  assert.match(read('personal/src/sezioni/altro/index.jsx'), /classeTestata: 'pp-testata-personale'/);
  assert.match(read('personal/src/sezioni/altro/Personale.jsx'), /className="pps-profilo" onClick=\{\(\) => apri\(\{ tipo: 'impostazioni' \}\)\} aria-label="Impostazioni"/);
  const css = read('personal/src/personale.css');
  assert.match(css, /\.pp-testata\.pp-testata-personale \{ display: none; \}/);
  assert.match(css, /env\(safe-area-inset-top\)/);
  assert.match(css, /\.pp-vista-dafare \.pp-dafare-riepilogo \{/);
});

test('PERSONAL-ESPLORA-WIN11 fase 3: barra stile Windows 11 al posto del dock (misure dalla specifica)', () => {
  // Sostituisce DOCK-UGUALE (PO 2026-11-16) per decisione del PO del 2026-11-21 (prototipo approvato).
  const css = read('personal/src/barra.css');
  // PR #337 (PO 2026-11-21): 48 px desktop / 56 px mobile, pulsanti 40×40, trattino 16/6 px, Mica/Acrylic.
  assert.match(css, /:root:root \{ --pp-dock: 48px; \}/);
  assert.match(css, /@media \(pointer: coarse\), \(max-width: 767px\) \{ :root:root \{ --pp-dock: 56px; \} \}/);
  assert.match(css, /\.pb-voce \{\n  position: relative; width: 40px; height: 40px;[^}]*border-radius: 6px;/);
  assert.match(css, /\.pb-icone \{[^}]*gap: 4px;/);
  assert.match(css, /\.pb-voce:active \{ transform: scale\(\.92\); \}/);
  assert.match(css, /transition: background-color \.12s, transform \.12s;/);
  assert.match(css, /--pb-accento: #005FB8;/);
  assert.match(css, /\.pb-voce\.attiva::after \{ width: 16px; \}/);
  assert.match(css, /\.pb-voce\.aperta:not\(\.attiva\)::after \{ width: 6px;/);
  assert.match(css, /backdrop-filter: blur\(30px\) saturate\(150%\)/);
  assert.match(css, /--pb-hover: rgba\(255, 255, 255, \.08\);/);
  assert.match(css, /--pb-linea: rgba\(255, 255, 255, \.08\);/);
  // PR #337 dock: su mobile l'area di sistema si riduce alla campanella con il pallino
  assert.match(css, /\.pb-drive, \.pb-ora, \.pb-notifiche \{ display: none; \}/);
  assert.match(css, /\.pb-campanella \{ display: grid; \}/);
  assert.match(css, /--pb-bordo: rgba\(255, 255, 255, \.08\);/);
  assert.match(css, /'Segoe UI Variable Text', 'Segoe UI Variable', 'Segoe UI', system-ui/);
  assert.match(css, /env\(safe-area-inset-bottom\)/);
  const app = read('personal/src/App.jsx');
  assert.doesNotMatch(app, /pp-schede pp-dock/);
  assert.match(app, /<BarraApplicazioni vista=\{vista\} pagine=\{pagine\}/);
  // l'icona del calendario resta quella di Studio
  const ic = read('src/components/ui/Ic.jsx'), mie = read('personal/src/IconeDock.jsx');
  for (const d of ['M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16']) { assert.ok(ic.includes(d)); assert.ok(mie.includes(d)); }
});

test('PERSONALE-GRAFICA 2: in Conti i tasti affiancati vanno a capo invece di uscire dal bordo', () => {
  const css = read('personal/src/personale.css');
  assert.match(css, /\.pp-vista-conti \.pp-azioni-due \{ display: grid; grid-template-columns: repeat\(auto-fit, minmax\(min\(100%, 168px\), 1fr\)\)/);
  assert.match(css, /\.pp-vista-conti \.pp-chip-azione \{ white-space: nowrap;/);
});
