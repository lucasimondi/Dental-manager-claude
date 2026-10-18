// POL-VITA-021 — PO 2026-10-18: "dobbiamo rendere anche gli automatismi reversibili: si crea un
// pagamento automatico ma ho la possibilità di cancellarlo chiudendo ogni dubbio".
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { segnaPagato, annullaPagato, rimettiDaPagare, eliminaPagamento, interrompiRicorrenza } from '../personal/src/lib/automatismi.js';
import { annullaPromemoria } from '../personal/src/lib/assistente.js';

// Client finto: ogni catena (from → … → fine) è registrata; `risposte` decide i dati per tabella e operazione.
function dbFinto(risposte = {}) {
  const chiamate = [];
  const db = {
    chiamate,
    from(tabella) {
      const c = { tabella, op: 'select', passi: [] };
      chiamate.push(c);
      const q = new Proxy({}, {
        get(_t, nome) {
          if (nome === 'then') {
            const r = risposte[`${tabella}.${c.op}`];
            const data = typeof r === 'function' ? r(c) : r ?? (c.op === 'select' ? [] : c.single ? { id: 'x' } : []);
            return (ok) => ok({ data, error: null });
          }
          return (...arg) => {
            if (['insert', 'update', 'delete'].includes(nome)) { c.op = nome; c.valori = arg[0]; }
            if (nome === 'single') c.single = true;
            c.passi.push([nome, ...arg]);
            return q;
          };
        },
      });
      return q;
    },
  };
  return db;
}
const delete_ = (db, tabella) => db.chiamate.filter((c) => c.tabella === tabella && c.op === 'delete');
const filtro = (c, nome) => c.passi.filter(([p]) => p === nome).map(([, ...a]) => a);

const FISSO = { id: 's1', descrizione: 'Rata Fiditalia', data: '2026-10-28', importo: 368.89, ricorrenza: 'mensile', categoria: 'Altro' };

test('Pagato e poi Annulla: torna da pagare e spariscono solo la spesa e il prossimo creati adesso', async () => {
  const db = dbFinto({ 'movimenti.insert': { id: 'm1' }, 'scadenze.insert': { id: 's2', data: '2026-11-28' } });
  const r = await segnaPagato(db, FISSO);
  assert.equal(r.messaggio, 'Pagato e registrato tra le spese · prossimo il 28 nov');
  assert.deepEqual(r.annulla, { scadenzaId: 's1', spesaId: 'm1', prossimoId: 's2' });

  const giu = dbFinto();
  assert.equal(await annullaPagato(giu, r.annulla), 'Annullato: di nuovo da pagare');
  assert.deepEqual(giu.chiamate.find((c) => c.op === 'update').valori, { completata: false });
  assert.deepEqual(filtro(delete_(giu, 'movimenti')[0], 'eq'), [['id', 'm1']]);
  assert.deepEqual(filtro(delete_(giu, 'scadenze')[0], 'eq'), [['id', 's2'], ['completata', false]], 'il successivo solo se ancora da pagare');
});

test('Annulla non tocca ciò che esisteva già (spesa o pagamento successivo creati prima)', async () => {
  const db = dbFinto({ 'movimenti.select': [{ id: 'vecchia' }], 'scadenze.select': [{ id: 'gia', data: '2026-11-28' }] });
  const r = await segnaPagato(db, FISSO);
  assert.deepEqual(r.annulla, { scadenzaId: 's1', spesaId: null, prossimoId: null });
  const giu = dbFinto();
  await annullaPagato(giu, r.annulla);
  assert.equal(giu.chiamate.filter((c) => c.op === 'delete').length, 0);
});

