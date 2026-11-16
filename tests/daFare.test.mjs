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

// DA-FARE v2: categorie, filtri, rimanda.
import { categoria, filtri, filtra, riepilogo, dataTra } from '../personal/src/lib/daFare.js';
test('categoria dedotta dal titolo se manca', () => {
  assert.equal(categoria({ titolo: 'Nominare un nuovo avvocato' }), 'legale');
  assert.equal(categoria({ titolo: 'x', categoria: 'fisco' }), 'fisco');
  assert.equal(categoria({ titolo: 'Intrum 152 €' }), 'soldi');
});
test('rimandate escono dalla lista e hanno il loro filtro', () => {
  const v = [{ id: 1, titolo: 'a', priorita: 'alta', importo: 10 }, { id: 2, titolo: 'b', priorita: 'media', rimanda_al: '2099-01-01' }];
  assert.deepEqual(filtra(v, 'tutte', '2026-11-16').map((p) => p.id), [1]);
  assert.deepEqual(filtra(v, 'rimandate', '2026-11-16').map((p) => p.id), [2]);
  assert.ok(filtri(v, '2026-11-16').some((f) => f.id === 'rimandate' && f.n === 1));
  assert.equal(riepilogo(v, '2026-11-16').urgenti, 1);
  assert.equal(dataTra(7, new Date('2026-11-16T12:00:00Z')), '2026-11-23');
});

// DA-FARE v3: altre azioni.
import { telefoni, testoCondivisione, linkIA, linkWhatsApp, eventoDaPromemoria, datiPagamento, conNota, normalizzaContatti } from '../personal/src/lib/daFare.js';
test('trova i telefoni nel testo', () => {
  const t = telefoni({ spiegazione: 'scrivi su WhatsApp al 340 492 4007 o chiama 06 2019 4580', cosa_fare: 'Ge.Ri. allo 06 9594 4100' });
  assert.deepEqual(t.map((x) => x.tel), ['+393404924007', '+390620194580', '+390695944100']);
  assert.equal(t[0].cellulare, true);
});
test('condivisione e link', () => {
  const p = { titolo: 'Intrum', ente: 'Intrum', importo: 152.5, spiegazione: 'Da contestare', cosa_fare: '1. Controlla\n2. Paga' };
  assert.match(testoCondivisione(p), /Cosa fare:\n1\. Controlla\n2\. Paga/);
  assert.match(linkIA(p), /^https:\/\/claude\.ai\/new\?q=/);
  assert.match(linkIA(p, 'chatgpt'), /^https:\/\/chatgpt\.com\/\?q=/);
  assert.match(linkWhatsApp(p, '+393404924007'), /^https:\/\/wa\.me\/393404924007\?text=/);
  const ev = eventoDaPromemoria({ ...p, scadenza: '2026-12-01' }, { ora: '09:30' });
  assert.equal(ev.data_inizio, '2026-12-01'); assert.equal(ev.ora_fine, '10:30'); assert.equal(ev.visibile_studio, false); assert.equal(ev.tutto_il_giorno, false);
  assert.equal(eventoDaPromemoria(p, { data: '2026-12-02' }).tutto_il_giorno, true);
});
test('il numero non si mangia la riga dopo', () => {
  assert.deepEqual(telefoni({ cosa_fare: '2. Manda la ricevuta al 340 492 4007\n3. Chiedi' }).map((x) => x.mostra), ['340 492 4007']);
});

test('paga, note, contatti', () => {
  const d = datiPagamento({ importo: 84.93, cosa_fare: 'bonifico a IT02B0503433710000000000233 con causale "FT 2366 cliente 1842"' });
  assert.deepEqual(d.iban, ['IT02B0503433710000000000233']); assert.equal(d.causale, 'FT 2366 cliente 1842');
  assert.equal(conNota('vecchia', 'chiamato', new Date('2026-11-18T10:00:00')), '18/11/2026 – chiamato\nvecchia');
  assert.deepEqual(normalizzaContatti([{ nome: 'Avv', email: 'a@b.it' }, { nome: '', email: 'x' }, { nome: 'Senza' }]), [{ nome: 'Avv', email: 'a@b.it', telefono: '' }]);
});
