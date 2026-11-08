// DOCUMENTI-STUDIO (PO 2026-11-08): "si possano cercare documenti anche in studio e crearli".
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { acquisisciDocumento, validaFile, titoloDaFile, messaggioErroreDocumenti, cercaDocumentiStudio } from '../src/lib/documentiStudio.js';

const STUDIO = '11111111-1111-1111-1111-111111111111';
function finto({ erroreInsert = null } = {}) {
  const log = [];
  const db = {
    storage: { from: (b) => ({
      upload: async (path, file, opt) => { log.push(['upload', b, path, opt.contentType]); return { data: { path }, error: null }; },
      remove: async (paths) => { log.push(['remove', b, ...paths]); return { data: null, error: null }; },
    }) },
    from: (t) => ({ insert: (riga) => ({ select: () => ({ single: async () => { log.push(['insert', t, riga]); return erroreInsert ? { data: null, error: erroreInsert } : { data: { id: 'd1', ...riga }, error: null }; } }) }) }),
    rpc: async (fn, args) => { log.push(['rpc', fn, args]); return { data: [{ tabella: 'documenti_fiscali', id: '1', titolo: 'Fattura n. 12' }], error: null }; },
  };
  return { db, log };
}
const foto = { name: 'referto_panoramica.jpg', type: 'image/jpeg', size: 2048 };

test('file accettati: foto e PDF fino a 15 MB', () => {
  assert.deepEqual(validaFile(foto), { mime: 'image/jpeg', estensione: 'jpg' });
  assert.deepEqual(validaFile({ name: 'a.pdf', type: 'application/pdf', size: 10 }), { mime: 'application/pdf', estensione: 'pdf' });
  assert.throws(() => validaFile({ name: 'x.html', type: 'text/html', size: 10 }), /Formato non supportato/);
  assert.throws(() => validaFile({ name: 'x.jpg', type: 'image/jpeg', size: 16 * 1024 * 1024 }), /15 MB/);
  assert.equal(titoloDaFile('referto_panoramica.jpg'), 'referto panoramica');
});

test('acquisizione: file nella cartella dello studio, poi la riga; se la riga fallisce il file viene tolto', async () => {
  const ok = finto();
  const doc = await acquisisciDocumento(ok.db, { studioId: STUDIO, file: foto, titolo: '', tipo: 'referto', pazienteId: '7' }, () => 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
  const path = `${STUDIO}/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa.jpg`;
  assert.deepEqual(ok.log[0], ['upload', 'documenti-studio', path, 'image/jpeg']);
  assert.deepEqual(ok.log[1][2], { studio_id: STUDIO, titolo: 'referto panoramica', tipo: 'referto', file_path: path, mime: 'image/jpeg', dimensione: 2048, note: '', paziente_id: 7 });
  assert.equal(doc.id, 'd1');
  const ko = finto({ erroreInsert: { message: 'new row violates row-level security policy' } });
  await assert.rejects(() => acquisisciDocumento(ko.db, { studioId: STUDIO, file: foto }, () => 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'), /row-level security/);
  assert.deepEqual(ko.log.at(-1), ['remove', 'documenti-studio', `${STUDIO}/bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb.jpg`]);
  await assert.rejects(() => acquisisciDocumento(ok.db, { studioId: null, file: foto }), /Studio non disponibile/);
});

test('ricerca unica sui documenti dello studio, errori leggibili prima dell\'aggiornamento del database', async () => {
  const { db, log } = finto();
  assert.equal((await cercaDocumentiStudio(db, 'fattura 12')).length, 1);
  assert.deepEqual(log[0], ['rpc', 'cerca_documenti_studio', { q: 'fattura 12', lim: 8 }]);
  assert.match(messaggioErroreDocumenti({ code: 'PGRST202', message: 'Could not find the function public.cerca_documenti_studio' }), /dopo l'aggiornamento/);
});

test('Studio: acquisisci e documenti nella barra dell\'agenda e nell\'archivio', () => {
  const app = readFileSync('src/App.jsx', 'utf8');
  assert.match(app, /acquisisci: \(\) => setAcquisisciAperto\(true\)/);
  assert.match(app, /cercaDocumentiStudio\(supabase, q, 6\)/);
  const archivio = readFileSync('src/components/ArchivioDocs.jsx', 'utf8');
  assert.match(archivio, /leggiDocumentiStudio\(supabase\)/);
  assert.match(archivio, /if \(doc\.tabella === 'documenti_studio'\) await eliminaDocumentoStudio\(supabase, doc\);/);
  assert.match(readFileSync('src/components/AcquisisciDocumento.jsx', 'utf8'), /capture="environment"/);
});
