// POL-VITA-006 — Conti (incassi, spese, bilancino), miniature e scansione di Personal.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  importoNumero, rigaMovimento, bilancio, perMese, periodo, spostaPeriodo, spesaDaScadenza, categoriaDaFascicolo, nuovaScadenza,
} from '../personal/src/lib/conti.js';
import { livelli, migliora } from '../personal/src/lib/scansione.js';
import { scaricaMiniature } from '../personal/src/lib/miniature.js';
import { normalizza } from '../personal/src/lib/impostazioni.js';
import { URL_CARICAMENTO } from '../personal/src/lib/archivio.js';

const codeGs = readFileSync('poliedron/archivio/Code.gs', 'utf8');
const sql = readFileSync('supabase/archivio/migrations/20261016090000_pol_vita_006_movimenti.sql', 'utf8');

// Client finto: registra le chiamate e restituisce i dati scelti per tabella.
function clientFinto(risposte = {}) {
  const chiamate = [];
  return {
    chiamate,
    from(tabella) {
      const q = { tabella, passi: [] };
      chiamate.push(q);
      const catena = new Proxy({}, { get(_t, m) {
        if (m === 'then') {
          const scrittura = q.passi.find(([p]) => ['insert', 'update', 'delete'].includes(p));
          const dati = scrittura ? { id: 'nuovo' } : (risposte[tabella] ?? []);
          return (ok) => Promise.resolve({ data: dati, error: null }).then(ok);
        }
        return (...a) => { q.passi.push([m, ...a]); return catena; };
      } });
      return catena;
    },
  };
}

test('importi all\'italiana: virgola, punto delle migliaia, simbolo dell\'euro', () => {
  assert.equal(importoNumero('12,50'), 12.5);
  assert.equal(importoNumero('1.234,56'), 1234.56);
  assert.equal(importoNumero('€ 84.30'), 84.3);
  assert.equal(importoNumero('1.000'), 1000);
  assert.ok(Number.isNaN(importoNumero('')));
  assert.ok(Number.isNaN(importoNumero('abc')));
});

test('movimento: valori puliti, tipo solo entrata o uscita, errori chiari', () => {
  assert.deepEqual(rigaMovimento({ tipo: 'entrata', importo: '4.200', data: '2026-10-14', descrizione: ' Studio ', categoria: 'Lavoro' }),
    { data: '2026-10-14', tipo: 'entrata', importo: 4200, descrizione: 'Studio', categoria: 'Lavoro', documento_id: null, note: null });
  assert.equal(rigaMovimento({ tipo: 'qualsiasi', importo: '5', data: '2026-10-14' }).tipo, 'uscita');
  assert.equal(rigaMovimento({ tipo: 'uscita', importo: '5', data: '2026-10-14' }).descrizione, 'Spesa');
  assert.throws(() => rigaMovimento({ importo: '', data: '2026-10-14' }), /Importo/);
  assert.throws(() => rigaMovimento({ importo: '-3', data: '2026-10-14' }), /Importo/);
  assert.throws(() => rigaMovimento({ importo: '3', data: '14/10' }), /Data/);
});

test('bilancino: entrate, uscite, saldo e categorie in ordine di peso', () => {
  const b = bilancio([
    { tipo: 'entrata', importo: 4200, categoria: 'Lavoro' },
    { tipo: 'uscita', importo: 84.3, categoria: 'Bollette' },
    { tipo: 'uscita', importo: 420, categoria: 'Riscaldamento' },
    { tipo: 'uscita', importo: 15.7, categoria: 'Bollette' },
    { tipo: 'uscita', importo: 10 },
  ]);
  assert.equal(b.entrate, 4200);
  assert.equal(b.uscite, 530);
  assert.equal(b.saldo, 3670);
  assert.deepEqual(b.speseCategoria.map((c) => c.categoria), ['Riscaldamento', 'Bollette', 'Altro']);
  assert.equal(b.speseCategoria[1].totale, 100);
  assert.deepEqual(bilancio([]), { entrate: 0, uscite: 0, saldo: 0, n: 0, speseCategoria: [], incassiCategoria: [] });
});

test('periodi: mese (anche febbraio bisestile), anno, spostamento a cavallo d\'anno', () => {
  assert.deepEqual(periodo('mese', '2028-02'), { da: '2028-02-01', a: '2028-02-29' });
  assert.deepEqual(periodo('anno', '2026-10'), { da: '2026-01-01', a: '2026-12-31' });
  assert.equal(spostaPeriodo('mese', '2026-01', -1), '2025-12');
  assert.equal(spostaPeriodo('mese', '2026-12', 1), '2027-01');
  assert.equal(spostaPeriodo('anno', '2026-10', 1), '2027-10');
  const mesi = perMese([{ data: '2026-03-04', tipo: 'uscita', importo: 10 }, { data: '2026-03-20', tipo: 'entrata', importo: 30 }], '2026');
  assert.equal(mesi.length, 12);
  assert.deepEqual(mesi[2], { mese: '2026-03', entrate: 30, uscite: 10 });
});

