// LEGAL-SCHEDE — PO 2026-11-18: tabella scadenze legali/economiche e scheda pratica (sintesi, punti salienti,
// da attenzionare, passi anche in «Da fare»). Casi presi dalla forma dei dati reali (anonimizzati dove serve).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { raggruppaScadenze, tipoScadenza, ambitoDi, analizzaPratica } from '../personal/src/lib/legal.js';

const codice = readFileSync('poliedron/archivio/Code.gs', 'utf8');
const sql = readFileSync('supabase/archivio/migrations/20261118210000_legal_schede.sql', 'utf8');
const doc = (fascicolo, pratica_id, titolo = 'Documento', ptit = 'Pratica') => ({ titolo, fascicolo, pratica_id, pratica: { titolo: ptit, fascicolo } });
const r = (id, data, descrizione, importo, d, pratica_id = d.pratica_id) => ({ id, data, descrizione, importo, documento_id: `doc-${id}`, pratica_id, documento: d, pratica: d.pratica });
const OGGI = '2026-11-18';

test('tipo: perentorie, udienze, pagamenti', () => {
  assert.equal(tipoScadenza('Termine perentorio per proporre opposizione al decreto ingiuntivo'), 'perentoria');
  assert.equal(tipoScadenza('Termine per la parte resistente per il deposito di memoria di costituzione'), 'perentoria');
  assert.equal(tipoScadenza('Udienza innanzi al Giudice della divisione (ore 11:00)'), 'udienza');
  assert.equal(tipoScadenza('Scadenza pagamento RID fattura n. NO/I/26/00833', 185.44), 'pagamento');
  assert.equal(tipoScadenza('Scadenza polizza'), 'altro');
  assert.equal(ambitoDi('legale'), 'legale'); assert.equal(ambitoDi('fiscale'), 'economico'); assert.equal(ambitoDi('famiglia_scuola'), null);
});

test('doppioni della stessa pratica e data → una riga, descrizione più completa, importo, fonti', () => {
  const uno = doc('legale', 'p-uno', 'Decreto', 'UnoEnergy – opposizione D.I. 841/2026');
  const out = raggruppaScadenze([
    r('a', '2026-12-07', 'Termine perentorio di 40 giorni dalla notifica (28/10/2026) per proporre opposizione al decreto ingiuntivo', 2163.59, uno),
    r('b', '2026-12-07', 'Termine perentorio per proporre opposizione al decreto ingiuntivo', null, uno),
  ], OGGI);
  assert.equal(out.length, 1);
  assert.deepEqual([out[0].tipo, out[0].fonti, out[0].importo, out[0].giorni, out[0].pratica_id, out[0].ambito], ['perentoria', 2, 2163.59, 19, 'p-uno', 'legale']);
  assert.match(out[0].descrizione, /40 giorni/);
  assert.deepEqual(out[0].ids, ['a', 'b']);
});

test('stessa scadenza perentoria con date diverse nei documenti → la più vicina, conflitto segnalato', () => {
  const atp = doc('legale', 'p-atp', 'Atto', 'Ricorso ATP R.G. 2174/2026');
  const out = raggruppaScadenze([
    r('1', '2026-12-12', 'Termine per la parte resistente per il deposito di memoria di costituzione e di eventuali documenti', null, atp),
    r('2', '2026-12-13', 'Scadenza perentoria per il deposito telematico della memoria di costituzione e documenti', null, atp),
    r('3', '2026-12-13', 'Termine perentorio per deposito telematico memoria di costituzione e documenti', null, atp),
    r('4', '2027-01-08', 'Termine perentorio deposito note di trattazione scritta e nomina CTP', null, atp),
  ], OGGI);
  assert.deepEqual(out.map((s) => [s.data, s.altre_date, s.fonti]), [['2026-12-12', ['2026-12-13'], 3], ['2027-01-08', [], 1]]);
});

test('pagamenti della stessa pratica e data: numeri di verbale diversi restano righe diverse, i doppioni si uniscono', () => {
  const v = (t) => doc('veicoli', 'p-multe', t, 'Polizia Municipale – verbali');
  const out = raggruppaScadenze([
    r('m1', '2026-12-31', 'Termine versamento pre-ruolo tramite PagoPA', 103.5, v('Preavviso di ruolo – verbale 724282VP/2026')),
    r('m2', '2026-12-31', 'Termine pagamento avviso pagoPA verbale 724282VP/26', 103.5, v('Avviso di pagamento – verbale 724282VP/26')),
    r('m3', '2026-12-31', 'Termine per pagamento pre-ruolo PagoPA per evitare iscrizione a ruolo', 103.5, v('Preavviso ruolo – verbale 726170VP/2026')),
    r('m4', '2026-12-31', 'Scadenza pagamento preruolo verbale 726170VP/26', 103.5, v('Avviso di pagamento – verbale 726170VP/26')),
    r('m5', '2026-12-31', 'Termine per il pagamento prima della formazione del ruolo esattoriale', 86.5, v('Avviso – verbale 16521V/2026')),
    r('m6', '2026-12-31', 'Scadenza pagamento preruolo verbale 16521V/26', 86.5, v('Avviso – verbale 16521V/26')),
  ], OGGI);
  assert.deepEqual(out.map((s) => [s.ids.join('+'), s.importo, s.ambito]).sort(), [['m1+m2', 103.5, 'economico'], ['m3+m4', 103.5, 'economico'], ['m5+m6', 86.5, 'economico']]);
});

