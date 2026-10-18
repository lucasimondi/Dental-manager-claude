// PO 2026-10-18: "Ma se usassimo Gemini per analizzarli?" → "Gratuita". Con Claude in pausa
// l'analisi dei documenti passa a Gemini; mai i documenti dei pazienti.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const codice = readFileSync('poliedron/archivio/Code.gs', 'utf8');
const RISPOSTA = { fascicolo: 'utenze', tipo_documento: 'fattura', titolo: 'Fattura – Enel Energia – marzo 2018', riassunto: 'Bolletta luce.',
  data_documento: '2018-03-02', importo: 84.3, soggetti: [], scadenze: [], azione_richiesta: false, azione_descrizione: null,
  urgenza: 'bassa', pratica: { id_esistente: null, nuova_titolo: null }, tag: ['luce'], dati: [], ente: 'Enel Energia', rilevanza: 'normale' };

function scriptFinto({ claudePausa = true, chiave = 'k-gemini', risposte = [] } = {}) {
  const proprieta = { API_PAUSA_FINO: claudePausa ? String(Date.now() + 3600e3) : null, GEMINI_API_KEY: chiave };
  const chiamate = [], scritture = [], log = [];
  const ctx = {
    console, JSON, Date, Math, String, Number, Array, Object, RegExp, Error, encodeURIComponent,
    PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => proprieta[k] ?? null, setProperty: (k, v) => { proprieta[k] = v; } }) },
    Utilities: { sleep: () => {}, formatDate: (d) => d.toISOString().slice(0, 10), newBlob: () => ({ getDataAsString: () => 'Testo della bolletta' }), base64Encode: () => 'QUJD' },
    UrlFetchApp: {
      fetch: (url, o) => {
        chiamate.push({ url, headers: o.headers, body: JSON.parse(o.payload) });
        const r = risposte.length ? risposte.shift() : { code: 200, json: { candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(RISPOSTA) }] } }] } };
        return { getResponseCode: () => r.code, getContentText: () => (typeof r.json === 'string' ? r.json : JSON.stringify(r.json)) };
      },
    },
    DriveApp: { getFileById: () => ({ getBlob: () => ({ getBytes: () => [1, 2, 3] }), setName() {} }) },
    GmailApp: { getMessageById: () => ({ getPlainBody: () => 'Testo email' }) },
  };
  vm.createContext(ctx);
  vm.runInContext(codice, ctx);
  ctx.claude_ = () => assert.fail('Claude è in pausa: nessuna chiamata');
  ctx.logErrore_ = (rif, e) => log.push(rif + ': ' + e.message);
  ctx.praticheAperte_ = () => [];
  ctx.sb_ = (percorso, opzioni = {}) => {
    if (!opzioni.method) return percorso.startsWith('documenti?select=') ? ctx.__documenti || [] : [];
    scritture.push({ percorso, corpo: opzioni.body });
    return percorso.startsWith('rpc/completa_analisi') ? { ok: true, fascicolo: opzioni.body.p.fascicolo } : null;
  };
  return { ctx, proprieta, chiamate, scritture, log };
}

const meta = { oggetto: 'Bolletta luce', mittente: 'Enel', destinatari: '', data: new Date('2018-03-05T10:00:00Z'), corpo: '' };

test('Gemini: con Claude in pausa e la chiave impostata l\'analisi passa a Gemini, stesso JSON', () => {
  const { ctx, chiamate } = scriptFinto();
  assert.equal(ctx.apiInPausa_(), false, 'c\'è ancora un modello');
  const pdf = { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: 'JVBERi0=' } };
  const a = ctx.analizza_(meta, 'f.pdf', pdf, []);
  assert.equal(a.fascicolo, 'utenze');
  assert.equal(a.importo, 84.3);
  assert.equal(chiamate.length, 1);
  const c = chiamate[0];
  assert.match(c.url, /^https:\/\/generativelanguage\.googleapis\.com\/v1beta\/models\/gemini-flash-latest:generateContent$/);
  assert.equal(c.headers['x-goog-api-key'], 'k-gemini', 'chiave nell\'intestazione, mai nell\'indirizzo');
  assert.doesNotMatch(c.url, /key=/);
  assert.equal(c.body.generationConfig.responseMimeType, 'application/json');
  assert.deepEqual(JSON.parse(JSON.stringify(c.body.contents[0].parts[0])), { inline_data: { mime_type: 'application/pdf', data: 'JVBERi0=' } });
  assert.match(c.body.systemInstruction.parts[0].text, /archivista personale/);
});

