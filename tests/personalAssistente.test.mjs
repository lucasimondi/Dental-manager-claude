// PO 2026-10-18: "La chat poliedron innanzitutto quando si clicca e viene su la tastiera deve sparire
// il dock flottante. Inoltre deve essere la mia assistente personale".
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { agendaPerAssistente, giornataRichiesta, aggiungiPromemoria, promemoriaIniziale, giorniTraDate, benvenuto } from '../personal/src/lib/assistente.js';

const codice = readFileSync('poliedron/archivio/Code.gs', 'utf8');
const vista = readFileSync('personal/src/sezioni/poliedron/Poliedron.jsx', 'utf8');
const css = readFileSync('personal/src/personal.css', 'utf8');

test('tastiera: scrivendo il dock flottante sparisce e Invia non chiude la tastiera', () => {
  assert.match(vista, /document\.body\.classList\.toggle\('pp-tastiera', scrivendo\)/);
  assert.match(vista, /onFocus=\{inizioScrittura\} onBlur=\{fineScrittura\}/);
  assert.match(vista, /return \(\) => document\.body\.classList\.remove\('pp-tastiera'\)/, 'uscendo dalla chat il dock torna');
  assert.match(vista, /onPointerDown=\{\(e\) => scrivendo && e\.preventDefault\(\)\}/);
  assert.match(css, /body\.pp-tastiera \.pp-schede \{ display: none; \}/);
  assert.match(css, /body\.pp-tastiera \.pp-chat-composer \{ padding-bottom: 8px; \}/);
});

test('agenda per l\'AI: impegni personali con orario; dello studio solo quanti e la fascia, mai i pazienti', () => {
  const testo = agendaPerAssistente({
    da: '2026-10-19', giorni: 2,
    impegni: [{ titolo: 'Palestra', data_inizio: '2026-10-19', data_fine: '2026-10-19', ora_inizio: '18:30:00' }, { titolo: 'Ferie', data_inizio: '2026-10-20', data_fine: '2026-10-20', tutto_il_giorno: true }],
    appuntamenti: [
      { data: '2026-10-19', ora: '09:00:00', paziente: 'Mario Rossi', note: 'carie 36' },
      { data: '2026-10-19', ora: '15:30:00', paziente: 'Anna Bianchi' },
      { data: '2026-10-19', ora: '11:00:00', paziente: 'Annullato', stato: 'annullato' },
    ],
  });
  assert.equal(testo, 'lunedì 19 ottobre (2026-10-19): studio: 2 appuntamenti 09:00–15:30 · impegni: 18:30 Palestra\nmartedì 20 ottobre (2026-10-20): impegni: Ferie');
  assert.doesNotMatch(testo, /Rossi|Bianchi|carie/);
});

test('domande sulla giornata: risponde l\'app (oggi, domani, settimana); i pagamenti restano all\'AI', () => {
  assert.deepEqual(giornataRichiesta('Cosa ho oggi?', '2026-10-18'), { da: '2026-10-18', a: '2026-10-18', titolo: 'Oggi' });
  assert.deepEqual(giornataRichiesta('che ho domani', '2026-10-18'), { da: '2026-10-19', a: '2026-10-19', titolo: 'Domani' });
  assert.deepEqual(giornataRichiesta('cosa ho dopodomani?', '2026-10-31'), { da: '2026-11-02', a: '2026-11-02', titolo: 'Dopodomani' });
  assert.deepEqual(giornataRichiesta('Che impegni ho questa settimana?', '2026-10-18'), { da: '2026-10-18', a: '2026-10-24', titolo: 'Prossimi 7 giorni' });
  assert.equal(giornataRichiesta('Cosa devo pagare questa settimana?', '2026-10-18'), null);
  assert.equal(giornataRichiesta('Dov\'è la carta d\'identità di Giulia?', '2026-10-18'), null);
  assert.deepEqual(giorniTraDate('2026-10-30', '2026-11-01'), ['2026-10-30', '2026-10-31', '2026-11-01']);
  assert.match(benvenuto(9), /^Buongiorno Luca, sono Poliedron, la tua assistente personale/);
  assert.match(benvenuto(20), /^Buonasera/);
});

