// POL-VITA-022: incassi di studio o di collaborazione registrati solo nello studio; Personal legge il lavoro netto.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { rigaIncassoStudio, tabellaStudio, rigaMovimento, CATEGORIE_INCASSO, lavoroDelPeriodo, movimentiLavoro, mesiTra, bilancio } from '../personal/src/lib/conti.js';

test('Studio → payments, Collaborazione → pagamenti_esterni, il resto no', () => {
  assert.equal(tabellaStudio('Studio'), 'payments');
  assert.equal(tabellaStudio('Collaborazione'), 'pagamenti_esterni');
  assert.equal(tabellaStudio('Lavoro'), null);
  assert.ok(CATEGORIE_INCASSO.includes('Studio') && CATEGORIE_INCASSO.includes('Collaborazione'));
});

test('pagamento di un paziente con le colonne dello studio', () => {
  assert.deepEqual(rigaIncassoStudio({ tipo: 'entrata', categoria: 'Studio', importo: '1.200,50', data: '2026-10-18', paziente_id: '42', metodo: 'POS', note: ' acconto ' }),
    { tabella: 'payments', riga: { paziente_id: 42, data: '2026-10-18', importo: 1200.5, metodo: 'POS', nota: 'acconto', stato: 'pagato' } });
  assert.throws(() => rigaIncassoStudio({ tipo: 'entrata', categoria: 'Studio', importo: '10', data: '2026-10-18' }), /paziente/);
});

test('incasso da collaborazione con le colonne dello studio', () => {
  assert.deepEqual(rigaIncassoStudio({ tipo: 'entrata', categoria: 'Collaborazione', importo: '800', data: '2026-10-18', collaborazione_id: 7, collaborazione_nome: 'Studio Rossi' }),
    { tabella: 'pagamenti_esterni', riga: { collaborazione_id: 7, collaborazione_nome: 'Studio Rossi', data: '2026-10-18', importo: 800, metodo: 'Bonifico', note: null } });
  assert.throws(() => rigaIncassoStudio({ tipo: 'entrata', categoria: 'Collaborazione', importo: '8', data: '2026-10-18' }), /collaborazione/);
});

test('spese e incassi di altre categorie non vanno nello studio', () => {
  assert.equal(rigaIncassoStudio({ tipo: 'uscita', categoria: 'Studio', importo: '5', data: '2026-10-18' }), null);
  assert.equal(rigaIncassoStudio({ tipo: 'entrata', categoria: 'Affitti', importo: '5', data: '2026-10-18' }), null);
});

test('il movimento di Personal non porta colonne dello studio', () => {
  assert.equal('studio_tabella' in rigaMovimento({ tipo: 'entrata', importo: '5', data: '2026-10-18', studio_tabella: 'payments', studio_riga: 1 }), false);
});

const dati = {
  pagamenti: [
    { data: '2026-10-02', importo: 1000, stato: 'pagato' },
    { data: '2026-10-20', importo: 500, stato: 'acconto' },
    { data: '2026-10-21', importo: 300, stato: 'sospeso' },
    { data: '2026-09-30', importo: 999, stato: 'pagato' },
  ],
  esterni: [
    { data: '2026-10-05', importo: 800, collaborazione_nome: 'Neive' },
    { data: '2026-10-25', importo: 200, collaborazione_nome: 'Neive' },
  ],
  spese: [
    { data: '2026-10-10', importo: 250, ricorrente: false },
    { data: '2026-01-01', importo: 600, ricorrente: true, frequenza: 'Mensile' },
    { data: '2026-01-01', importo: 1200, ricorrente: true, frequenza: 'Annuale', data_fine: '2026-09-30' },
  ],
};

test('lavoro netto del mese: pazienti (senza i sospesi) + collaborazioni − spese', () => {
  const l = lavoroDelPeriodo(dati, '2026-10-01', '2026-10-31');
  assert.equal(l.pazienti, 1500);
  assert.equal(l.collaborazioni, 1000);
  assert.deepEqual(l.perCollaborazione, [{ nome: 'Neive', totale: 1000 }]);
  assert.equal(l.spese, 850); // 250 + 600 al mese; l'annuale è finita a settembre
  assert.equal(l.netto, 1650);
});

test('spese ricorrenti divise per mese come le proietta il gestionale', () => {
  const anno = lavoroDelPeriodo({ spese: dati.spese }, '2026-01-01', '2026-12-31');
  assert.equal(anno.spese, 250 + 600 * 12 + 100 * 9);
  assert.deepEqual(mesiTra('2026-11-15', '2027-02-01'), ['2026-11', '2026-12', '2027-01', '2027-02']);
});

test('il netto entra nel bilancio come entrata del mese, una per mese', () => {
  const extra = movimentiLavoro(dati, '2026-09-01', '2026-10-31');
  assert.deepEqual(extra.map((m) => [m.data, m.tipo, m.importo]), [['2026-09-01', 'entrata', 999 - 600 - 100], ['2026-10-01', 'entrata', 1650]]);
  const b = bilancio([{ tipo: 'uscita', importo: 400, data: '2026-10-03', categoria: 'Spesa' }, ...movimentiLavoro(dati, '2026-10-01', '2026-10-31')]);
  assert.equal(b.entrate, 1650);
  assert.equal(b.saldo, 1250);
  assert.deepEqual(movimentiLavoro(null, '2026-10-01', '2026-10-31'), []);
});

test('studio.js: nuovi incassi solo in payments e pagamenti_esterni, spese e collaborazioni in lettura', () => {
  const src = readFileSync(new URL('../personal/src/lib/studio.js', import.meta.url), 'utf8');
  const parte = src.slice(src.indexOf('POL-VITA-022: incassi'));
  assert.match(parte, /studioDellaSessione\(sessione\)/);
  assert.match(parte, /user_id: sessione\.user\.id/);
  assert.doesNotMatch(parte, /\.(update|delete|upsert)\(/);
  for (const t of ['spese', 'collaborazioni']) assert.doesNotMatch(src, new RegExp(`from\\('${t}'\\)[^;]*\\.(insert|update|delete|upsert)\\(`));
});