test('filtri: mai i clinici, fuori i fascicoli non legali/economici, delle utenze solo mora/diffide', () => {
  const out = raggruppaScadenze([
    r('c', '2026-11-23', 'Visita', null, doc('clinico_pazienti', 'p1')),
    r('f', '2026-11-20', 'Gara di pallavolo', null, doc('famiglia_scuola', 'p2')),
    r('b', '2026-12-11', 'Scadenza pagamento bolletta energia elettrica', 376.95, doc('utenze', 'p3', 'Fattura – Edison')),
    r('m', '2026-11-26', "Termine ultimo per il pagamento dell'insoluto", 1742.84, doc('utenze', 'p4', 'Costituzione di mora e risoluzione contrattuale – Sorgenia')),
    r('rv1', '2026-11-24', 'Termine recesso gratuito e rimozione franchigia commissioni', null, doc('conti', 'p5')),
    r('rv2', '2026-11-24', 'Entrata in vigore rimozione soglia transazioni gratuite e termine recesso gratuito', null, doc('conti', 'p5')),
  ], OGGI);
  assert.deepEqual(out.map((s) => s.ids.join('+')), ['rv1+rv2', 'm']);
});

test('app: analizza la pratica dallo script; errore clinico riconoscibile', async () => {
  const inviati = [];
  const f = (risposta) => async (_u, o) => { inviati.push(JSON.parse(o.body)); return { json: async () => risposta }; };
  assert.equal((await analizzaPratica({ token: 't', praticaId: 'p1' }, f({ ok: true, passi_nuovi: 2 }))).passi_nuovi, 2);
  assert.deepEqual(inviati[0], { token: 't', azione: 'scheda_pratica', pratica_id: 'p1' });
  await assert.rejects(analizzaPratica({ token: 't', praticaId: 'p1' }, f({ ok: false, clinico: true, errore: 'pazienti' })), (e) => e.clinico === true);
  await assert.rejects(analizzaPratica({ token: null, praticaId: 'p1' }), /Sessione scaduta/);
});

/* ---------- script ---------- */
function scriptFinto({ docs, testi = {}, gia = [], risposta }) {
  const chiamate = [];
  let ai = 0, prompt = '';
  const ctx = { console: { log() {}, warn() {}, error() {} }, JSON, Date, Math, String, Number, Array, Object, RegExp, Error, encodeURIComponent, isFinite,
    PropertiesService: { getScriptProperties: () => ({ getProperty: () => null, setProperty() {} }) },
    Utilities: { formatDate: () => '2026-11-18' } };
  vm.createContext(ctx);
  vm.runInContext(codice, ctx);
  ctx.logErrore_ = () => {};
  ctx.claudeInPausa_ = () => true;
  ctx.testoAI_ = (system, contenuto) => { ai++; prompt = contenuto; return JSON.stringify(risposta); };
  ctx.sb_ = (percorso, o = {}) => {
    chiamate.push({ percorso, metodo: o.method || 'get', corpo: o.body });
    if (percorso.startsWith('pratiche?select=')) return [{ id: '11111111-1111-4111-8111-111111111111', titolo: 'UnoEnergy – D.I.', fascicolo: 'legale', stato: 'aperta', note: '' }];
    if (percorso.startsWith('documenti?select=') && percorso.includes('&pratica_id=eq.')) return docs.filter((d) => d.pratica_id);
    if (percorso.startsWith('documenti?select=') && percorso.includes('&ente=in.')) return docs.filter((d) => !d.pratica_id);
    if (percorso.startsWith('documenti_testo?')) return Object.entries(testi).map(([documento_id, testo]) => ({ documento_id, testo }));
    if (percorso.startsWith('scadenze?')) return [{ data: '2026-12-07', descrizione: 'Termine perentorio opposizione', importo: null, completata: false }];
    if (percorso.startsWith('promemoria_azioni?select=')) return gia.map((titolo) => ({ titolo }));
    return null;
  };
  return { ctx, chiamate, ai: () => ai, prompt: () => prompt };
}
const P = '11111111-1111-4111-8111-111111111111';
const D = (id, extra = {}) => ({ id, titolo: 'Decreto ingiuntivo', fascicolo: 'legale', tipo_documento: 'atto', data_documento: '2026-08-03', riassunto: 'Decreto per fatture gas', ente: 'UnoEnergy', pratica_id: P, ...extra });