test('promemoria confermato: pagamento in Da pagare, evento in agenda (con o senza ora)', async () => {
  const fatti = [];
  const salva = { nuovaScadenza: async (s) => fatti.push(['scadenza', s]), salvaImpegno: async (e) => fatti.push(['impegno', e]) };
  const p = promemoriaIniziale({ tipo: 'promemoria', cosa: 'pagamento', titolo: 'Bollo auto', data: '2026-10-30', importo: 214.5, categoria: 'Auto', ricorrenza: 'annuale' });
  assert.match(await aggiungiPromemoria(p, salva), /^Aggiunto a Da pagare per venerdì 30 ottobre/);
  assert.deepEqual(fatti[0], ['scadenza', { data: '2026-10-30', descrizione: 'Bollo auto', importo: 214.5, categoria: 'Auto', ricorrenza: 'annuale' }]);
  const conOra = promemoriaIniziale({ cosa: 'evento', titolo: 'Chiamare il commercialista', data: '2026-10-20', ora: '10:00' });
  assert.equal(await aggiungiPromemoria(conOra, salva), 'In agenda martedì 20 ottobre alle 10:00');
  assert.deepEqual([fatti[1][1].tutto_il_giorno, fatti[1][1].ora_inizio, fatti[1][1].ora_fine, fatti[1][1].tipo], [false, '10:00', '11:00', 'personale']);
  await aggiungiPromemoria(promemoriaIniziale({ cosa: 'evento', titolo: 'Compleanno Giulia', data: '2026-11-03' }), salva);
  assert.deepEqual([fatti[2][1].tutto_il_giorno, fatti[2][1].ora_inizio], [true, null]);
  await assert.rejects(aggiungiPromemoria({ ...conOra, data: '' }, salva), /Scegli la data/);
  await assert.rejects(aggiungiPromemoria({ ...conOra, titolo: ' ' }, salva), /Scrivi cosa ricordare/);
});

function scriptFinto(risposteGemini) {
  const chiamate = [];
  const proprieta = { API_PAUSA_FINO: String(Date.now() + 3600e3), GEMINI_API_KEY: 'k' };
  const ctx = {
    console, JSON, Date, Math, String, Number, Array, Object, RegExp, Error, encodeURIComponent, isFinite,
    PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => proprieta[k] ?? null, setProperty: (k, v) => { proprieta[k] = v; } }) },
    Utilities: { sleep: () => {}, formatDate: (d, _f, formato) => (formato === 'u' ? '7' : d.toISOString().slice(0, 10)) },
    UrlFetchApp: { fetch: (_url, o) => {
      chiamate.push(JSON.parse(o.payload));
      const r = risposteGemini.shift();
      return { getResponseCode: () => 200, getContentText: () => JSON.stringify({ candidates: [{ finishReason: 'STOP', content: { role: 'model', parts: r } }] }) };
    } },
  };
  vm.createContext(ctx);
  vm.runInContext(codice, ctx);
  ctx.sb_ = () => [];
  ctx.logErrore_ = () => {};
  ctx.claudeInPausa_ = () => true;
  return { ctx, chiamate };
}

test('script: assistente personale con l\'agenda nella domanda e promemoria proposti, non salvati', () => {
  const { ctx, chiamate } = scriptFinto([
    [{ functionCall: { name: 'proponi_promemoria', args: { cosa: 'pagamento', titolo: 'Bollo auto', data: '2026-10-30', importo: 214.5, ricorrenza: 'annuale', categoria: 'Auto' } } }],
    [{ text: 'Ci penso io: tocca Aggiungi per segnare il bollo.' }],
  ]);
  const r = ctx.chiediPoliedron_({ domanda: 'Ricordami il bollo il 30', agenda: 'domenica 18 ottobre (2026-10-18): libero' });
  assert.equal(r.risposta, 'Ci penso io: tocca Aggiungi per segnare il bollo.');
  assert.deepEqual(JSON.parse(JSON.stringify(r.proposte)), [{ tipo: 'promemoria', cosa: 'pagamento', titolo: 'Bollo auto', data: '2026-10-30', ora: null, ora_fine: null, importo: 214.5, categoria: 'Auto', ricorrenza: 'annuale', note: null }]);
  const istruzioni = chiamate[0].systemInstruction.parts[0].text;
  assert.match(istruzioni, /Sei Poliedron, l'assistente personale di Luca Simondi/);
  assert.match(istruzioni, /Oggi è domenica \d{4}-\d{2}-\d{2}/);
  assert.match(istruzioni, /non i pazienti/);
  assert.match(chiamate[0].contents.at(-1).parts[0].text, /\[Agenda di Luca\]\ndomenica 18 ottobre \(2026-10-18\): libero$/);
  assert.ok(chiamate[0].tools[0].functionDeclarations.some((f) => f.name === 'proponi_promemoria'));
});

test('script: promemoria controllati (data obbligatoria, ora solo per gli eventi, al massimo 5)', () => {
  const { ctx } = scriptFinto([]);
  const c = { proposte: [] };
  assert.match(ctx.strumentoChat_('proponi_promemoria', { cosa: 'evento', titolo: 'X', data: 'domani' }, c).errore, /YYYY-MM-DD/);
  ctx.strumentoChat_('proponi_promemoria', { cosa: 'evento', titolo: 'Dentista Giulia', data: '2026-10-21', ora: '16:00', importo: 50, ricorrenza: 'ogni tanto' }, c);
  assert.deepEqual([c.proposte[0].ora, c.proposte[0].importo, c.proposte[0].ricorrenza], ['16:00', null, null]);
  for (let i = 0; i < 6; i += 1) ctx.strumentoChat_('proponi_promemoria', { cosa: 'pagamento', titolo: 'P', data: '2026-11-01', ora: '10:00' }, c);
  assert.equal(c.proposte.length, 5);
  assert.equal(c.proposte[1].ora, null);
});
