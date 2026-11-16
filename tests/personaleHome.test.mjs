// PERSONALE-HOME (PO 2026-11-16, mockup approvato): Home «Personale» e Conti coordinati.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(p, 'utf8');

test('dock: «Personale» apre direttamente la Home personale, in Personal e in Studio', () => {
  assert.match(read('personal/src/App.jsx'), /<span>Personale<\/span>/);
  assert.doesNotMatch(read('personal/src/App.jsx'), /<span>Per te<\/span>/);
  assert.match(read('src/components/poliedron/PoliedronMobileDock.jsx'), /\{ id: 'perte', label: 'Personale', icon: 'user' \}/);
  assert.match(read('personal/src/sezioni/altro/index.jsx'), /id: 'altro', nome: 'Personale', Icona: IconaPerTe, Vista: VistaPersonale/);
});

test('Home personale: Da fare, Conti, Documenti, Scan, Il tuo spazio, Recenti', () => {
  const h = read('personal/src/sezioni/altro/Personale.jsx');
  for (const t of ['Da fare', 'Conti', 'Documenti', 'Scan', 'Il tuo spazio', 'Recenti', 'Cerca nelle tue cose', 'Impostazioni e account']) assert.match(h, new RegExp(t));
  for (const v of ["'personali', 'Identità'", "'foto', 'Foto'", "'note', 'Note'", "'legal', 'Pratiche'", "'diario', 'Diario'", "'didattica', 'Biblioteca'", "'password', 'Password'", "'oggi', 'Oggi'"]) assert.ok(h.includes(v), v);
  assert.match(h, /href=\{indirizzoScan\(\)\}/);
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
  assert.match(css, /\.pp-schede \.pp-scheda\.attiva/);
  assert.match(css, /\.pp-vista-dafare \.pp-dafare-riepilogo \{/);
});
