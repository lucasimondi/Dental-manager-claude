// POL-VITA-003 — Poliedron Personal: documenti caricati dall'app e Portafoglio.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { caricaDocumento, impostaPortafoglio, portafoglio, eCaricato, nelPortafoglio, URL_CARICAMENTO } from '../personal/src/lib/archivio.js';

const codeGs = readFileSync('poliedron/archivio/Code.gs', 'utf8');
const doPost = codeGs.slice(codeGs.indexOf('function doPost('), codeGs.indexOf('function utenteSupabase_('));

function clientFinto(dati) {
  const chiamate = [];
  return {
    chiamate,
    from(tabella) {
      const q = { tabella, filtri: [] };
      chiamate.push(q);
      const catena = new Proxy({}, { get(_t, m) {
        if (m === 'then') return (ok) => Promise.resolve({ data: dati, error: null }).then(ok);
        return (...a) => { q.filtri.push([m, ...a]); return catena; };
      } });
      return catena;
    },
  };
}

test('caricamento: invia file e scelte allo script con il token di sessione, senza preflight', async () => {
  let richiesta;
  const fetchFinto = async (url, opzioni) => { richiesta = { url, ...opzioni }; return { json: async () => ({ ok: true, id: 'd9', titolo: 'Carta d\'identità', fascicolo: 'identita' }) }; };
  const r = await caricaDocumento({ token: 'jwt', dati: 'QUJD', nome: 'ci.jpg', mime: 'image/jpeg', descrizione: 'CI', fascicolo: 'identita', portafoglio: true }, fetchFinto);
  assert.equal(r.id, 'd9');
  assert.equal(richiesta.url, URL_CARICAMENTO);
  assert.match(URL_CARICAMENTO, /^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/);
  assert.equal(richiesta.method, 'POST');
  assert.match(richiesta.headers['Content-Type'], /^text\/plain/);
  assert.deepEqual(JSON.parse(richiesta.body), { token: 'jwt', dati: 'QUJD', nome: 'ci.jpg', mime: 'image/jpeg', descrizione: 'CI', fascicolo: 'identita', portafoglio: true, nonAnalizzare: false });
});

test('caricamento: errori chiari, mai un successo finto', async () => {
  await assert.rejects(caricaDocumento({ token: null, dati: 'x', nome: 'a' }, async () => { throw new Error('non deve partire'); }), /Sessione scaduta/);
  await assert.rejects(caricaDocumento({ token: 't', dati: 'x', nome: 'a' }, async () => ({ json: async () => ({ ok: false, errore: 'Accesso non autorizzato' }) })), /Accesso non autorizzato/);
  await assert.rejects(caricaDocumento({ token: 't', dati: 'x', nome: 'a' }, async () => ({ json: async () => { throw new Error('html'); } })), /Risposta non valida/);
});

test('portafoglio: documenti con il tag o d\'identità; il tag si mette e si toglie senza toccare gli altri', async () => {
  const db = clientFinto([]);
  await portafoglio(db);
  assert.deepEqual(db.chiamate[0].filtri.find((f) => f[0] === 'or'), ['or', 'tag.cs.{portafoglio},fascicolo.eq.identita']);

  const db2 = clientFinto({ id: 'd1' });
  await impostaPortafoglio(db2, { id: 'd1', tag: ['bolletta', 'luce'] }, true);
  await impostaPortafoglio(db2, { id: 'd1', tag: ['bolletta', 'portafoglio'] }, false);
  assert.deepEqual(db2.chiamate.map((q) => q.filtri.find((f) => f[0] === 'update')[1]), [{ tag: ['bolletta', 'luce', 'portafoglio'] }, { tag: ['bolletta'] }]);

  assert.equal(nelPortafoglio({ tag: ['portafoglio'] }), true);
  assert.equal(nelPortafoglio({ tag: null }), false);
  assert.equal(eCaricato({ gmail_message_id: 'caricato:123' }), true);
  assert.equal(eCaricato({ gmail_message_id: '18c2f' }), false);
});

