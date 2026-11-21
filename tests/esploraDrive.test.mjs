// PERSONAL-ESPLORA-WIN11 fase 2 (Code.gs): Esplora file allinea Drive subito.
// moveTo nella gemella (mai copie o cancellazioni), drive_fissa + drive_cartella, email senza file,
// nota '>cartella:<id>' e recupero al giro successivo; gemelle create e allineate subito.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const codice = readFileSync('poliedron/archivio/Code.gs', 'utf8');
const U = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

function scriptFinto({ docs = [], cartelle = [], driveGiu = false } = {}) {
  const patch = []; const mosse = []; const create = []; const rinomine = [];
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
        return { moveTo: (c) => mosse.push(['file', id, c.getId()]) };
      },
      createFolder: () => { throw new Error('la radice esiste'); },
    },
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
      if (inn) return docs.filter((d) => inn[1].split(',').includes(d.id));
      if (percorso.includes('drive_cartella=like.')) return docs.filter((d) => String(d.drive_cartella || '').startsWith('>cartella:'));
    }
    return [];
  };
  return { ctx, patch, mosse, create, rinomine, cartelleDrive };
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
  assert.deepEqual(JSON.parse(JSON.stringify(s.patch[0][1])), { drive_fissa: true, drive_cartella: `>cartella:${U(1)}` });
  assert.deepEqual(JSON.parse(JSON.stringify(s.ctx.spostaDocumentiDrive_({ ids: [U(10)], cartella_id: '../x' }))), { ok: false, errore: 'Cartella non valida' });
});

test('Personale = Archivio personale; Drive giù: resta «da spostare» e il giro dopo lo rifà', () => {
  const docs = [{ id: U(20), drive_file_id: 'f20', mime_type: 'image/jpeg' }, { id: U(21), drive_file_id: 'sparito', mime_type: 'application/pdf' }];
  const giu = scriptFinto({ docs, driveGiu: true });
  const r = giu.ctx.spostaDocumentiDrive_({ ids: [U(20), U(21)], cartella_id: 'radice' });
  assert.equal(r.errori.length, 2);
  assert.deepEqual(docs.map((d) => d.drive_cartella), ['>cartella:radice', '>cartella:radice']);
  const su = scriptFinto({ docs });
  assert.equal(su.ctx.recuperaSpostamenti_(Date.now() + 60000), false);
  assert.deepEqual(su.mosse, [['file', 'f20', 'radice-drive']]);
  assert.deepEqual(docs.map((d) => d.drive_cartella), ['cartella:radice', '!cartella:radice']); // il file sparito non si riprova
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
