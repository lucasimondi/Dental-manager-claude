// PERSONAL-ESPLORA-WIN11 fase 2 (Code.gs): Esplora file allinea Drive subito.
// moveTo nella gemella (mai copie o cancellazioni), drive_fissa + drive_cartella, email senza file,
// nota '>cartella:<id>' e recupero al giro successivo; gemelle create e allineate subito.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const codice = readFileSync('poliedron/archivio/Code.gs', 'utf8');
const U = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

function scriptFinto({ docs = [], cartelle = [], driveGiu = false, permessi = [] } = {}) {
  const patch = []; const mosse = []; const create = []; const rinomine = []; const permChiamate = [];
  const cartelleDrive = { 'radice-drive': { nome: 'Archivio personale', padre: null } };
  const cartella = (id) => ({
    getId: () => id, getName: () => cartelleDrive[id].nome, isTrashed: () => false,
    setName: (n) => { rinomine.push([id, n]); cartelleDrive[id].nome = n; },
    getParents: () => { let dato = false; return { hasNext: () => !dato && !!cartelleDrive[id].padre, next: () => { dato = true; return cartella(cartelleDrive[id].padre); } }; },
    moveTo: (p) => { mosse.push(['cartella', id, p.getId()]); cartelleDrive[id].padre = p.getId(); },
    createFolder: (n) => { const nid = `drv-${n}`; cartelleDrive[nid] = { nome: n, padre: id }; create.push([n, id]); return cartella(nid); },
  });
  const ctx = {
    console, JSON, Date, Math, String, Number, Array, Object, RegExp, Error, encodeURIComponent,
    PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => (k === 'DRIVE_ROOT_ID' ? 'radice-drive' : null), setProperty() {} }) },
    Utilities: { formatDate: (d) => d.toISOString().slice(0, 10) },
    DriveApp: {
      getFolderById: (id) => { if (!cartelleDrive[id]) throw new Error('not found'); return cartella(id); },
      getFileById: (id) => {
        if (driveGiu) throw new Error('Servizio Drive non disponibile');
        if (id === 'sparito') throw new Error('File non trovato');
        return { moveTo: (c) => mosse.push(['file', id, c.getId()]), getName: () => 'vecchio nome.pdf', setName: (n) => rinomine.push([id, n]), getUrl: () => `https://drive/${id}` };
      },
      createFolder: () => { throw new Error('la radice esiste'); },
    },
    Drive: { Permissions: {
      list: () => ({ permissions: permessi.slice() }),
      create: (r, fid, o) => { permChiamate.push(['crea', r, fid, o || null]); permessi.push({ id: `p${permessi.length}`, type: r.type, role: r.role, emailAddress: r.emailAddress }); },
      remove: (fid, id) => { permChiamate.push(['togli', id]); permessi.splice(permessi.findIndex((p) => p.id === id), 1); },
    } },
  };
  vm.createContext(ctx);
  vm.runInContext(codice, ctx);
  ctx.logErrore_ = () => {};
  ctx.sb_ = (percorso, o = {}) => {
    if (o.method === 'patch') {
      patch.push([percorso, o.body]);
      const m = percorso.match(/^cartelle_mie\?id=eq\.(.+)$/);
      if (m) Object.assign(cartelle.find((c) => c.id === decodeURIComponent(m[1])), o.body);
      const d = percorso.match(/^documenti\?id=eq\.(.+)$/);
      if (d) Object.assign(docs.find((x) => x.id === d[1]), o.body);
      const molti = percorso.match(/^documenti\?id=in\.\(([^)]*)\)$/);
      if (molti) docs.filter((x) => molti[1].split(',').includes(x.id)).forEach((x) => Object.assign(x, o.body));
      return null;
    }
    if (percorso.startsWith('cartelle_mie?')) {
      const id = percorso.match(/id=eq\.([^&]+)/);
      if (id) return cartelle.filter((c) => c.id === decodeURIComponent(id[1]));
      if (percorso.includes('drive_cartella_id=is.null')) return cartelle.filter((c) => !c.drive_cartella_id && !c.archiviata_il);
      return cartelle.filter((c) => c.drive_cartella_id);
    }
    if (percorso.startsWith('documenti?')) {
      const inn = percorso.match(/id=in\.\(([^)]*)\)/);
      if (inn) return docs.filter((d) => inn[1].split(',').includes(d.id)).map((d) => ({ ...d })); // copie, come la rete
      if (percorso.includes('drive_cartella=like.')) return docs.filter((d) => String(d.drive_cartella || '').startsWith('>cartella:'));
      const uno = percorso.match(/&id=eq\.([^&]+)$/);
      if (uno) return docs.filter((d) => d.id === uno[1]);
    }
    return [];
  };
  return { ctx, patch, mosse, create, rinomine, cartelleDrive, permChiamate };
}

