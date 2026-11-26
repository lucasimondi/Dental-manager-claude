// RUBRICA (PO 2026-11-26): contatti dei professionisti per categoria, ricerca per problema, promemoria che si ripetono.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  campiContatto, campiPromemoria, categoria, categorieUsate, cerca, dataSuggerita, dopoFatto, iniziali, perCategoria, piuMesi, prossimaData,
  statoPromemoria, ordinaPromemoria, vcard, vcardTutti, nomeVcf, telefonoChiamabile, testoDaCopiare, whatsapp, mappa, sitoWeb, totaleInterventi,
} from '../personal/src/lib/rubrica.js';
import { appCosaDaIndirizzo, indirizzoAppCosa } from '../personal/src/lib/appCose.js';

const OGGI = new Date('2026-11-26T10:00:00');
const C = [
  { id: 'a', nome: 'Idraulica Esempio', categorie: ['Idraulico'], note: 'Ha rifatto lo scarico', telefono: '+39 000 000 0001' },
  { id: 'b', nome: 'Stufe Esempio', categorie: ['Stufa e caldaia'], note: 'Pulizia annuale', preferito: true },
  { id: 'c', nome: 'Gomme Esempio', categorie: ['Gommista', 'Meccanico e officina'] },
  { id: 'd', nome: 'Pareti Esempio', categorie: ['cartongessista'] },
  { id: 'e', nome: 'Senza categoria' },
  { id: 'f', nome: 'Vetri Esempio', categorie: ['Vetraio'] },
];

test('categorie: standard riconosciute anche scritte male, nuove accettate', () => {
  assert.equal(categoria('cartongessista').nome, 'Cartongessista');
  assert.equal(categoria(' STUFA e caldaia ').id, 'stufa');
  const v = categoria('Vetraio');
  assert.equal(v.nome, 'Vetraio'); assert.equal(v.colore, 'grigio');
  assert.deepEqual(categorieUsate(C).map((x) => [x.nome, x.n]), [['Idraulico', 1], ['Stufa e caldaia', 1], ['Cartongessista', 1], ['Gommista', 1], ['Meccanico e officina', 1], ['Vetraio', 1]]);
  assert.deepEqual(campiContatto({ categorie: ['idraulico', 'Idraulico', 'Vetraio'] }).categorie, ['Idraulico', 'Vetraio']);
});

test('ricerca per problema: «perdita lavandino» trova l’idraulico, «gomme» il gommista, «pellet» la stufa', () => {
  assert.deepEqual(cerca(C, 'perdita lavandino').map((c) => c.id), ['a']);
  assert.deepEqual(cerca(C, 'gomme').map((c) => c.id), ['c']);
  assert.deepEqual(cerca(C, 'pellet').map((c) => c.id), ['b']);
  assert.deepEqual(cerca(C, 'controsoffitto').map((c) => c.id), ['d']);
  assert.deepEqual(cerca(C, 'scarico').map((c) => c.id), ['a'], 'anche dalle note');
  assert.equal(cerca(C, '').length, C.length);
  assert.deepEqual(cerca(C, '', 'Meccanico e officina').map((c) => c.id), ['c']);
  assert.deepEqual(cerca(C, '', 'Altro').map((c) => c.id), ['e']);
});

test('elenco per categoria: un contatto con due categorie sta in tutte e due, preferiti per primi', () => {
  const g = perCategoria(C);
  assert.deepEqual(g.map((x) => x.nome), ['Idraulico', 'Stufa e caldaia', 'Cartongessista', 'Gommista', 'Meccanico e officina', 'Altro', 'Vetraio']);
  assert.ok(g.find((x) => x.nome === 'Gommista').contatti.some((c) => c.id === 'c'));
  assert.ok(g.find((x) => x.nome === 'Meccanico e officina').contatti.some((c) => c.id === 'c'));
});

