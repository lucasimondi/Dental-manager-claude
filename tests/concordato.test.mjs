// CONCORDATO: calcoli della divisione con Anna, importi all'italiana, proposte pronte, PDF e regole del database.
// Solo dati sintetici.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { jsPDF } from '../node_modules/jspdf/dist/jspdf.node.min.js';
import {
  quota, leggiEuro, calcolaDivisione, assegnazioniProposta, beniDivisibili, fraseConguaglio, valoreCatastale, campiBene, campiScenario, eAbitazione,
} from '../personal/src/lib/concordato.js';
import { pdfBeni, pdfDivisione } from '../personal/src/lib/concordatoPdf.js';

const bene = (id, extra = {}) => ({ id, catasto: 'F', comune: 'Cuneo', foglio: '1', particella: '2', categoria: 'A/3', quota_luca: '1/2', quota_anna: '1/2', in_divisione: true, valore: 100000, ...extra });
const BENI = [
  bene('casaL', { nome: 'Casa mia', subalterno: '12', valore: 200000 }),
  bene('casaA', { nome: 'Casa Anna', subalterno: '9', categoria: 'A/7', valore: 300000 }),
  bene('negozio', { nome: 'Negozio', categoria: 'C/1', valore: 120000 }),
  bene('beinette', { nome: 'Beinette', comune: 'Beinette', categoria: 'A/2', valore: 180000 }),
  bene('garage', { nome: 'Garage', categoria: 'C/6', valore: 20000 }),
  bene('terreno', { catasto: 'T', categoria: 'Prato', valore: null }),
  bene('pradleves', { quota_luca: '1/4', quota_anna: null, in_divisione: false, valore: 80000 }),
];

test('quote e importi scritti all\'italiana', () => {
  assert.equal(quota('1/2'), 0.5); assert.equal(quota(' 7/18 '), 7 / 18); assert.equal(quota('0/0'), null); assert.equal(quota('metà'), null);
  assert.equal(leggiEuro('250.000'), 250000); assert.equal(leggiEuro('250.000,50'), 250000.5); assert.equal(leggiEuro('250000'), 250000);
  assert.equal(leggiEuro('250 mila'), 250000); assert.equal(leggiEuro('1,2 mln'), 1200000); assert.equal(leggiEuro('€ 90k'), 90000);
  assert.equal(leggiEuro(''), null); assert.ok(Number.isNaN(leggiEuro('tanti'))); assert.ok(Number.isNaN(leggiEuro('-5')));
});

test('conguaglio: metà di Luca dei beni ad Anna − metà di Anna dei beni a Luca', () => {
  const s = { assegnazioni: { casaL: 'luca', casaA: 'anna', negozio: 'anna', beinette: 'anna', garage: 'vendita' } };
  const c = calcolaDivisione(BENI, s);
  assert.equal(c.lottoLuca, 200000); assert.equal(c.lottoAnna, 600000); assert.equal(c.vendita, 20000);
  assert.equal(c.conguaglio, 300000 - 100000); // Anna paga 200.000
  assert.equal(c.entrateLuca, 200000 + 10000);
  // Ognuno riceve esattamente la sua metà.
  assert.equal(c.lottoLuca + c.conguaglio + c.venditaLuca, c.dirittoLuca);
  assert.equal(c.lottoAnna - c.conguaglio + c.venditaAnna, c.dirittoAnna);
  assert.deepEqual(c.daDecidere.map((b) => b.id), ['terreno']);
  assert.equal(c.completo, false);
  assert.equal(fraseConguaglio(c.conguaglio), `Anna ti paga ${(200000).toLocaleString('it-IT')} €`);
});

test('voci manuali, beni senza valore, beni in comune e quota di terzi', () => {
  const s = { assegnazioni: { casaL: 'luca', casaA: 'luca', negozio: 'comune', terreno: 'anna', pradleves: 'anna' },
    voci: [{ descrizione: 'Mutuo accollato', importo: 30000, a_favore: 'anna' }, { importo: -5 }, { importo: 'x' }] };
  const c = calcolaDivisione(BENI, s);
  assert.equal(c.conguaglio, -(100000 + 150000) - 30000); // Luca paga
  assert.equal(c.pagaLuca, 280000); assert.equal(c.entrateLuca, 0);
  assert.deepEqual(c.mancanti.map((b) => b.id), ['terreno']);
  assert.ok(!c.righe.some((r) => r.bene.id === 'pradleves'), 'beni non in comune con Anna restano fuori');
  assert.match(fraseConguaglio(c.conguaglio), /^Paghi tu ad Anna/);
  assert.match(fraseConguaglio(0.4), /Nessun conguaglio/);
});