test('sposta_documenti: file nella gemella, fissati lì; email senza file; non trovati; id non validi scartati', () => {
  const casa = { id: U(1), nome: 'Casa', padre_id: null, drive_cartella_id: null };
  const docs = [
    { id: U(10), drive_file_id: 'f10', mime_type: 'application/pdf' },
    { id: U(11), drive_file_id: null, mime_type: 'message/rfc822' },
  ];
  const s = scriptFinto({ docs, cartelle: [casa] });
  const r = JSON.parse(JSON.stringify(s.ctx.spostaDocumentiDrive_({ ids: [U(10), U(11), U(12), 'x;drop'], cartella_id: U(1) })));
  assert.deepEqual(r, { ok: true, spostati: [U(10)], senza_file: [U(11)], non_trovati: [U(12)], errori: [] });
  assert.deepEqual(s.create, [['Casa', 'radice-drive']]); // la gemella nasce adesso
  assert.deepEqual(s.mosse, [['file', 'f10', 'drv-Casa']]);
  assert.deepEqual(docs.map((d) => [d.drive_fissa, d.drive_cartella]), [[true, `cartella:${U(1)}`], [true, `cartella:${U(1)}`]]);
  // prima la nota «da spostare», poi la posizione definitiva
  const primaSuDoc = s.patch.find(([p]) => p === `documenti?id=eq.${U(11)}` || p === `documenti?id=eq.${U(10)}`);
  assert.deepEqual(JSON.parse(JSON.stringify(s.patch.filter(([p]) => p === `documenti?id=eq.${U(10)}`)[0][1])), { drive_fissa: true, drive_cartella: `>cartella:${U(1)}` });
  assert.ok(primaSuDoc);
  assert.deepEqual(JSON.parse(JSON.stringify(s.ctx.spostaDocumentiDrive_({ ids: [U(10)], cartella_id: '../x' }))), { ok: false, errore: 'Cartella non valida' });
});

test('Personale = Archivio personale; Drive giù: niente resta a metà, il documento torna com\'era', () => {
  const docs = [{ id: U(20), drive_file_id: 'f20', mime_type: 'image/jpeg', drive_fissa: false, drive_cartella: 'Utenze/2026' }];
  const giu = scriptFinto({ docs, driveGiu: true });
  const r = giu.ctx.spostaDocumentiDrive_({ ids: [U(20)], cartella_id: 'radice' });
  assert.equal(r.errori.length, 1);
  assert.deepEqual([docs[0].drive_fissa, docs[0].drive_cartella], [false, 'Utenze/2026']);
});

