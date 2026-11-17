// COMPILA-CAMPI e APRI-CON — PO 2026-11-17: "Il gestore PDF deve anche poter completare i campi, in modo
// automatico dove si può e se servono dati io li compilo e poi vengono trasferiti nel campo giusto";
// "quando si clicca su un documento […] apri in gestore PDF (quello di poliedron) e poi apri in drive o altri".
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { chiaveCampo, normalizzaNome, proposte, valorePer, profiloDaIdentita, daRicordare, oggiIt } from '../personal/src/pdf/compila.js';
import { destinatariRisposta } from '../personal/src/lib/archivio.js';

const oggi = new Date(2026, 10, 17);

test('nomi dei campi: riconosce i dati più comuni, anche da nomi tecnici o descrizioni', () => {
  assert.equal(normalizzaNome('txtCodFiscale_1'), 'cod fiscale');
  const casi = {
    'Codice Fiscale': 'codice_fiscale', 'CF': 'codice_fiscale', 'txtCodFiscale_1': 'codice_fiscale',
    'Nato/a a': 'luogo_nascita', 'nata il': 'data_nascita', 'Data di nascita': 'data_nascita',
    'Il/La sottoscritto/a': 'nominativo', 'Nome e cognome': 'nominativo', 'Cognome': 'cognome', 'Nome': 'nome', 'first_name': 'nome',
    'Residente a': 'comune', 'Comune': 'comune', 'Via': 'indirizzo', 'Indirizzo di residenza': 'indirizzo', 'CAP': 'cap', 'Prov.': 'provincia',
    'Telefono': 'telefono', 'E-mail': 'email', 'PEC': 'pec', 'IBAN': 'iban', 'Data': 'data', 'Luogo e data': 'luogo_data', 'Luogo': 'luogo',
    'Firma': 'firma', 'Firma del dichiarante': 'firma', 'Campo17': null, '': null,
  };
  for (const [nome, k] of Object.entries(casi)) assert.equal(chiaveCampo(nome), k, nome);
  assert.equal(chiaveCampo('Text1', 'Codice fiscale del richiedente'), 'codice_fiscale', 'basta la descrizione');
});

test('valori: dai dati ricordati e dall\'identità, data di oggi, nome completo, luogo e data', () => {
  const p = { nome: 'Mario', cognome: 'Prova', comune: 'Torino', data_nascita: '1980-02-03', codice_fiscale: 'PRVMRA80B03L219X' };
  assert.equal(valorePer('nominativo', p), 'Mario Prova');
  assert.equal(valorePer('data', p, oggi), '17/11/2026');
  assert.equal(valorePer('luogo_data', p, oggi), 'Torino, 17/11/2026');
  assert.equal(valorePer('data_nascita', p), '03/02/1980');
  assert.equal(valorePer('iban', p), '');
  assert.equal(oggiIt(oggi), '17/11/2026');
  assert.deepEqual(profiloDaIdentita({ Nome: 'Mario', Cognome: 'Prova', 'Codice fiscale': 'PRV', 'Data di nascita': '1980-02-03', 'Luogo di nascita': 'Roma', foto: { x: 1 } }),
    { nome: 'Mario', cognome: 'Prova', codice_fiscale: 'PRV', data_nascita: '1980-02-03', luogo_nascita: 'Roma' });
});

test('proposte: solo campi di testo, niente firme, ripetuti uniti, già compilati rispettati, mancanti vuoti', () => {
  const campi = [
    { id: '1R', nome: 'cf', tipo: 'testo' },
    { id: '2R', nome: 'cf', tipo: 'testo' },                           // stesso campo su un'altra pagina
    { id: '3R', nome: 'firma', tipo: 'testo' },
    { id: '4R', nome: 'Data', tipo: 'testo' },
    { id: '5R', nome: 'iban', tipo: 'testo' },
    { id: '6R', nome: 'Telefono', tipo: 'testo', valore: '333' },
    { id: '7R', nome: 'Note', tipo: 'testo', solaLettura: true },
    { id: '8R', nome: 'Spunta', tipo: 'casella' },
  ];
  const r = proposte(campi, { codice_fiscale: 'PRV' }, oggi);
  assert.deepEqual(r.map((x) => [x.chiave, x.ids.join('+'), x.valore, x.automatico]), [
    ['codice_fiscale', '1R+2R', 'PRV', true], ['data', '4R', '17/11/2026', true], ['iban', '5R', '', false], ['telefono', '6R', '333', false],
  ]);
  assert.equal(r.find((x) => x.chiave === 'iban').etichetta, 'IBAN');
});

