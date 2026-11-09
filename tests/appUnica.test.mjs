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

test('DOCK-PER-TE: Agenda · Documenti · Poliedron · Studio · Per te, in Studio e in Personal', () => {
  const dock = read('src/components/poliedron/PoliedronMobileDock.jsx');
  assert.doesNotMatch(dock, /__personal__|agendaDestination|id: 'altro'|id: 'note'/);
  assert.match(dock, /\{ id: 'agenda'[^\n]*\n\s*\{ id: 'archivio'[^\n]*\n\s*\{ id: '__poliedron__'[^\n]*\n\s*\{ id: 'studio', label: 'Studio'[^\n]*\n\s*\{ id: 'perte', label: 'Per te'/);
  const pApp = read('personal/src/App.jsx');
  assert.match(pApp, /href=\{sectionDestination\('studio', 'studio'\)\}[^\n]*<span>Studio<\/span>/);
  assert.match(pApp, /<span>Per te<\/span>/);
  assert.doesNotMatch(pApp, /<span>Altro<\/span>/);
  assert.match(read('personal/src/sezioni/index.js'), /export const DOCK = \[agenda, documenti\];/);
  assert.match(read('personal/src/pro.css'), /\.pp-schede \{\n  grid-template-columns: repeat\(5, minmax\(0, 1fr\)\)/);
});

test('«Studio» raccoglie il lavoro, «Per te» la vita personale (uguale nelle due parti)', () => {
  const app = read('src/App.jsx');
  assert.match(app, /page === 'studio' && <AltroPage titolo="Studio" gruppi=\{gruppiStudio\(\)\}/);
  assert.match(app, /\(page === 'perte' \|\| page === 'altro'\) && <AltroPage titolo="Per te" gruppi=\{gruppiPerTe\(\)\}/);
  assert.match(app, /\['studio', 'perte'\]\.includes\(readSectionLocation\(\)\)/);
  for (const nome of ['Spese e pagamenti', 'Documenti personali', 'Foto', 'Note', 'Diario', 'Pratiche', 'Biblioteca']) {
    assert.match(app, new RegExp(`'${nome}'`));
    assert.match(read('personal/src/sezioni/altro/index.jsx'), new RegExp(`'${nome}'`));
  }
  const p = read('personal/src/sezioni/altro/index.jsx');
  assert.match(p, /nome: 'Per te'/);
  assert.doesNotMatch(p, /Lavoro · Studio/);
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

test('DOCK-PER-TE passo 3: + → Per te (Documento, Spesa, Foto, Nota, Password) in Studio e Personal', async () => {
  const { aggiungiPerTe } = await import('../shared/agenda/navigation.js');
  const L = { hostname: 'dental-manager-acmeproduction.vercel.app', pathname: '/poliedron/', origin: 'https://dental-manager-acmeproduction.vercel.app' };
  const url = new URL(aggiungiPerTe('spesa', L));
  assert.equal(url.pathname, '/poliedron/personal/');
  assert.equal(url.searchParams.get('sezione'), 'documenti');
  assert.equal(url.searchParams.get('aggiungi'), 'spesa');
  assert.throws(() => aggiungiPerTe('altro', L));
  const agenda = read('src/components/Agenda.jsx');
  assert.match(agenda, /\['documento', 'Documento', '#5D6979'\], \['spesa', 'Spesa', '#A8323E'\], \['foto', 'Foto', '#C23D78'\]\][^\n]*aggiungiPerTe\(id\)/);
  const foglio = read('personal/src/Aggiungi.jsx');
  for (const v of ['Scansiona', 'Scatta foto', 'Carica file', 'Apri e firma un PDF', 'Scansiona scontrino', 'Foto o file', 'Inserimento manuale', 'Fotocamera', 'Galleria']) assert.match(foglio, new RegExp(`'${v}'`));
  const app = read('personal/src/App.jsx');
  assert.match(app, /voceDaIndirizzo\(\)/);
  const ingressi = read('personal/src/lib/ingressi.js');
  assert.match(ingressi, /url\.searchParams\.get\('aggiungi'\)/);
  assert.match(ingressi, /spesaScontrino: \{[^\n]*tipo: 'spesaRicevuta', file/);
  assert.doesNotMatch(read('personal/src/sezioni/documenti/Documenti.jsx'), /Apri un PDF dal telefono/);
});

test('DOCK-PER-TE passo 3: ?aggiungi= si legge una volta e si toglie dall\'indirizzo', async () => {
  const { voceDaIndirizzo } = await import('../personal/src/lib/ingressi.js');
  const finta = (href) => { const w = { location: { href }, history: { replaceState: (_, __, u) => { w.location.href = String(u); } } }; return w; };
  const w = finta('https://x.it/personal/?sezione=documenti&aggiungi=spesa');
  assert.equal(voceDaIndirizzo(w), 'spesa');
  assert.equal(w.location.href, 'https://x.it/personal/?sezione=documenti');
  assert.equal(voceDaIndirizzo(w), null);
  assert.equal(voceDaIndirizzo(finta('https://x.it/personal/?aggiungi=elimina')), null);
});

test('STUDIO-BENTO: Studio e Per te a riquadri (grande, alta, media, piccola, pulsante); cercando, elenco', async () => {
  const src = read('shared/altro/AltroPage.jsx');
  assert.match(src, /!cerca && g\.voci\.some\(\(v\) => v\.taglia\)/);
  const { blocchiBento } = await import('../shared/altro/bento.js');
  const b = blocchiBento([{ taglia: 'grande' }, { taglia: 'media' }, { taglia: 'piccola' }, { taglia: 'piccola' }, { taglia: 'pulsante' }, {}]);
  assert.deepEqual(b.map((x) => [x.tipo, x.voci.length]), [['due', 2], ['tre', 2], ['fila', 1], ['tre', 1]]);
  const app = read('src/App.jsx');
  assert.match(app, /paz: \['grande', 'Schede, piani di cura e documenti'\]/);
  assert.match(app, /\.sort\(\(x, y\) => RANGO\[x\.taglia\] - RANGO\[y\.taglia\]\)/);
  assert.match(app, /id: 'vita-conti', nome: 'Spese e pagamenti', icona: 'conti', taglia: 'grande'/);
  assert.match(read('personal/src/sezioni/altro/index.jsx'), /\['personali', 'Documenti personali', 'personali', 'media'/);
});