test('script: il caricamento accetta solo il proprietario con email confermata, verificato a ogni richiesta', () => {
  assert.match(codeGs, /const PROPRIETARIO = 'luca\.simondi@gmail\.com';/);
  assert.match(doPost, /utenteSupabase_\(req\.token\)/);
  assert.match(doPost, /!utente \|\| String\(utente\.email\)\.toLowerCase\(\) !== PROPRIETARIO \|\| !utente\.email_confirmed_at/);
  assert.ok(doPost.indexOf('Accesso non autorizzato') < doPost.indexOf('base64Decode'), 'nessun file letto prima del controllo');
  assert.match(codeGs, /\/auth\/v1\/user/);
});

test('script: i documenti clinici caricati non vengono mai analizzati e restano nel fascicolo clinico', () => {
  assert.match(doPost, /const clinico = req\.fascicolo === 'clinico_pazienti' \|\| eClinico_\(meta, nome\);/);
  assert.match(doPost, /if \(req\.nonAnalizzare \|\| clinico\) \{\s*analisiContenuto = false;/);
  assert.ok(doPost.indexOf('if (req.nonAnalizzare || clinico)') < doPost.indexOf('analizza_('), 'il controllo precede l\'analisi');
  assert.match(doPost, /analisi\.fascicolo !== 'clinico_pazienti'\) analisi\.fascicolo = req\.fascicolo/);
});

test('script: file su Drive in Caricati, registrazione senza modifiche di schema, web app pubblicata', () => {
  assert.match(doPost, /sottocartella_\(cartellaRadice_\(\), CARTELLA_CARICATI\)/);
  assert.match(doPost, /gmail_message_id: 'caricato:' \+ Utilities\.getUuid\(\)/);
  assert.match(doPost, /sb_\('rpc\/registra_documento'/);
  const manifest = JSON.parse(readFileSync('poliedron/archivio/appsscript.json', 'utf8'));
  assert.deepEqual(manifest.webapp, { executeAs: 'USER_DEPLOYING', access: 'ANYONE_ANONYMOUS' });
});

test('app: login con password che resta valido sulla Home e recupero password via link', () => {
  const app = readFileSync('personal/src/App.jsx', 'utf8');
  const client = readFileSync('personal/src/lib/supabasePersonal.js', 'utf8');
  assert.match(client, /persistSession: true/);
  assert.match(client, /flowType: 'implicit'/);
  assert.match(app, /signInWithPassword/);
  assert.match(app, /resetPasswordForEmail\(email\.trim\(\), \{ redirectTo: INDIRIZZO_APP\(\) \}\)/);
  assert.match(app, /const INDIRIZZO_APP = \(\) => `\$\{location\.origin\}\$\{location\.pathname\}`;/);
  assert.match(app, /evento === 'PASSWORD_RECOVERY'/);
  assert.match(app, /auth\.updateUser\(\{ password \}\)/);
  assert.doesNotMatch(app, /signInWithOtp|signUp\(/, 'niente link magici né nuove registrazioni');
});

test('dominio proprio: personal.poliedrasoft.it porta a Poliedron Personal con il suo manifest', () => {
  const vercel = JSON.parse(readFileSync('vercel.json', 'utf8'));
  const redirect = (vercel.redirects || []).find((r) => r.source === '/' && r.has?.some((h) => h.type === 'host' && h.value === 'personal.poliedrasoft.it'));
  assert.ok(redirect, 'la radice del dominio proprio deve portare all\'app (i file statici vincono sulle rewrite)');
  assert.equal(redirect.destination, '/personal/');
  assert.equal(redirect.permanent, false);
  const m = JSON.parse(readFileSync('public/personal-dominio.webmanifest', 'utf8'));
  assert.equal(m.start_url, '/personal/');
  assert.equal(m.scope, '/personal/');
  assert.equal(m.name, 'Poliedron Personal');
  assert.match(readFileSync('personal/index.html', 'utf8'), /location\.hostname === 'personal\.poliedrasoft\.it'[\s\S]*\/personal-dominio\.webmanifest/);
});