test('Gemini: modello scelto nelle Proprietà; senza chiave si cataloga a regole come prima', () => {
  const a = scriptFinto();
  a.proprieta.GEMINI_MODELLO = 'gemini-x-flash';
  a.ctx.analizza_(meta, 'f.txt', { type: 'text', text: 'ciao' }, []);
  assert.match(a.chiamate[0].url, /models\/gemini-x-flash:generateContent/);
  const b = scriptFinto({ chiave: null });
  assert.equal(b.ctx.apiInPausa_(), true);
  assert.throws(() => b.ctx.modello_('s', [{ type: 'text', text: 'x' }]), /RIPROVA/);
  assert.equal(b.chiamate.length, 0);
});

test('Gemini: quota del giorno finita → pausa di 3 ore, si torna al catalogo a regole', () => {
  const { ctx, proprieta, log } = scriptFinto({ risposte: [{ code: 429, json: { error: { status: 'RESOURCE_EXHAUSTED', message: 'Quota exceeded for metric: generate_content_free_tier_requests, limit: GenerateRequestsPerDayPerProjectPerModel-FreeTier' } } }] });
  assert.throws(() => ctx.analizza_(meta, 'f.txt', null, []), /RIPROVA/);
  assert.ok(Number(proprieta.GEMINI_PAUSA_FINO) > Date.now() + 2.9 * 3600e3);
  assert.equal(ctx.apiInPausa_(), true);
  assert.match(log.join('\n'), /Gemini in pausa/);
});

test('Gemini: troppe richieste al minuto → attende e riprova; risposta bloccata → errore chiaro', () => {
  const a = scriptFinto({ risposte: [{ code: 429, json: { error: { message: 'Resource has been exhausted (requests per minute)' } } }] });
  assert.equal(a.ctx.analizza_(meta, 'f.txt', null, []).fascicolo, 'utenze');
  assert.equal(a.chiamate.length, 2);
  const b = scriptFinto({ risposte: [{ code: 200, json: { promptFeedback: { blockReason: 'SAFETY' }, candidates: [] } }] });
  assert.throws(() => b.ctx.analizza_(meta, 'f.txt', null, []), /Gemini non ha risposto \(SAFETY\)/);
});

test('Gemini: i documenti dei pazienti non arrivano mai; gli altri completati con completa_analisi', () => {
  const { ctx, chiamate, scritture } = scriptFinto();
  ctx.__documenti = [
    { id: 'p1', fascicolo: 'altro', email_oggetto: 'Referto OPT paziente', email_mittente: 'studio', nome_file_originale: 'opt.pdf', mime_type: 'application/pdf', drive_file_id: 'f1', gmail_message_id: 'm1', email_data: '2018-03-05T10:00:00Z' },
    { id: 'd2', fascicolo: 'utenze', email_oggetto: 'Bolletta', email_mittente: 'Enel', nome_file_originale: 'f.txt', mime_type: 'text/plain', drive_file_id: 'f2', gmail_message_id: 'm2', email_data: '2018-03-05T10:00:00Z' },
  ];
  ctx.analizzaRimasti_(Date.now() + 60e3);
  assert.equal(chiamate.length, 1);
  assert.doesNotMatch(JSON.stringify(chiamate), /Referto|opt\.pdf/);
  assert.equal(scritture.find((s) => s.percorso === 'documenti?id=eq.p1').corpo.fascicolo, 'clinico_pazienti');
  assert.deepEqual(scritture.filter((s) => s.percorso === 'rpc/completa_analisi').map((s) => s.corpo.p_id), ['d2']);
});

test('Gemini: niente chiavi nel codice, chat e bozze restano a Claude', () => {
  assert.doesNotMatch(codice, /AIza[0-9A-Za-z_-]{20,}/);
  assert.match(codice, /sp\.getProperty\('GEMINI_API_KEY'\)/);
  const chat = codice.slice(codice.indexOf('function chiediPoliedron_('), codice.indexOf('function claudeMessaggi_('));
  assert.doesNotMatch(chat, /gemini_|modello_\(/);
});
