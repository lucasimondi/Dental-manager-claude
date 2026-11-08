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

test('app: Personal keeps household filtering, original previews and file sharing', () => {
  const wallet=readFileSync('personal/src/sezioni/personali/Personali.jsx','utf8');
  const detail=readFileSync('personal/src/sezioni/documenti/Documento.jsx','utf8');
  const viewer=readFileSync('personal/src/sezioni/documenti/DocumentoIntero.jsx','utf8');
  assert.match(wallet,/persone.includes\(d\._persona\)/);
  assert.match(wallet,/documentoDaPersonal/);
  assert.match(wallet,/<Miniatura/);
  assert.match(wallet,/files:files.fs/);
  assert.doesNotMatch(wallet,/'Senza persona'/);
  assert.match(detail,/<DocumentoIntero/);
  assert.match(viewer,/<BottoneCondividi/);
});

test('agenda: eventi del giorno dentro i controlli flottanti sotto la striscia; ricerca in cima, niente "Vai a Studio" (Studio è nel dock)', () => {
  const g = readFileSync('personal/src/sezioni/agenda/AgendaGriglia.jsx', 'utf8');
  assert.match(g, /floatingFooter=\{fasciaGiorno\}/);
  // HOME-AGENDA-CENTRIC (PO 2026-11-07): ricerca in cima all'agenda, Studio nel dock.
  assert.match(g, /<span className="personal-agenda-azioni"><ViewPicker/);
  assert.doesNotMatch(g, /<AgendaSwitch/);
  assert.match(g, /searchBar=\{ricerca\}/);
  // APP-UNICA (PO 2026-11-08): niente più tasto Studio nel dock; lo studio è in Altro → Lavoro.
  assert.doesNotMatch(readFileSync('personal/src/App.jsx', 'utf8'), /aria-label="Apri Studio"/);
  const css = readFileSync('personal/src/personal.css', 'utf8');
  assert.match(css, /\.agenda-mobile-floating-controls \.personal-agenda-extras \{[^}]*pointer-events: none/);
});
