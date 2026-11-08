// APP-UNICA (PO 2026-11-08): "Ok per poliedron, tema win togliamo, il più ok, cerca solo di farlo
// più pro e immediato e bello". Un dock solo, il + in agenda con il foglio «Crea», «Altro» con
// Lavoro e Vita, nessun tasto che rimbalza all'altra app.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readSectionLocation, sectionDestination, readSectionNew } from '../shared/agenda/navigation.js';
const read = (p) => readFileSync(p, 'utf8');

test('sezione diretta dall\'altra parte: solo un nome semplice passa nell\'indirizzo', () => {
  assert.equal(readSectionLocation('?sezione=conti'), 'conti');
  assert.equal(readSectionLocation('?sezione=../x'), null);
  assert.equal(readSectionLocation('?sezione=<script>'), null);
  assert.equal(readSectionNew('?sezione=paz&nuovo=1'), true);
  const studio = { hostname: 'dental-manager-acmeproduction.vercel.app', origin: 'https://dental-manager-acmeproduction.vercel.app' };
  // Nel browser del computer resta il dominio di Personal (desktop invariato).
  assert.equal(sectionDestination('personal', 'conti', studio), 'https://personal.poliedrasoft.it/?sezione=conti');
  const personal = { hostname: 'personal.poliedrasoft.it', origin: 'https://personal.poliedrasoft.it' };
  assert.equal(sectionDestination('studio', 'paz', personal, { nuovo: true }), 'https://personal.poliedrasoft.it/studio?sezione=paz&nuovo=1');
});

test('il + apre «Crea» in Studio e in Personal; ogni voce apre subito il suo modulo', () => {
  const sheet = read('shared/crea/CreaSheet.jsx');
  assert.match(sheet, /const scegli = \(voce\) => \{ onClose\(\); voce\.fai\(\); \};/);
  assert.match(sheet, /if \(trascina > 90\) onClose\(\)/, 'si chiude anche trascinando giù');
  assert.match(sheet, /role="dialog" aria-modal="true" aria-label="Crea"/);
  const studio = read('src/components/Agenda.jsx');
  assert.match(studio, /<CreaSheet aperto=\{creaAperto\}/);
  for (const id of ['appuntamento', 'paziente', 'incasso', 'spesa', 'impegno', 'nota', 'documento', 'password']) assert.match(studio, new RegExp(`id: '${id}'`), id);
  const personal = read('personal/src/sezioni/agenda/AgendaGriglia.jsx');
  assert.match(personal, /<CreaSheet aperto=\{creaAperto\}/);
  assert.match(personal, /sectionDestination\('studio', 'paz', globalThis\.location, \{ nuovo: true \}\)/);
  const app = read('src/App.jsx');
  assert.match(app, /nuovo: \(target\) => ultimi\.current\.goNuovoElemento\?\.\(target\)/);
  assert.match(app, /readSectionNew\(\) && NAV_BY_ID\[readSectionLocation\(\)\]/);
  assert.match(read('shared/note/NotePage.jsx'), /<textarea autoFocus=\{scriviSubito\}/);
  assert.match(read('shared/password/PasswordPage.jsx'), /useState\(nuovaSubito\)/);
});

