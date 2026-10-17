// POL-VITA-007 — riordino dell'archivio nello script: eseguito davvero in una VM con Supabase e
// Claude finti. Verifica cosa arriva al modello (mai i clinici) e cosa viene scritto.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const codice = readFileSync('poliedron/archivio/Code.gs', 'utf8');

function scriptFinto({ documenti, risposta }) {
  const patch = [];
  const alModello = [];
  const ctx = {
    console, JSON, Date, Math, String, Number, Array, Object, RegExp, Error,
    PropertiesService: { getScriptProperties: () => ({ getProperty: () => null, setProperty() {} }) },
  };
  vm.createContext(ctx);
  vm.runInContext(codice, ctx);
  ctx.sb_ = (percorso, opzioni = {}) => {
    if (!opzioni.method || opzioni.method === 'get') return percorso.startsWith('documenti?select=') ? documenti : [];
    if (opzioni.method === 'patch') patch.push({ percorso, corpo: opzioni.body });
    return null;
  };
  ctx.claude_ = (system, contenuto) => { alModello.push({ system, testo: contenuto.map((b) => b.text).join('\n') }); return JSON.stringify(risposta); };
  ctx.logErrore_ = () => {};
  return { ctx, patch, alModello };
}

const DOCS = [
  { id: 'd1', fascicolo: 'altro', tipo_documento: 'altro', titolo: 'Pubblicità OPT – calzature', riassunto: 'Volantino', email_mittente: 'OPT', nome_file_originale: 'flyer.jpg', tag: ['portafoglio'], gmail_message_id: 'm1', titolo_originale: null, fascicolo_originale: null },
  { id: 'd2', fascicolo: 'clinico_pazienti', titolo: 'OPT Rossi', riassunto: 'Documento clinico', gmail_message_id: 'm2' },
  { id: 'd3', fascicolo: 'identita', tipo_documento: 'documento di identità', titolo: 'CI Giulia', gmail_message_id: 'caricato:x', titolo_originale: null, fascicolo_originale: null },
];
const RISPOSTA = { documenti: [
  { id: 'd1', fascicolo: 'pubblicita', tipo_documento: 'pubblicità', titolo: 'Pubblicità – OPT Parker Store – calzature', ente: 'OPT Parker Store', rilevanza: 'bassa', tag: ['calzature', 'portafoglio'] },
  { id: 'd3', fascicolo: 'altro', tipo_documento: 'documento di identità', titolo: "Carta d'identità – Comune di Cuneo – Giulia Simondi", ente: 'Comune di Cuneo', rilevanza: 'alta', tag: ['identità'] },
] };

test('riordino: i documenti dei pazienti non arrivano al modello, vengono solo segnati', () => {
  const { ctx, patch, alModello } = scriptFinto({ documenti: DOCS, risposta: RISPOSTA });
  assert.equal(ctx.riordinaLotto_(), true);
  assert.equal(alModello.length, 1);
  assert.doesNotMatch(alModello[0].testo, /"d2"|Rossi|clinico/);
  assert.doesNotMatch(alModello[0].system, /clinico_pazienti =/);
  const d2 = patch.find((p) => p.percorso === 'documenti?id=eq.d2');
  assert.deepEqual(Object.keys(d2.corpo).sort(), ['rilevanza', 'riordinato_il']);
});

test('riordino: nuovo fascicolo, titolo, ente e rilevanza; titolo e fascicolo di prima conservati', () => {
  const { ctx, patch } = scriptFinto({ documenti: DOCS, risposta: RISPOSTA });
  ctx.riordinaLotto_();
  const d1 = patch.find((p) => p.percorso === 'documenti?id=eq.d1').corpo;
  assert.equal(d1.fascicolo, 'pubblicita');
  assert.equal(d1.fascicolo_originale, 'altro');
  assert.equal(d1.titolo, 'Pubblicità – OPT Parker Store – calzature');
  assert.equal(d1.titolo_originale, 'Pubblicità OPT – calzature');
  assert.equal(d1.ente, 'OPT Parker Store');
  assert.equal(d1.rilevanza, 'bassa');
  assert.deepEqual(d1.tag, ['portafoglio', 'calzature'], 'il tag dei Personali resta, senza doppioni');
  assert.ok(d1.riordinato_il);
});