test('proposte pronte A, B, C e libera', () => {
  const opz = { casaLuca: 'casaL', casaAnna: 'casaA' };
  const a = assegnazioniProposta('equa', BENI, opz);
  assert.deepEqual(a, { casaL: 'luca', casaA: 'anna', negozio: 'anna', beinette: 'anna', garage: 'vendita', terreno: 'vendita' });
  const b = assegnazioniProposta('massimo', BENI, opz);
  assert.equal(Object.values(b).filter((x) => x === 'luca').length, 1);
  assert.equal(b.garage, 'anna');
  const c = assegnazioniProposta('leggero', BENI, opz);
  assert.equal(c.garage, 'luca'); assert.equal(c.negozio, 'anna');
  assert.deepEqual(assegnazioniProposta('vuota', BENI), {});
  assert.throws(() => assegnazioniProposta('equa', BENI, { casaLuca: 'casaL', casaAnna: 'casaL' }), /Scegli la tua casa/);
  // Il valore della metà di Luca non cambia; cambia quanto arriva subito in denaro: B > A > C.
  const conti = (ass) => calcolaDivisione(BENI.map((x) => ({ ...x, valore: x.valore ?? 10000 })), { assegnazioni: ass });
  assert.ok(conti(b).conguaglio > conti(a).conguaglio && conti(a).conguaglio > conti(c).conguaglio);
  assert.equal(conti(b).entrateLuca, conti(a).entrateLuca); // vendere al valore o farsi pagare da Anna dà la stessa cifra
  for (const ass of [a, b, c]) assert.equal(conti(ass).dirittoLuca, conti(a).dirittoLuca);
  assert.deepEqual(beniDivisibili(BENI).filter(eAbitazione).map((x) => x.id), ['casaL', 'casaA', 'beinette']);
});

test('valore catastale di riferimento e controlli sui campi', () => {
  assert.equal(valoreCatastale({ catasto: 'F', categoria: 'A/3', rendita: 367.98 }), Math.round(367.98 * 1.05 * 160));
  assert.equal(valoreCatastale({ catasto: 'F', categoria: 'C/1', rendita: 1055.38 }), Math.round(1055.38 * 1.05 * 55));
  assert.equal(valoreCatastale({ catasto: 'T', reddito_dominicale: 55.45 }), Math.round(55.45 * 1.25 * 135));
  assert.equal(valoreCatastale({ catasto: 'F', categoria: 'F/1', rendita: null }), null);
  assert.throws(() => campiBene({ quota_luca: 'metà' }), /quota/);
  assert.throws(() => campiBene({ in_divisione: true, quota_anna: '' }), /quota di Anna/);
  assert.throws(() => campiBene({ valore: -1 }), /Valore/);
  assert.equal(campiBene({ nome: '  Casa  ', valore: null }).nome, 'Casa');
  const s = campiScenario({ nome: ' A ', assegnazioni: { x: 'luca', y: 'boh' }, voci: [{ importo: '10', a_favore: 'altro' }] });
  assert.deepEqual(s.assegnazioni, { x: 'luca' }); assert.equal(s.voci[0].a_favore, 'luca'); assert.equal(s.voci[0].importo, 10);
  assert.throws(() => campiScenario({ nome: ' ' }), /nome/);
});

test('i PDF si generano: elenco dei beni con le quote e proposta di divisione', () => {
  const elenco = pdfBeni(jsPDF, BENI, { data: new Date('2026-11-20T10:00:00') });
  assert.ok(elenco.getNumberOfPages() >= 3);
  assert.match(elenco.output(), /\/Title \(Situazione degli immobili di Luca Simondi\)/);
  const div = pdfDivisione(jsPDF, BENI, { nome: 'Proposta A', assegnazioni: assegnazioniProposta('equa', BENI, { casaLuca: 'casaL', casaAnna: 'casaA' }), voci: [] });
  assert.equal(div.getNumberOfPages(), 1);
  assert.match(div.output(), /\/Title /);
});

test('database: tabelle solo del proprietario, niente accesso anonimo, i beni non si cancellano', () => {
  const sql = readFileSync('supabase/archivio/migrations/20261120100000_concordato.sql', 'utf8');
  for (const t of ['concordato_beni', 'divisione_scenari']) {
    assert.match(sql, new RegExp(`create table if not exists ${t}`));
    assert.match(sql, new RegExp(`alter table ${t} enable row level security`));
    assert.match(sql, new RegExp(`create policy proprietario on ${t} for all to authenticated\\s+using \\(\\(select e_proprietario\\(\\)\\)\\) with check \\(\\(select e_proprietario\\(\\)\\)\\)`));
  }
  assert.match(sql, /revoke all on concordato_beni, divisione_scenari from anon/);
  assert.match(sql, /revoke delete on concordato_beni from authenticated/);
  assert.doesNotMatch(sql, /drop |truncate |delete from/i);
});