test('un dock solo: Agenda · Note · Poliedron · Documenti · Altro, in Studio e in Personal', () => {
  const dock = read('src/components/poliedron/PoliedronMobileDock.jsx');
  assert.doesNotMatch(dock, /__personal__|agendaDestination/);
  assert.match(dock, /\{ id: 'altro', label: 'Altro', icon: 'more' \}/);
  const pApp = read('personal/src/App.jsx');
  assert.doesNotMatch(pApp, /Apri Studio|IconaStudio/);
  assert.match(read('personal/src/pro.css'), /\.pp-schede \{\n  grid-template-columns: repeat\(5, minmax\(0, 1fr\)\)/);
});

test('«Altro» uguale nelle due parti: Lavoro (studio) e Vita (personale)', () => {
  const app = read('src/App.jsx');
  assert.match(app, /page === 'altro' && <AltroPage gruppi=\{gruppiAltro\(\)\}/);
  assert.match(app, /nome: 'Lavoro · Studio'[\s\S]*nome: 'Vita · Personale'/);
  const p = read('personal/src/sezioni/altro/index.jsx');
  assert.match(p, /nome: 'Vita · Personale'[\s\S]*nome: 'Lavoro · Studio'/);
  assert.match(p, /href: sectionDestination\('studio', id\)/);
  assert.match(read('personal/src/App.jsx'), /if \(sezione\(readSectionLocation\(\)\)\) return readSectionLocation\(\);/);
});

test('nome dell\'app sul telefono: Poliedron', () => {
  assert.match(read('vite.config.js'), /name: 'Poliedron',\n\s+short_name: 'Poliedron',/);
  assert.match(read('index.html'), /<title>Poliedron<\/title>/);
});

test('passo 2: dentro l\'app Poliedron (/poliedron) Studio e Personal si aprono a vicenda senza uscire', async () => {
  const { appBase, agendaDestination } = await import('../shared/agenda/navigation.js');
  const L = (hostname, pathname) => ({ hostname, pathname, origin: `https://${hostname}` });
  const prod = 'dental-manager-acmeproduction.vercel.app';
  assert.equal(appBase('personal', L(prod, '/poliedron/')), '/poliedron/personal/');
  assert.equal(appBase('studio', L(prod, '/poliedron/personal/')), '/poliedron/');
  assert.equal(appBase('studio', L(prod, '/')), '/');
  assert.equal(appBase('personal', L(prod, '/'), { app: true }), '/personal/', 'aperta come app: stesso indirizzo');
  assert.equal(appBase('personal', L(prod, '/'), { app: false }), 'https://personal.poliedrasoft.it/', 'nel browser: come prima');
  assert.equal(appBase('studio', L('personal.poliedrasoft.it', '/personal/')), '/studio');
  assert.equal(agendaDestination('personal', '2026-11-09', 'settimana', L(prod, '/poliedron/')), `https://${prod}/poliedron/personal/?agenda=1&agendaDate=2026-11-09&agendaView=settimana`);
});

test('passo 2: un solo accesso — Personal riusa la sessione di Studio dello stesso indirizzo, salvo scollegamento', async () => {
  const { chiaveSessione, leggiSessioneSalvata, CHIAVE_SCOLLEGATO } = await import('../personal/src/lib/sessioneCondivisa.js');
  const chiave = chiaveSessione('https://abcdefgh.supabase.co');
  assert.equal(chiave, 'sb-abcdefgh-auth-token');
  const mem = new Map([[chiave, JSON.stringify({ access_token: 'a', refresh_token: 'r', user: { id: 'u' } })]]);
  assert.deepEqual(leggiSessioneSalvata({ getItem: (k) => mem.get(k) }, chiave), { access_token: 'a', refresh_token: 'r' });
  assert.equal(leggiSessioneSalvata({ getItem: () => '{rotto' }, chiave), null);
  assert.equal(leggiSessioneSalvata({ getItem: () => { throw new Error('bloccato'); } }, chiave), null);
  const src = read('personal/src/lib/studio.js');
  assert.match(src, /getItem\(CHIAVE_SCOLLEGATO\) === '1'\) return null/);
  assert.match(src, /nuova\?\.session\?\.user\?\.app_metadata\?\.studio_id \? nuova\.session : null/, 'solo con lo studio nel token');
  assert.equal(CHIAVE_SCOLLEGATO, 'poliedron-personal-studio-scollegato');
  assert.match(src, /export const CHIAVE_SESSIONE_STUDIO = chiaveSessione\(STUDIO_URL\);/, 'la chiave è quella del client di Studio');
});