test('recupero al giro: una nota «da spostare» rimasta da un\'interruzione si rifà; file sparito non si riprova', () => {
  const docs = [{ id: U(20), drive_file_id: 'f20', mime_type: 'image/jpeg', drive_cartella: '>cartella:radice' }, { id: U(21), drive_file_id: 'sparito', mime_type: 'application/pdf', drive_cartella: '>cartella:radice' }];
  const su = scriptFinto({ docs });
  assert.equal(su.ctx.recuperaSpostamenti_(Date.now() + 60000), false);
  assert.deepEqual(su.mosse, [['file', 'f20', 'radice-drive']]);
  assert.deepEqual(docs.map((d) => d.drive_cartella), ['cartella:radice', '!cartella:radice']);
});

test('cartella_drive: crea la gemella dentro quella del padre, poi segue nome e padre', () => {
  const cartelle = [{ id: U(1), nome: 'Casa', padre_id: null, drive_cartella_id: null }, { id: U(2), nome: 'Utenze', padre_id: U(1), drive_cartella_id: null }];
  const s = scriptFinto({ cartelle });
  assert.deepEqual(JSON.parse(JSON.stringify(s.ctx.allineaCartella_(U(2)))), { ok: true, drive_cartella_id: 'drv-Utenze' });
  assert.deepEqual(s.create, [['Casa', 'radice-drive'], ['Utenze', 'drv-Casa']]);
  // rinominata e spostata in cima nell'app → subito anche su Drive
  cartelle[1].nome = 'Bollette'; cartelle[1].padre_id = null;
  s.ctx.allineaCartella_(U(2));
  assert.deepEqual(s.rinomine, [['drv-Utenze', 'Bollette']]);
  assert.deepEqual(s.mosse, [['cartella', 'drv-Utenze', 'radice-drive']]);
  assert.equal(s.ctx.allineaCartella_('nonuuid').ok, false);
});

test('il giro crea le gemelle mancanti (se l’app non ci è riuscita); ordinaDrive_ ignora i file fissati', () => {
  const cartelle = [{ id: U(3), nome: 'Auto', padre_id: null, drive_cartella_id: null }, { id: U(4), nome: 'Vecchia', padre_id: null, drive_cartella_id: null, archiviata_il: '2026-01-01' }];
  const s = scriptFinto({ cartelle });
  s.ctx.allineaCartelleDrive_();
  assert.deepEqual(s.create, [['Auto', 'radice-drive']]);
  assert.match(codice, /drive_fissa=is\.false/);
});

test('doPost espone cartella_drive e sposta_documenti dopo il controllo del proprietario', () => {
  const i = codice.indexOf('function doPost(');
  const corpo = codice.slice(i, codice.indexOf('\n}\n', i));
  const controllo = corpo.indexOf('Accesso non autorizzato');
  assert.ok(controllo > 0 && corpo.indexOf("'cartella_drive'") > controllo && corpo.indexOf("'sposta_documenti'") > controllo);
});

test('rinomina_file: stesso file su Drive, estensione mantenuta, il nome scelto resta', () => {
  const docs = [{ id: U(30), drive_file_id: 'f30', mime_type: 'application/pdf', titolo: 'Vecchio' }, { id: U(31), drive_file_id: null, mime_type: 'message/rfc822', titolo: 'Email' }];
  const s = scriptFinto({ docs });
  assert.deepEqual(JSON.parse(JSON.stringify(s.ctx.rinominaFileEsplora_({ id: U(30), nome: 'Contratto / luce' }))), { ok: true, nome: 'Contratto - luce.pdf' });
  assert.deepEqual(s.rinomine, [['f30', 'Contratto - luce.pdf']]);
  assert.equal(docs[0].drive_rinomina, false);
  assert.equal(s.ctx.rinominaFileEsplora_({ id: U(31), nome: 'X' }).senza_file, true);
  assert.equal(s.ctx.rinominaFileEsplora_({ id: U(30), nome: '  ' }).ok, false);
  assert.throws(() => s.ctx.rinominaFileEsplora_({ id: 'x', nome: 'a' }));
});

