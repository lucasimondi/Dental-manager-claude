// PO 2026-11-09: in Settimana titoli di impegni e appuntamenti vanno a capo dentro il blocco,
// con tante righe quante ne entrano nell'altezza; la vista Giorno resta su una riga.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const src = readFileSync(new URL('../shared/agenda/AgendaPresentation.jsx', import.meta.url), 'utf8');
const estrai = nome => { const i = src.indexOf(`export function ${nome}`); return src.slice(i, src.indexOf('\n}\n', i) + 2).replace('export function', 'function'); };
const impagina = new Function(`${estrai('impaginaBlocco')}; return impaginaBlocco;`)();
const righe = new Function(`${estrai('righeDisponibili')}; return righeDisponibili;`)();

test('righe adattive: due ore mostrano più righe, quindici minuti una sola', () => {
  assert.equal(righe(10, 15, 12), 1);
  assert.equal(righe(100, 15, 12), 7);
  const lungo = impagina(104, 1, 11, 12);
  assert.equal(lungo.inLinea, false);
  assert.equal(lungo.righe, 7);
  const breve = impagina(11, 2, 11, 12);
  assert.equal(breve.inLinea, true);
  assert.equal(breve.righe, 1);
});

test('blocchi bassi: le righe stanno sempre dentro l\'altezza del blocco', () => {
  for (let h = 6; h <= 200; h++) for (const riserva of [1, 2, 9]) {
    const l = impagina(h, riserva, 12, 12);
    const usato = l.inLinea ? l.rigaTesto : l.sopra + l.rigaOrario + l.righe * l.rigaTesto + riserva;
    if (h >= riserva + 9) assert.ok(usato <= h, `h=${h} riserva=${riserva}`);
  }
});

test('in settimana testo a capo con line-clamp; la vista Giorno resta invariata', () => {
  assert.match(src, /whiteSpace: 'normal', overflowWrap: 'anywhere', wordBreak: 'break-word', display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: righe/);
  assert.match(src, /height > 18 && <div style=\{\{ fontSize: dense \? 9 : 10\.5, lineHeight: '12px', fontWeight: 600, color: ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' \}\}>/);
});
