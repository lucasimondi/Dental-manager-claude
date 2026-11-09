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

// Variante B (PO 2026-11-09): Settimana su telefono con etichette brevi e sovrapposti raggruppati.
const breve = new Function(`${src.slice(src.indexOf('const PARTICELLE'), src.indexOf('export function tipoBreve'))}; return etichettaBreve;`.replaceAll('export function', 'function'))();
const tipo = new Function(`${estrai('tipoBreve')}; return tipoBreve;`)();

test('etichetta breve: Cognome I., cognomi lunghi accorciati senza perdere le particelle', () => {
  assert.equal(breve('Bianchi', 'Luca'), 'Bianchi L.');
  assert.equal(breve('Bergamaschi Rossetti', 'Maria Antonietta'), 'Bergamaschi M.');
  assert.equal(breve('Lombardi De Santis', 'Francesca'), 'Lombardi F.');
  assert.equal(breve('De Santis Lombardi', 'Anna'), 'De Santis A.');
  assert.equal(breve('', 'Mario'), 'M.');
  assert.equal(tipo('Controllo post-operatorio'), 'Controllo');
  assert.equal(tipo(''), '');
});

test('sovrapposti: solo gruppi di soli appuntamenti diventano un blocco unico', async () => {
  const { layoutAgendaDay, raggruppaSovrapposti } = await import('../shared/agenda/geometry.js');
  const apps = [{ id: 1, ora: '09:00', durata: 60 }, { id: 2, ora: '09:30', durata: 60 }, { id: 3, ora: '12:00', durata: 30 }];
  const { gruppi, singoli } = raggruppaSovrapposti(layoutAgendaDay(apps, []));
  assert.equal(gruppi.length, 1);
  assert.deepEqual(gruppi[0].items.map(x => x.a.id), [1, 2]);
  assert.equal(gruppi[0].start, 540); assert.equal(gruppi[0].end, 630);
  assert.deepEqual(singoli.map(x => x.a.id), [3]);
  const misto = raggruppaSovrapposti(layoutAgendaDay(apps.slice(0, 1), [{ id: 9, ora_inizio: '09:15', ora_fine: '10:00' }]));
  assert.equal(misto.gruppi.length, 0, 'con un impegno in mezzo restano affiancati');
});

test('Studio raggruppa solo su telefono in Settimana e non durante la selezione WhatsApp; Personal in Settimana', () => {
  const studio = readFileSync(new URL('../src/components/Agenda.jsx', import.meta.url), 'utf8');
  assert.match(studio, /const compatto = isMobile && isSettimana;/);
  assert.match(studio, /compatto && !selModeWA \? raggruppaSovrapposti\(packed\)\.gruppi : \[\]/);
  const personal = readFileSync(new URL('../personal/src/sezioni/agenda/AgendaGriglia.jsx', import.meta.url), 'utf8');
  assert.match(personal, /weekly \? raggruppaSovrapposti\(packed\)\.gruppi : \[\]/);
});