test('accesso_file: persone senza email di notifica, link pubblico mai per i pazienti, il proprietario non si toglie', () => {
  const docs = [{ id: U(40), drive_file_id: 'f40', mime_type: 'application/pdf', fascicolo: 'utenze' }, { id: U(41), drive_file_id: 'f41', mime_type: 'application/pdf', fascicolo: 'clinico_pazienti' }];
  const permessi = [{ id: 'own', type: 'user', role: 'owner', emailAddress: 'io@example.com' }];
  const s = scriptFinto({ docs, permessi });
  let r = s.ctx.accessoEsplora_({ id: U(40), operazione: 'aggiungi', email: 'Anna@Example.com', ruolo: 'writer' });
  assert.equal(r.ok, true);
  assert.deepEqual(JSON.parse(JSON.stringify(s.permChiamate[0])), ['crea', { type: 'user', role: 'writer', emailAddress: 'anna@example.com' }, 'f40', { sendNotificationEmail: false }]);
  assert.equal(s.ctx.accessoEsplora_({ id: U(40), operazione: 'aggiungi', email: 'non valida' }).ok, false);
  r = s.ctx.accessoEsplora_({ id: U(40), operazione: 'link', attivo: true });
  assert.ok(r.permessi.some((p) => p.tipo === 'anyone' && p.ruolo === 'reader'));
  r = s.ctx.accessoEsplora_({ id: U(40), operazione: 'link', attivo: false });
  assert.ok(!r.permessi.some((p) => p.tipo === 'anyone'));
  assert.match(s.ctx.accessoEsplora_({ id: U(41), operazione: 'link', attivo: true }).errore, /pazienti/);
  assert.equal(s.ctx.accessoEsplora_({ id: U(40), operazione: 'togli', permesso: 'own' }).ok, false);
  assert.equal(s.ctx.accessoEsplora_({ id: U(40), operazione: 'boh' }).ok, false);
});

test('doPost: le nuove azioni del menu dopo il controllo del proprietario', () => {
  const i = codice.indexOf('function doPost(');
  const corpo = codice.slice(i, codice.indexOf('\n}\n', i));
  const controllo = corpo.indexOf('Accesso non autorizzato');
  for (const a of ['rinomina_file', 'proprieta_file', 'accesso_file']) assert.ok(corpo.indexOf(`'${a}'`) > controllo, a);
});

// PR #337 §5: Cestino dell'app, ripristino di una versione, nuovo Documento / Foglio Google.
test('ripristina_file: solo file registrati in archivio tornano fuori dal Cestino di Drive', () => {
  const docs = [{ id: U(50), drive_file_id: 'f50registrato' }];
  const s = scriptFinto({ docs });
  const tolti = [];
  s.ctx.DriveApp.getFileById = (id) => ({ setTrashed: (v) => tolti.push([id, v]) });
  s.ctx.sb_ = (p) => (p.startsWith('documenti?select=drive_file_id') ? docs.filter((d) => p.includes(d.drive_file_id)).map((d) => ({ drive_file_id: d.drive_file_id })) : []);
  const r = JSON.parse(JSON.stringify(s.ctx.ripristinaFileEsplora_(['f50registrato', 'fAltroFileDrive', 'x'])));
  assert.deepEqual(r, { ok: true, ripristinati: ['f50registrato'], non_trovati: ['fAltroFileDrive'] });
  assert.deepEqual(tolti, [['f50registrato', false]]);
});

test('ripristina_versione: mai per Documenti/Fogli Google; versione non valida rifiutata', () => {
  const docs = [{ id: U(60), drive_file_id: 'f60', mime_type: 'application/vnd.google-apps.document' }, { id: U(61), drive_file_id: 'f61', mime_type: 'application/pdf' }];
  const s = scriptFinto({ docs });
  assert.match(s.ctx.ripristinaVersioneEsplora_({ id: U(60), versione: 'v1' }).errore, /Documenti e Fogli Google/);
  assert.match(s.ctx.ripristinaVersioneEsplora_({ id: U(61), versione: 'v1/../x' }).errore, /non valida/);
});