test('pagamento segnato pagato → una sola spesa collegata, con la categoria del fascicolo', async () => {
  const db = clientFinto({ movimenti: [] });
  await spesaDaScadenza(db, { id: 's1', importo: 84.3, descrizione: 'Bolletta', documento_id: 'd1', documento: { fascicolo: 'utenze' } }, '2026-10-15');
  const ins = db.chiamate.find((c) => c.passi.some(([p]) => p === 'insert'));
  assert.deepEqual(ins.passi.find(([p]) => p === 'insert')[1], {
    data: '2026-10-15', tipo: 'uscita', importo: 84.3, descrizione: 'Bolletta', categoria: 'Bollette', documento_id: 'd1', scadenza_id: 's1',
  });
  // già registrata: nessun doppione
  const gia = clientFinto({ movimenti: [{ id: 'm1' }] });
  await spesaDaScadenza(gia, { id: 's1', importo: 84.3 });
  assert.ok(!gia.chiamate.some((c) => c.passi.some(([p]) => p === 'insert')));
  // senza importo: niente spesa
  const zero = clientFinto();
  assert.equal(await spesaDaScadenza(zero, { id: 's2', importo: null }), null);
  assert.equal(zero.chiamate.length, 0);
  assert.equal(categoriaDaFascicolo('riscaldamento'), 'Riscaldamento');
  assert.equal(categoriaDaFascicolo('boh'), 'Altro');
});

test('pagamento da fare inserito a mano: scadenza senza documento', async () => {
  const db = clientFinto();
  await nuovaScadenza(db, { data: '2026-11-01', descrizione: 'Rata auto', importo: '310,00' });
  assert.deepEqual(db.chiamate[0].passi[0], ['insert', { data: '2026-11-01', descrizione: 'Rata auto', importo: 310, completata: false, categoria: null, ricorrenza: null, documento_id: null }]);
  await assert.rejects(nuovaScadenza(db, { data: '', descrizione: 'x' }), /Data/);
});

test('impostazioni: categorie dei conti predefinite e modificabili', () => {
  const base = normalizza(null);
  assert.ok(base.categorieSpesa.includes('Riscaldamento'));
  assert.ok(base.categorieIncasso.includes('Lavoro'));
  assert.deepEqual(normalizza({ categorieSpesa: ['Animali', ' Animali ', 'Casa'] }).categorieSpesa, ['Animali', 'Casa']);
});

test('migrazione movimenti: solo aggiunte, RLS del proprietario, niente accesso anonimo', () => {
  assert.doesNotMatch(sql, /\b(drop|delete\s+from|truncate\s+table|alter\s+table\s+\w+\s+drop)\b/i);
  assert.match(sql, /create table if not exists movimenti/);
  assert.match(sql, /enable row level security/);
  assert.match(sql, /using \(\(select e_proprietario\(\)\)\) with check \(\(select e_proprietario\(\)\)\)/);
  assert.match(sql, /revoke all on movimenti from anon/);
  assert.match(sql, /movimenti_scadenza_idx on movimenti \(scadenza_id\) where scadenza_id is not null/);
});