test('dati da ricordare: solo quelli del profilo; dal nome completo si ricavano nome e cognome', () => {
  assert.deepEqual(daRicordare([{ chiave: 'iban', valore: ' IT60X ' }, { chiave: 'data', valore: '17/11/2026' }, { chiave: null, valore: 'x' }, { chiave: 'nominativo', valore: 'Mario Luigi Prova' }]),
    { iban: 'IT60X', nome: 'Mario Luigi', cognome: 'Prova' });
});

test('Gestore PDF: strumento «Compila», valori nei campi del modulo; dati ricordati solo sul telefono', () => {
  const gestore = readFileSync('personal/src/pdf/GestorePdf.jsx', 'utf8');
  const foglio = readFileSync('personal/src/pdf/CompilaCampi.jsx', 'utf8');
  assert.match(gestore, />Compila<\/button>/);
  assert.match(gestore, /else if \(strumento === 'compila'\) setCompila\(true\);/);
  assert.match(gestore, /rt\.doc\.annotationStorage\.setValue\(id, \{ value: r\.valore \}\);/);
  assert.match(gestore, /querySelectorAll\(`\[data-element-id="\$\{id\}"\]`\)/);
  assert.match(foglio, /a\.subtype !== 'Widget' \|\| a\.fieldType !== 'Tx'/);
  assert.match(foglio, /localStorage\.setItem\(CHIAVE_PROFILO/);
  assert.match(foglio, /Questo PDF non ha campi compilabili/);
});

test('scheda del documento: si apre con la scelta Gestore PDF · Drive · altre app; Compila fra gli strumenti', () => {
  const doc = readFileSync('personal/src/sezioni/documenti/Documento.jsx', 'utf8');
  const apri = readFileSync('personal/src/sezioni/documenti/ApriCon.jsx', 'utf8');
  assert.match(doc, /const \[intero, setIntero\] = useState\(false\);/);
  assert.match(doc, /<ApriCon doc=\{doc\} pdf=\{ePdf\(doc\)\} onApri=\{\(\) => setIntero\(true\)\}/);
  assert.match(apri, /'Apri nel Gestore PDF'/);
  assert.match(apri, /Apri in Drive/);
  assert.match(apri, /Apri con altre app…/);
  assert.match(apri, /scaricaDocumento\(file\)/, 'senza condivisione di file: si scarica');
});

test('app: persone della risposta dallo script; senza origine nessuna chiamata', async () => {
  const inviati = [];
  const f = async (_u, o) => { inviati.push(JSON.parse(o.body)); return { json: async () => ({ ok: true, persone: [{ email: 'a@b.it', ruolo: 'mittente' }] }) }; };
  assert.deepEqual(await destinatariRisposta({ token: 't', origine: 'o1' }, f), [{ email: 'a@b.it', ruolo: 'mittente' }]);
  assert.deepEqual(inviati[0], { token: 't', azione: 'destinatari_risposta', origine: 'o1' });
  assert.deepEqual(await destinatariRisposta({ token: 't', origine: null }, f), []);
  assert.equal(inviati.length, 1);
  const salva = readFileSync('personal/src/pdf/SalvaArchivio.jsx', 'utf8');
  assert.match(salva, /persone\.map\(\(p\) => \(\{ \.\.\.p, scelto: true \}\)\)/, 'tutti spuntati all\'inizio');
  assert.match(salva, /<legend>A chi rispondere<\/legend>/);
});
