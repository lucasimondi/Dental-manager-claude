// POL-VITA-008 — Condividi (foglio di condivisione del sistema), Personali solo delle persone
// in Impostazioni, fascia degli eventi del giorno flottante e switch Studio accanto alla vista.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { condividi, comeFile } from '../personal/src/lib/condividi.js';

const file = { name: 'ci.pdf' };

test('condividi: il file vero quando il telefono lo accetta, altrimenti il link, altrimenti il link copiato', async () => {
  const chiamate = [];
  const navFile = { canShare: () => true, share: async (d) => chiamate.push(d) };
  assert.equal(await condividi({ titolo: 'CI', link: 'https://drive/x', file }, navFile), 'file');
  assert.deepEqual(chiamate[0], { files: [file], title: 'CI' });
  const navLink = { canShare: () => false, share: async (d) => chiamate.push(d) };
  assert.equal(await condividi({ titolo: 'CI', link: 'https://drive/x', file }, navLink), 'link');
  assert.equal(chiamate[1].url, 'https://drive/x');
  let copiato = null;
  assert.equal(await condividi({ titolo: 'CI', link: 'https://drive/x' }, { clipboard: { writeText: async (t) => { copiato = t; } } }), 'copiato');
  assert.equal(copiato, 'https://drive/x');
  assert.equal(await condividi({ titolo: 'CI' }, {}), 'non_disponibile');
});

test('condividi: annullare il foglio non è un errore', async () => {
  const nav = { canShare: () => true, share: async () => { const e = new Error('x'); e.name = 'AbortError'; throw e; } };
  assert.equal(await condividi({ titolo: 'CI', file }, nav), 'annullato');
});

test('file dallo script: base64 → File con nome e tipo', () => {
  const f = comeFile({ nome: 'ci.pdf', mime: 'application/pdf', dati: Buffer.from('%PDF').toString('base64') });
  assert.equal(f.name, 'ci.pdf');
  assert.equal(f.type, 'application/pdf');
  assert.equal(f.size, 4);
});

test('app: Personali solo delle persone in Impostazioni; anteprima e Condividi nelle schede e nel dettaglio', () => {
  const app = readFileSync('personal/src/sezioni/personali/Personali.jsx', 'utf8') + readFileSync('personal/src/sezioni/documenti/Documento.jsx', 'utf8');
  assert.match(app, /const delleMie = arricchiti\.filter\(\(d\) => d\._persona && persone\.includes\(d\._persona\)\)/);
  assert.doesNotMatch(app, /'Senza persona'/);
  assert.match(app, /<Miniatura doc=\{doc\}[^>]*grande \/>\n {6}<span className="pp-carta-testo">/);
  assert.match(app, /<BottoneCondividi doc=\{doc\} piccolo/);
  assert.match(app, /<BottoneCondividi doc=\{doc\} mostra=\{mostra\} \/>/);
});

test('agenda: eventi del giorno dentro i controlli flottanti sotto la striscia; "Vai a Studio" a sinistra della vista', () => {
  const g = readFileSync('personal/src/sezioni/agenda/AgendaGriglia.jsx', 'utf8');
  assert.match(g, /floatingFooter=\{fasciaGiorno\}/);
  assert.match(g, /<span className="personal-agenda-azioni">\{appSwitch\}<ViewPicker/);
  const css = readFileSync('personal/src/personal.css', 'utf8');
  assert.match(css, /\.agenda-mobile-floating-controls \.personal-agenda-extras \{[^}]*pointer-events: none/);
});