test('promemoria: ripetizione, stato con i giorni di avviso, «Fatto»', () => {
  assert.equal(piuMesi('2026-01-31', 1), '2026-02-28');
  assert.equal(piuMesi('2026-11-15', 12), '2027-11-15');
  assert.equal(prossimaData('2026-11-15', '1a', OGGI), '2027-11-15');
  assert.equal(prossimaData('2024-04-15', '1a', OGGI), '2027-04-15', 'salta gli anni passati');
  assert.equal(prossimaData('2026-11-30', '6m', OGGI), '2027-05-30');
  assert.equal(prossimaData('2026-11-30', 'mai', OGGI), null);
  assert.deepEqual(statoPromemoria({ data: '2026-11-30', avviso_giorni: 30 }, OGGI), { giorni: 4, stato: 'presto', quando: 'tra 4 giorni' });
  assert.equal(statoPromemoria({ data: '2026-11-30', avviso_giorni: 1 }, OGGI).stato, 'ok');
  assert.equal(statoPromemoria({ data: '2026-11-20', avviso_giorni: 7 }, OGGI).stato, 'scaduta');
  assert.deepEqual(ordinaPromemoria([{ id: 1, data: '2027-09-15' }, { id: 2, data: '2026-11-30' }], OGGI).map((p) => p.id), [2, 1]);
  assert.deepEqual(dopoFatto({ data: '2026-11-30', ripeti: '1a' }, OGGI), { data: '2027-11-30', ultimo_fatto: '2026-11-26' });
  const una = dopoFatto({ data: '2026-11-30', ripeti: 'mai' }, OGGI);
  assert.equal(una.ultimo_fatto, '2026-11-26'); assert.ok(una.archiviato_il, 'una volta sola: si archivia, non si cancella');
  assert.equal(dataSuggerita('11-15', OGGI), '2027-11-15');
  assert.equal(dataSuggerita('12-01', OGGI), '2026-12-01');
});

test('salvataggio: campi puliti, promemoria validi', () => {
  assert.throws(() => campiContatto({ nome: '  ' }), /nome/);
  const c = campiContatto({ nome: ' Idraulica   Rossi ', telefono: ' ', voto: 7, preferito: 1, interventi: [{ data: '14/10/2025', voce: 'Pulizia', importo: '120' }, { data: '', voce: '' }] });
  assert.deepEqual(c, { nome: 'Idraulica Rossi', telefono: null, voto: null, preferito: true, interventi: [{ data: '2025-10-14', voce: 'Pulizia', importo: '120' }] });
  assert.throws(() => campiPromemoria({ cosa: 'Gomme', data: 'domani' }), /data/);
  assert.deepEqual(campiPromemoria({ cosa: ' Cambio  gomme ', data: '15/11/2027', ripeti: 'boh', avviso_giorni: 900, contatto_id: '' }),
    { cosa: 'Cambio gomme', data: '2027-11-15', ripeti: 'mai', avviso_giorni: 365, contatto_id: null });
  assert.equal(totaleInterventi([{ importo: '120' }, { importo: '10,50' }, { importo: 'gratis' }]), 130.5);
});

test('contatti: chiamare, WhatsApp, mappa, testo da copiare', () => {
  assert.equal(telefonoChiamabile('+39 333 12.34-567'), '+393331234567');
  assert.equal(whatsapp('333 1234567'), 'https://wa.me/393331234567');
  assert.equal(whatsapp(''), null);
  assert.match(mappa('Via Esempio 1, Torino'), /maps\/search\/\?api=1&query=Via%20Esempio%201%2C%20Torino/);
  assert.equal(sitoWeb('esempio.it'), 'https://esempio.it');
  assert.equal(iniziali('Calore Service srl'), 'CS');
  assert.equal(testoDaCopiare({ nome: 'X', categorie: ['Idraulico'], telefono: '1' }), 'X\nIdraulico\nTel. 1');
});

