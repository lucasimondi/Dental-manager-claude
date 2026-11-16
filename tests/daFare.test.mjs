// DA-FARE (2026-11-16): promemoria d'azione con Gestita, Rimuovi (mai cancellare), Dimmi cosa fare, Rispondi.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ordina, raggruppa, passi, puoRispondere, cambiaStato, bozzaPerPromemoria } from '../personal/src/lib/daFare.js';

test('ordine: priorità, poi scadenza più vicina, senza scadenza in fondo', () => {
  const v = ordina([
    { id: 'c', priorita: 'media', scadenza: null },
    { id: 'b', priorita: 'alta', scadenza: '2026-12-01' },
    { id: 'a', priorita: 'alta', scadenza: '2026-11-20' },
    { id: 'd', priorita: 'bassa', scadenza: '2026-11-17' },
  ]);
  assert.deepEqual(v.map((x) => x.id), ['a', 'b', 'c', 'd']);
  assert.deepEqual(raggruppa(v).map((g) => [g.nome, g.voci.length]), [['Urgente', 2], ['Da fare', 1], ['Quando puoi', 1]]);
});

test('passi: una riga per passo, numeri e trattini tolti', () => {
  assert.deepEqual(passi('1. Chiama Fides\n2) Paga 260 €\n- Manda la ricevuta\n\n• Fatto'), ['Chiama Fides', 'Paga 260 €', 'Manda la ricevuta', 'Fatto']);
  assert.deepEqual(passi(''), []);
});

test('Rispondi solo se il promemoria viene da un\'email', () => {
  assert.equal(puoRispondere({ documento_id: 'x', email: true }), true);
  assert.equal(puoRispondere({ documento_id: 'x', email: false }), false);
  assert.equal(puoRispondere({ documento_id: null, email: true }), false);
});

test('Rimuovi non cancella: aggiorna lo stato; stati sconosciuti rifiutati', async () => {
  const chiamate = [];
  const q = { update: (b) => { chiamate.push(['update', b]); return q; }, eq: (...a) => { chiamate.push(['eq', ...a]); return q; },
    select: () => q, single: async () => ({ data: { id: '1', stato: 'rimosso' }, error: null }) };
  const db = { from: (t) => { chiamate.push(['from', t]); return q; } };
  await cambiaStato(db, '1', 'rimosso');
  assert.equal(chiamate[0][1], 'promemoria_azioni');
  assert.equal(chiamate[1][1].stato, 'rimosso');
  assert.ok(!chiamate.some((c) => c[0] === 'delete'));
  await assert.rejects(() => cambiaStato(db, '1', 'cancellato'), /Stato non valido/);
});

test('Rispondi: chiede allo script solo una bozza, con il documento e il testo', async () => {
  let corpo;
  const r = await bozzaPerPromemoria({ token: 't', documento: 'abc', ente: 'Fides', testo: 'Buongiorno' },
    async (_u, o) => { corpo = JSON.parse(o.body); return { json: async () => ({ ok: true, testo: 'Buongiorno', link: 'x' }) }; });
  assert.equal(corpo.azione, 'bozza');
  assert.equal(corpo.documento, 'abc');
  assert.equal(corpo.testo, 'Buongiorno');
  assert.equal(r.ok, true);
});

test('script: la bozza con testo pronto non passa da nessun modello e resta una bozza', () => {
  const codice = readFileSync('poliedron/archivio/Code.gs', 'utf8');
  const parte = codice.slice(codice.indexOf('function bozzaRisposta_'), codice.indexOf('const system', codice.indexOf('function bozzaRisposta_')));
  assert.match(parte, /if \(pronto\) \{\s*msg\.createDraftReply\(pronto\)/);
  assert.doesNotMatch(parte, /\.send\(|sendEmail/);
});

test('migrazione: tabella con RLS del proprietario e nessuna cancellazione per «Rimuovi»', () => {
  const sql = readFileSync('supabase/archivio/migrations/20261116100000_da_fare.sql', 'utf8');
  assert.match(sql, /create table if not exists promemoria_azioni/);
  assert.match(sql, /enable row level security/);
  assert.match(sql, /e_proprietario\(\)/);
  assert.match(sql, /stato in \('aperto', 'gestito', 'rimosso'\)/);
});
