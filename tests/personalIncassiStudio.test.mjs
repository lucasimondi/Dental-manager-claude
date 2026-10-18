// POL-VITA-021: incassi di studio o di collaborazione registrati anche nel gestionale dello studio.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { rigaIncassoStudio, tabellaStudio, rigaMovimento, CATEGORIE_INCASSO } from '../personal/src/lib/conti.js';

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

test('il movimento ricorda la riga dello studio e propone la descrizione', () => {
  const r = rigaMovimento({ tipo: 'entrata', categoria: 'Studio', importo: '50', data: '2026-10-18', paziente: 'Mario Rossi', studio_tabella: 'payments', studio_riga: 9 });
  assert.equal(r.descrizione, 'Studio – Mario Rossi');
  assert.equal(r.studio_tabella, 'payments');
  assert.equal(r.studio_riga, 9);
  assert.equal('studio_tabella' in rigaMovimento({ tipo: 'entrata', importo: '5', data: '2026-10-18' }), false);
});

test('studio.js scrive solo payments e pagamenti_esterni, con studio della sessione', () => {
  const src = readFileSync(new URL('../personal/src/lib/studio.js', import.meta.url), 'utf8');
  const parte = src.slice(src.indexOf('POL-VITA-021: incassi'));
  assert.match(parte, /studioDellaSessione\(sessione\)/);
  assert.match(parte, /user_id: sessione\.user\.id/);
  assert.equal((parte.match(/Tabella dello studio non ammessa/g) || []).length, 3);
});