test('riordino: i documenti caricati da Luca restano nel fascicolo che ha scelto', () => {
  const { ctx, patch } = scriptFinto({ documenti: DOCS, risposta: RISPOSTA });
  ctx.riordinaLotto_();
  const d3 = patch.find((p) => p.percorso === 'documenti?id=eq.d3').corpo;
  assert.equal(d3.fascicolo, 'identita');
  assert.equal(d3.rilevanza, 'alta');
});

test('riordino: il modello non può spostare un documento nel clinico né usare fascicoli inventati', () => {
  const risposta = { documenti: [{ ...RISPOSTA.documenti[0], fascicolo: 'clinico_pazienti' }, { ...RISPOSTA.documenti[1], id: 'd3', fascicolo: 'inventato' }] };
  const { ctx, patch } = scriptFinto({ documenti: [DOCS[0], { ...DOCS[2], gmail_message_id: 'm3' }], risposta });
  ctx.riordinaLotto_();
  assert.equal(patch.find((p) => p.percorso === 'documenti?id=eq.d1').corpo.fascicolo, 'altro');
  assert.equal(patch.find((p) => p.percorso === 'documenti?id=eq.d3').corpo.fascicolo, 'identita');
});

test('riordino: niente da fare → false; documento senza risposta → solo segnato', () => {
  assert.equal(scriptFinto({ documenti: [], risposta: RISPOSTA }).ctx.riordinaLotto_(), false);
  const { ctx, patch } = scriptFinto({ documenti: [DOCS[0]], risposta: { documenti: [] } });
  ctx.riordinaLotto_();
  assert.deepEqual(Object.keys(patch[0].corpo), ['riordinato_il']);
});

test('script: un lotto di riordino a ogni giro, catalogo completato anche per i nuovi e i caricati', () => {
  const elabora = codice.slice(codice.indexOf('function elabora()'), codice.indexOf('function elaboraThread_('));
  assert.match(elabora, /try \{ riordinaLotto_\(\); \}/);
  assert.equal((codice.match(/completaCatalogo_\(/g) || []).length, 4); // definizione + import + caricamento + analisi dei rimasti (POL-VITA-013)
  for (const f of ['formazione', 'personale_studio', 'corrispondenza', 'foto_video', 'pubblicita']) assert.match(codice, new RegExp(`\\b${f}: '`));
  assert.match(codice, /required: \[[^\]]*'ente', 'rilevanza'\]/);
});

test('limite di spesa dell\'API: pausa di un\'ora e RIPROVA, mai email segnate come errore', () => {
  const memoria = {};
  const ctx = {
    console, JSON, Date, Math, String, Number, Array, Object, RegExp, Error,
    PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => memoria[k] ?? null, setProperty: (k, v) => { memoria[k] = v; }, deleteProperty: (k) => { delete memoria[k]; } }) },
    UrlFetchApp: { fetch: () => ({ getResponseCode: () => 400, getContentText: () => '{"error":{"message":"You have reached your specified API usage limits."}}' }) },
    Utilities: { sleep() {} },
  };
  vm.createContext(ctx);
  vm.runInContext(codice, ctx);
  const errori = [];
  ctx.props_ = () => ({ ANTHROPIC_API_KEY: 'k' });
  ctx.logErrore_ = (rif) => errori.push(rif);
  assert.throws(() => ctx.claude_('s', [{ type: 'text', text: 'x' }], null), /RIPROVA/);
  assert.ok(Number(memoria.API_PAUSA_FINO) > Date.now());
  assert.equal(ctx.apiInPausa_(), true);
  assert.throws(() => ctx.claude_('s', [{ type: 'text', text: 'x' }], null), /RIPROVA/);
  assert.equal(errori.length, 1, 'un solo avviso nel registro, non uno per email');
  const elabora = codice.slice(codice.indexOf('function elabora()'), codice.indexOf('function elaboraThread_('));
  // POL-VITA-013: in pausa l'importazione continua senza Claude; si fermano solo riordino e analisi.
  assert.doesNotMatch(elabora, /if \(apiInPausa_\(\)\) return;\n {2}const lock/);
  assert.match(elabora, /if \(!apiInPausa_\(\)\) \{/);
  assert.match(codice, /function riprovaErrori\(\) \{\n {2}PropertiesService\.getScriptProperties\(\)\.deleteProperty\('API_PAUSA_FINO'\)/);
});