test('la sezione è registrata e raggiungibile da Pratiche e dalla ricerca di Personale', () => {
  const indice = readFileSync('personal/src/sezioni/index.js', 'utf8');
  assert.match(indice, /import \{ concordato \} from '\.\/concordato\/index\.jsx'/);
  assert.match(indice, /SEZIONI = \[[^\]]*concordato/); assert.match(indice, /VISTE = \[[^\]]*concordato/);
  assert.match(readFileSync('personal/src/sezioni/legal/Legal.jsx', 'utf8'), /vai\('concordato'\)/);
  assert.match(readFileSync('personal/src/sezioni/altro/index.jsx', 'utf8'), /\['concordato', 'Concordato'/);
});

test('situazione ipocatastale: formalità per bene, stato dei gravami, PDF per Anna senza altri debiti', async () => {
  const { formalitaDi, statoGravami, intestatariTesto, riferimentoFormalita } = await import('../personal/src/lib/concordato.js');
  const { pdfBeniComuni } = await import('../personal/src/lib/concordatoPdf.js');
  const F = [
    { id: 'f1', verso: 'contro', natura: 'pignoramento', tipo: 'trascrizione', data: '2025-02-25', reg_particolare: '1402', reg_generale: '1692', beni: [{ id: 'casaL', certezza: 'certo' }] },
    { id: 'f2', verso: 'contro', natura: 'ipoteca_giudiziale', tipo: 'iscrizione', data: '2024-10-17', reg_particolare: '980', beni: [{ id: 'casaL', certezza: 'probabile' }, { id: 'beinette', certezza: 'certo' }] },
    { id: 'f3', verso: 'favore', natura: 'successione', tipo: 'trascrizione', data: '2024-04-08', reg_particolare: '2748', beni: [{ id: 'casaL', certezza: 'certo' }] },
    { id: 'f4', verso: 'contro', natura: 'convenzione', tipo: 'trascrizione', data: '2014-06-20', reg_particolare: '4181', beni: [{ id: 'garage', certezza: 'da_verificare' }] },
  ];
  assert.deepEqual(formalitaDi('casaL', F).map((f) => [f.id, f.certezza]), [['f1', 'certo'], ['f2', 'probabile'], ['f3', 'certo']]);
  assert.deepEqual(formalitaDi('casaL', F, { soloGravami: true }).map((f) => f.id), ['f1', 'f2']);
  assert.deepEqual(statoGravami('casaL', F), { pignorato: 'certo', ipoteca: 'probabile', divisione: false, n: 2, certi: 1 });
  assert.equal(statoGravami('beinette', F).ipoteca, 'certo');
  assert.equal(statoGravami('garage', F).n, 0, 'la convenzione edilizia non è un gravame');
  assert.equal(intestatariTesto({ intestatari: [{ nome: 'Comune', quota: 'area', diritto: "Proprietà per l'area" }, { nome: 'Anna', quota: '1/2', diritto: 'Proprietà' }] }), "Comune area (proprietà per l'area); Anna 1/2");
  assert.equal(riferimentoFormalita(F[0]), `Trascr. ${new Date('2025-02-25T12:00:00').toLocaleDateString('it-IT')} RP 1402 RG 1692`);
  const doc = pdfBeniComuni(jsPDF, BENI, F, { data: new Date('2026-11-20T10:00:00') });
  assert.ok(doc.getNumberOfPages() >= 2);
  assert.match(doc.output(), /\/Title \(Beni in comune tra Luca e Anna Simondi\)/);
  // Il documento per Anna non parla di concordato.
  assert.doesNotMatch(readFileSync('personal/src/lib/concordatoPdf.js', 'utf8').split('export function pdfBeniComuni')[1].split('export function pdfDivisione')[0], /concordato|creditori del|sovraindebit/i);
});

test('database: formalità solo del proprietario, senza cancellazioni', () => {
  const sql = readFileSync('supabase/archivio/migrations/20261120120000_concordato_ipocatastale.sql', 'utf8');
  assert.match(sql, /create table if not exists concordato_formalita/);
  assert.match(sql, /alter table concordato_formalita enable row level security/);
  assert.match(sql, /create policy proprietario on concordato_formalita for all to authenticated\s+using \(\(select e_proprietario\(\)\)\) with check \(\(select e_proprietario\(\)\)\)/);
  assert.match(sql, /revoke all on concordato_formalita from anon/);
  assert.match(sql, /revoke delete on concordato_formalita from authenticated/);
  assert.match(sql, /add column if not exists intestatari jsonb/);
  assert.doesNotMatch(sql, /drop |truncate |delete from/i);
});