test('Segna da pagare più tardi: via la spesa automatica e il successivo del fisso ancora da pagare', async () => {
  const db = dbFinto({ 'scadenze.select': [{ id: 's2', data: '2026-11-28' }], 'scadenze.delete': [{ id: 's2' }] });
  assert.equal(await rimettiDaPagare(db, FISSO), 'Di nuovo da pagare · tolto anche il pagamento successivo');
  assert.deepEqual(filtro(delete_(db, 'movimenti')[0], 'eq'), [['scadenza_id', 's1']]);
  const cerca = db.chiamate.find((c) => c.tabella === 'scadenze' && c.op === 'select');
  assert.deepEqual(filtro(cerca, 'eq'), [['descrizione', 'Rata Fiditalia'], ['completata', false], ['storica', false], ['data', '2026-11-28']]);
  assert.deepEqual(filtro(cerca, 'is'), [['documento_id', null]], 'mai pagamenti arrivati da un documento');
  assert.deepEqual(filtro(delete_(db, 'scadenze')[0], 'in'), [['id', ['s2']]]);
});

test('Elimina pagamento: toglie anche la sua spesa nei Conti (prima restava orfana)', async () => {
  const db = dbFinto({ 'movimenti.delete': [{ id: 'm1' }] });
  assert.equal(await eliminaPagamento(db, { id: 's9' }), 'Pagamento eliminato, con la sua spesa nei Conti');
  const ordine = db.chiamate.filter((c) => c.op === 'delete').map((c) => c.tabella);
  assert.deepEqual(ordine, ['movimenti', 'scadenze']);
  assert.equal(await eliminaPagamento(dbFinto(), { id: 's8' }), 'Pagamento eliminato');
});

test('Non lo pago più: niente ripetizione e via i successivi automatici ancora da pagare', async () => {
  const db = dbFinto({ 'scadenze.select': [{ id: 'a' }, { id: 'b' }], 'scadenze.delete': [{ id: 'a' }, { id: 'b' }] });
  assert.equal(await interrompiRicorrenza(db, FISSO), 'Non si ripete più · tolti 2 pagamenti successivi');
  assert.deepEqual(db.chiamate.find((c) => c.op === 'update').valori, { ricorrenza: null });
  const cerca = db.chiamate.find((c) => c.tabella === 'scadenze' && c.op === 'select');
  assert.deepEqual(filtro(cerca, 'gt'), [['data', '2026-10-28']]);
  assert.deepEqual(filtro(cerca, 'not'), [['ricorrenza', 'is', null]]);
  assert.equal(await interrompiRicorrenza(dbFinto(), FISSO), 'Non si ripete più');
});

test('Promemoria dell\'assistente: Annulla toglie il pagamento o l\'impegno appena aggiunto', async () => {
  const tolti = [];
  const f = { eliminaScadenza: async (id) => tolti.push(['scadenza', id]), eliminaImpegno: async (id) => tolti.push(['impegno', id]) };
  assert.equal(await annullaPromemoria({ cosa: 'pagamento', id: 's5' }, f), 'Annullato: tolto da Da pagare');
  assert.equal(await annullaPromemoria({ cosa: 'evento', id: 77 }, f), 'Annullato: tolto dall\'agenda');
  assert.deepEqual(tolti, [['scadenza', 's5'], ['impegno', 77]]);
});

test('app: avviso con Annulla dopo Pagato, "Non lo pago più" sui fissi, elimina con la spesa', () => {
  const app = readFileSync('personal/src/App.jsx', 'utf8');
  const pag = readFileSync('personal/src/sezioni/conti/Pagamento.jsx', 'utf8');
  assert.match(app, /mostra\(r\.messaggio, \{ etichetta: 'Annulla', fai: async \(\) => \{ const m = await annullaPagato\(archivioDb, r\.annulla\)/);
  assert.match(app, /timerToast\.current = setTimeout\(\(\) => setToast\(null\), azione \? 7000 : 2600\)/);
  assert.match(pag, /Non lo pago più: smetti di ripeterlo/);
  assert.match(pag, /mostra\(await eliminaPagamento\(archivioDb, s\)\)/);
  assert.match(pag, /await rimettiDaPagare\(archivioDb, s\)/);
});