test('miniature: chieste allo script con il token, solo file in archivio e mai dei pazienti', async () => {
  let corpo;
  const r = await scaricaMiniature(['abcdefghijkl'], 'jwt', async (url, o) => { corpo = { url, ...JSON.parse(o.body), tipo: o.headers['Content-Type'] }; return { json: async () => ({ ok: true, miniature: { abcdefghijkl: 'data:image/png;base64,AA' } }) }; });
  assert.equal(r.abcdefghijkl, 'data:image/png;base64,AA');
  assert.equal(corpo.url, URL_CARICAMENTO);
  assert.equal(corpo.azione, 'miniature');
  assert.equal(corpo.token, 'jwt');
  assert.match(corpo.tipo, /^text\/plain/);
  const doPost = codeGs.slice(codeGs.indexOf('function doPost('), codeGs.indexOf('function fileDelDocumento_('));
  assert.ok(doPost.indexOf("req.azione === 'miniature'") > doPost.indexOf('PROPRIETARIO || !utente.email_confirmed_at'));
  const fn = codeGs.slice(codeGs.indexOf('function miniature_('), codeGs.indexOf('// Eliminazione anche da Drive'));
  assert.match(fn, /fascicolo=neq\.clinico_pazienti/);
  assert.match(fn, /drive_file_id=in\./);
  assert.match(fn, /\.slice\(0, MINIATURE_MAX\)/);
  assert.doesNotMatch(fn, /setTrashed|method: '(patch|delete)'|UrlFetchApp/);
  const app = readFileSync('personal/src/Miniatura.jsx', 'utf8');
  assert.match(app, /clinico_pazienti' \? null/);
});

test('scansione: la carta grigia diventa bianca, il testo nero; "originale" non tocca nulla', () => {
  const px = new Uint8ClampedArray([
    ...Array(90).fill([180, 175, 170, 255]).flat(), // carta
    ...Array(10).fill([60, 60, 60, 255]).flat(), // testo
  ]);
  const { basso, alto } = livelli(px);
  assert.ok(basso <= 62 && alto >= 170);
  const copia = new Uint8ClampedArray(px);
  migliora(copia, 'documento');
  assert.equal(copia[0], 255);
  assert.equal(copia[90 * 4], 0);
  assert.equal(copia[0], copia[1]);
  const orig = new Uint8ClampedArray(px);
  assert.deepEqual(migliora(orig, 'originale'), px);
});

test('app: Conti nel dock, + con tutte le aggiunte, pagine con chiusura in basso', () => {
  const app = readFileSync('personal/src/App.jsx', 'utf8');
  const aggiungi = readFileSync('personal/src/Aggiungi.jsx', 'utf8');
  assert.match(readFileSync('personal/src/sezioni/conti/index.jsx', 'utf8'), /id: 'conti', nome: 'Conti', Icona: IconaEuro/);
  assert.match(readFileSync('personal/src/sezioni/index.js', 'utf8'), /export const DOCK = \[oggi, documenti, agenda, foto, conti, personali\];/);
  assert.match(app, /leggiVista\(\) === 'pagamenti' \? 'conti'/);
  assert.match(readFileSync('personal/src/Pagina.jsx', 'utf8'), /className="pp-chiudi-pagina"/);
  for (const voce of ['scansiona', 'fotocamera', 'libreria', 'file', 'personale', 'spesa', 'incasso', 'pagamento', 'evento']) {
    assert.match(aggiungi, new RegExp(`\\['${voce}',`), voce);
  }
  assert.match(app, /capture="environment"/);
});

test('POL-VITA-014: Da pagare mostra solo pagamenti attuali; i fissi si ripropongono', async () => {
  const { prossimaData, RICORRENZE } = await import('../personal/src/lib/archivio.js');
  const { totaliPerCategoria, CATEGORIE_PAGAMENTO } = await import('../personal/src/lib/conti.js');
  const { readFileSync } = await import('node:fs');
  assert.equal(prossimaData('2026-01-31', 'mensile'), '2026-02-28');
  assert.equal(prossimaData('2026-11-15', 'trimestrale'), '2027-02-15');
  assert.equal(prossimaData('2026-10-17', 'annuale'), '2027-10-17');
  assert.equal(prossimaData('2026-10-17', ''), null);
  assert.deepEqual(RICORRENZE.map(([k]) => k), ['', 'mensile', 'bimestrale', 'trimestrale', 'semestrale', 'annuale']);
  assert.ok(CATEGORIE_PAGAMENTO.includes('Pulizia') && CATEGORIE_PAGAMENTO.includes('Bollo auto'));
  assert.deepEqual(totaliPerCategoria([
    { importo: 80, categoria: 'Bollette' }, { importo: 20.5, categoria: 'Bollette' }, { importo: 300, categoria: 'Assicurazioni' }, { importo: 10, documento: { fascicolo: 'utenze' } },
  ]), [{ categoria: 'Assicurazioni', totale: 300 }, { categoria: 'Bollette', totale: 110.5 }]);
  const lib = readFileSync('personal/src/lib/archivio.js', 'utf8');
  assert.match(lib, /export async function pagamenti\(db\) \{\n  return esito\(await db\.from\('scadenze'\)\.select\(CAMPI_SCADENZA\)\.eq\('storica', false\)/);
  const sql = readFileSync('supabase/archivio/migrations/20261017200000_pol_vita_014_pagamenti_attuali.sql', 'utf8');
  assert.match(sql, /add column if not exists storica boolean not null default false/);
  assert.match(sql, /update scadenze set storica = true where documento_id is not null/);
  assert.doesNotMatch(sql.split('\n').filter((r) => !r.trim().startsWith('--')).join('\n'), /delete from|drop table|drop column/i);
});