test('script: scheda con codici [D..] tradotti negli id, passi nuovi in «Da fare» senza doppioni', () => {
  const docs = [D('d1'), D('d2', { titolo: 'Disdetta email', data_documento: '2023-11-13' }), D('d3', { titolo: 'Fattura gas', pratica_id: null, fascicolo: 'utenze' })];
  const s = scriptFinto({ docs, testi: { d1: 'Testo del decreto 841/2026' }, gia: ['Dare l\'incarico all\'avvocato'], risposta: {
    oggetto: 'Opposizione D.I.', controparte: 'UnoEnergy', autorita: 'Giudice di Pace di Cuneo', importo: 2163.59, sintesi: 'Sintesi',
    punti: [{ testo: 'Disdetta del 13/11/2023', doc: ['D2', '[D9]'] }], attenzione: [{ testo: 'Consumi dopo la disdetta', doc: ['D3'] }],
    passi: [{ testo: 'Dare l’incarico all’avvocato', entro: '2026-11-25', priorita: 'alta' }, { testo: 'Chiedere le letture a Italgas', entro: null, priorita: 'media' }],
  } });
  const r = s.ctx.schedaPratica_(P);
  assert.equal(r.ok, true);
  const scheda = s.chiamate.find((c) => c.percorso.startsWith('pratiche_schede?on_conflict=pratica_id')).corpo;
  // Ordine nel prompt per data: d2 (2023) poi d1, d3; i codici seguono l'ordine di lettura (d1=D1, d2=D2, d3=D3).
  assert.deepEqual(JSON.parse(JSON.stringify([scheda.punti[0].doc, scheda.attenzione[0].doc, scheda.importo, scheda.modello])), [['d2'], ['d3'], 2163.59, 'gemini']);
  assert.match(s.prompt(), /\[D3\] .*\(stessa controparte, fuori pratica\)/);
  assert.match(s.prompt(), /Testo: Testo del decreto 841\/2026/);
  const passi = s.chiamate.find((c) => c.percorso === 'promemoria_azioni' && c.metodo === 'post').corpo;
  assert.deepEqual(JSON.parse(JSON.stringify(passi.map((x) => [x.titolo, x.scadenza, x.categoria, x.pratica_id, x.stato]))), [['Chiedere le letture a Italgas', null, 'legale', P, 'aperto']]);
  assert.equal(r.passi_nuovi, 1);
});

test('script: pratica con documenti di pazienti → nessun modello, nessuna scrittura', () => {
  for (const docs of [[D('d1', { fascicolo: 'clinico_pazienti' })], [D('d1', { riassunto: 'Ricorso ATP della paziente per le cure' })], [D('d1')]]) {
    const s = scriptFinto({ docs, testi: docs[0].riassunto === 'Decreto per fatture gas' ? { d1: 'cartella clinica allegata' } : {}, risposta: {} });
    const r = s.ctx.schedaPratica_(P);
    assert.equal(r.clinico, true);
    assert.equal(s.ai(), 0);
    assert.equal(s.chiamate.some((c) => c.metodo !== 'get'), false);
  }
  assert.equal(scriptFinto({ docs: [], risposta: {} }).ctx.schedaPratica_('non-uuid').ok, false);
});

test('script: azione app, aggiornamento automatico al massimo una volta all\'ora e solo con tempo avanzato', () => {
  assert.match(codice, /if \(req\.azione === 'scheda_pratica'\) return rispostaJson_\(schedaPratica_\(String\(req\.pratica_id \|\| ''\)\)\);/);
  assert.match(codice, /if \(Date\.now\(\) - inizio < CONFIG\.TEMPO_MAX_MS - 90000\) aggiornaSchede_\(\);/);
  assert.match(codice, /SCHEDE_ULTIMO'\) \|\| 0\) > Date\.now\(\) - 3600 \* 1000/);
});

test('migrazione: solo aggiunte, scheda leggibile solo dal proprietario e scritta solo dallo script', () => {
  assert.doesNotMatch(sql, /\bdrop\s+(table|column|function|view|policy|trigger)\b|\bdelete\s+from\b|\bupdate\s+\w+\s+set\b/i);
  assert.match(sql, /create policy proprietario_legge on pratiche_schede for select to authenticated using \(\(select e_proprietario\(\)\)\)/);
  assert.match(sql, /revoke insert, update, delete, truncate, references, trigger on pratiche_schede from authenticated;/);
  assert.match(sql, /revoke all on pratiche_schede from anon;/);
  assert.match(sql, /add column if not exists pratica_id uuid references pratiche\(id\) on delete set null/);
});