test('app a sé /rubrica/ e migrazione: del proprietario, solo aggiunte, mai cancellazioni', () => {
  assert.equal(appCosaDaIndirizzo('/poliedron/rubrica/'), 'rubrica');
  assert.equal(appCosaDaIndirizzo('/rubrica'), 'rubrica');
  assert.equal(indirizzoAppCosa('rubrica', { hostname: 'personal.poliedrasoft.it' }), '/rubrica/');
  const sql = readFileSync('supabase/archivio/migrations/20261126100000_rubrica.sql', 'utf8');
  for (const t of ['rubrica', 'rubrica_promemoria']) {
    assert.match(sql, new RegExp(`create table if not exists ${t} \\(`));
    assert.match(sql, new RegExp(`alter table ${t} enable row level security`));
    assert.match(sql, new RegExp(`create policy proprietario on ${t} for all to authenticated\\s+using \\(\\(select e_proprietario\\(\\)\\)\\) with check \\(\\(select e_proprietario\\(\\)\\)\\)`));
  }
  assert.match(sql, /revoke all on rubrica, rubrica_promemoria from anon/);
  assert.match(sql, /on delete set null/);
  assert.doesNotMatch(sql, /drop table|delete from|truncate rubrica/i);
  // PO 2026-11-26: contatti e promemoria si possono eliminare, solo dall'app e dopo una conferma.
  const lib = readFileSync('personal/src/lib/rubrica.js', 'utf8'), vista = readFileSync('personal/src/rubrica/AppRubrica.jsx', 'utf8');
  assert.equal((lib.match(/\.delete\(\)/g) || []).length, 3, 'solo eliminaContatto (con i suoi promemoria) ed eliminaPromemoria');
  assert.doesNotMatch(vista, /\.delete\(/, 'la vista passa dalle funzioni della libreria');
  assert.match(vista, /Eliminare definitivamente «\{c\.nome\}»\? Non si può annullare\./);
  assert.match(vista, /Eliminare «\{p\.cosa\}»\?/);
});

test('vCard per la rubrica del telefono e Google Contatti', () => {
  const v = vcard({ id: 'r1', nome: 'Idraulica; Rossi, Cuneo', categorie: ['Idraulico'], referente: 'Mario', telefono: '+39 333 123 4567', telefono2: '0171 000000',
    email: 'info@esempio.it', indirizzo: 'Via Esempio 1, Cuneo', sito: 'esempio.it', note: 'Riga uno\nRiga due' });
  const righe = v.split('\r\n');
  assert.equal(righe[0], 'BEGIN:VCARD'); assert.equal(righe[1], 'VERSION:3.0'); assert.equal(righe.at(-1), 'END:VCARD');
  assert.ok(righe.includes('UID:poliedron-rubrica-r1'));
  assert.ok(righe.includes('FN:Idraulica\\; Rossi\\, Cuneo'), 'virgole e punti e virgola protetti');
  assert.ok(righe.includes('TEL;TYPE=CELL:+393331234567'));
  assert.ok(righe.includes('TEL;TYPE=WORK:0171000000'));
  assert.ok(righe.includes('URL:https://esempio.it'));
  assert.ok(righe.includes('CATEGORIES:Rubrica Poliedron,Idraulico'));
  assert.match(v, /NOTE:Categoria: Idraulico\\nReferente: Mario\\nRiga uno\\nRiga due/);
  assert.ok(righe.every((r) => r.length <= 75), 'righe piegate a 75 caratteri');
  const lungo = vcard({ id: 'x', nome: 'X', note: 'a'.repeat(300) });
  assert.equal(lungo.replace(/\r\n /g, '').match(/NOTE:(a+)/)[1].length, 300, 'la piegatura non perde caratteri');
  assert.equal(vcardTutti([{ id: 'a', nome: 'A' }, { id: 'b', nome: 'B' }]).match(/BEGIN:VCARD/g).length, 2);
  assert.equal(nomeVcf([{ nome: 'Gomme Èsempio srl' }]), 'gomme-esempio-srl.vcf');
  assert.equal(nomeVcf([{}, {}], new Date('2026-11-26T10:00:00Z')), 'rubrica-poliedron-2026-11-26.vcf');
});