test('doPost PR #337 §5: crea_file, ripristina_file, ripristina_versione dopo il controllo del proprietario', () => {
  const i = codice.indexOf('function doPost(');
  const corpo = codice.slice(i, codice.indexOf('\n}\n', i));
  const controllo = corpo.indexOf('Accesso non autorizzato');
  for (const a of ['crea_file', 'nuovo_file', 'ripristina_file', 'ripristina_versione']) assert.ok(corpo.indexOf(`'${a}'`) > controllo, a);
  // il nuovo file nasce nella gemella, si registra e non va mai a un modello
  const f = codice.slice(codice.indexOf('function creaFileEsplora_'), codice.indexOf('function ripristinaFileEsplora_'));
  assert.match(f, /cartellaDriveDi_\(idCartella\)/);
  assert.match(f, /rpc\/registra_documento/);
  assert.match(f, /analisi_contenuto: false/);
  assert.doesNotMatch(f, /analizza_\(|gemini_\(|modello_\(/);
});

// PR #337 (PO 2026-11-22: «Duplica crea una vera copia del file»)
test('duplica_file: copia vera su Drive accanto all\'originale, registrata con lo stesso catalogo, mai a un modello', () => {
  const docs = [{ id: U(70), drive_file_id: 'f70', mime_type: 'application/pdf', titolo: 'Rogito', fascicolo: 'immobili', tag: ['casa', 'cestino'], ente: 'Notaio' }];
  const s = scriptFinto({ docs });
  const copie = []; const registrati = []; const patch = []; const messi = [];
  const padre = { getId: () => 'cartella-padre' };
  s.ctx.DriveApp.getFileById = () => ({
    getName: () => 'Rogito.pdf', getParents: () => { let x = false; return { hasNext: () => !x, next: () => { x = true; return padre; } }; },
    makeCopy: (nome, dove) => { copie.push([nome, dove.getId()]); return { getId: () => 'copia70', getUrl: () => 'https://drive/copia70', setTrashed() {} }; },
  });
  s.ctx.Utilities.getUuid = () => 'u';
  s.ctx.mettiInCartella_ = (c, d) => messi.push([c, d]);
  s.ctx.sb_ = (p, o = {}) => {
    if (p === 'rpc/registra_documento') { registrati.push(o.body.p); return { documento_id: U(71) }; }
    if (o.method === 'patch') { patch.push([p, o.body]); return null; }
    if (p.startsWith('documenti?')) return docs.map((d) => ({ ...d }));
    return [];
  };
  const r = JSON.parse(JSON.stringify(s.ctx.duplicaFileEsplora_({ id: U(70) })));
  assert.deepEqual(r, { ok: true, id: U(71), drive_file_id: 'copia70', titolo: 'Rogito - Copia' });
  assert.deepEqual(copie, [['Rogito - Copia.pdf', 'cartella-padre']]);
  assert.equal(registrati[0].hash_sha256, 'copia:copia70');
  assert.equal(registrati[0].fascicolo, 'immobili');
  assert.deepEqual(registrati[0].tag, ['casa']);
  assert.equal(registrati[0].analisi_contenuto, false);
  assert.equal(patch[0][1].drive_fissa, true);
  assert.deepEqual(messi, []);
  const f = codice.slice(codice.indexOf('function duplicaFileEsplora_'), codice.indexOf('// Cestino dell\'app: «Ripristina»'));
  assert.doesNotMatch(f, /analizza_\(|gemini_\(|modello_\(/);
  const i = codice.indexOf('function doPost(');
  const corpo = codice.slice(i, codice.indexOf('\n}\n', i));
  assert.ok(corpo.indexOf("'duplica_file'") > corpo.indexOf('Accesso non autorizzato'));
});

// SCAN-GOOGLE-OFFICE (PO 2026-11-24): Nuovo ▸ Presentazione / Modulo Google e Word / Excel / PowerPoint.
test('crea_file: Google (anche Presentazione e Modulo) e Office dal servizio Drive già autorizzato; Office via copia temporanea nel Cestino', () => {
  const s = scriptFinto();
  const creati = []; const cestinati = []; const registrati = []; const export_ = [];
  s.ctx.CONFIG = { ...(s.ctx.CONFIG || {}), FUSO: 'Europe/Rome' };
  s.ctx.Utilities.getUuid = () => 'u';
  s.ctx.ScriptApp = { getOAuthToken: () => 'tok' };
  s.ctx.Drive.Files = { create: (r, blob) => { const id = `nuovo${creati.length}`; creati.push({ ...r, blob: blob ? blob.tipo : null }); return { id }; } };
  s.ctx.UrlFetchApp = { fetch: (url) => { export_.push(url); return { getResponseCode: () => 200, getBlob: () => ({ tipo: 'office', setContentType(m) { this.tipo = m; return this; }, getBytes: () => [1, 2, 3] }) }; } };
  const vecchio = s.ctx.DriveApp.getFileById;
  s.ctx.DriveApp.getFileById = (id) => ({ ...vecchio(id), setTrashed: (v) => cestinati.push([id, v]) });
  s.ctx.sb_ = (p, o = {}) => { if (p === 'rpc/registra_documento') { registrati.push(o.body.p); return { documento_id: `d${registrati.length}` }; } return null; };
  const p = s.ctx.creaFileEsplora_({ tipo: 'presentazione', nome: '', cartella: 'radice' });
  assert.equal(p.ok, true);
  assert.deepEqual(JSON.parse(JSON.stringify(creati[0])), { name: 'Nuova presentazione', mimeType: 'application/vnd.google-apps.presentation', parents: ['radice-drive'], blob: null });
  assert.equal(registrati[0].tipo_documento, 'Presentazione');
  assert.equal(registrati[0].analisi_contenuto, false);
  assert.equal(s.ctx.creaFileEsplora_({ tipo: 'modulo' }).mime_type, 'application/vnd.google-apps.form');
  const w = s.ctx.creaFileEsplora_({ tipo: 'word', nome: 'Lettera.docx' });
  // copia temporanea Google, esportata in .docx e messa nel Cestino; il file vero nasce nella cartella
  assert.equal(creati[2].mimeType, 'application/vnd.google-apps.document');
  assert.match(export_[0], /\/export\?mimeType=application%2Fvnd\.openxmlformats-officedocument\.wordprocessingml\.document$/);
  assert.deepEqual(cestinati, [['nuovo2', true]], 'solo la copia temporanea va nel Cestino');
  assert.deepEqual([creati[3].name, creati[3].mimeType, creati[3].blob], ['Lettera.docx', w.mime_type, w.mime_type]);
  assert.deepEqual([registrati[2].nome_file_originale, registrati[2].titolo, registrati[2].dimensione_byte], ['Lettera.docx', 'Lettera', 3]);
  assert.equal(s.ctx.creaFileEsplora_({ tipo: 'excel' }).titolo, 'Nuovo foglio');
  assert.equal(creati.at(-1).name, 'Nuovo foglio.xlsx');
  assert.equal(s.ctx.creaFileEsplora_({ tipo: 'powerpoint' }).mime_type, 'application/vnd.openxmlformats-officedocument.presentationml.presentation');
  assert.equal(s.ctx.creaFileEsplora_({ tipo: 'inventato' }).mime_type, 'application/vnd.google-apps.document', 'tipo sconosciuto → Documento Google');
  assert.doesNotMatch(codice.slice(codice.indexOf('const NUOVI_FILE_'), codice.indexOf('function ripristinaFileEsplora_')), /FormApp|SlidesApp|analizza_\(|gemini_\(|modello_\(/, 'nessun permesso nuovo, nessun modello');
});
