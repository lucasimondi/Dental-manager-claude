// POL-VITA-015 — Foto e video: album, anni, video, catalogazione solo sulle foto.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { album, perAnno, luoghi, eVideo, annoFoto, catalogaFoto, DA_CATALOGARE } from '../personal/src/lib/foto.js';

const foto = [
  { id: '1', album: 'Gita a Sampeyre 2009', data_documento: '2009-08-03', luogo: 'Sampeyre', mime_type: 'image/jpeg' },
  { id: '2', album: 'Gita a Sampeyre 2009', data_documento: '2009-07-20', luogo: 'Sampeyre', mime_type: 'image/jpeg' },
  { id: '3', album: null, email_data: '2018-10-21T10:00:00Z', mime_type: 'image/png' },
  { id: '4', album: 'Video', data_documento: '2011-05-01', mime_type: 'video/quicktime', nome_file_originale: 'IMG_0014.MOV' },
  { id: '5', album: 'Famiglia', mime_type: 'image/jpeg' },
];

test('foto: album con conteggi, anni e "Da catalogare" in fondo', () => {
  const a = album(foto);
  assert.equal(a[0].nome, 'Gita a Sampeyre 2009');
  assert.deepEqual(a[0].anni, ['2009']);
  assert.equal(a.at(-1).nome, DA_CATALOGARE);
  assert.equal(a.find((x) => x.nome === 'Video').video, 1);
  assert.deepEqual(perAnno(foto).map(([y, xs]) => [y, xs.length]), [['2018', 1], ['2011', 1], ['2009', 2], ['Senza data', 1]]);
  assert.deepEqual(luoghi(foto), ['Sampeyre']);
  assert.equal(eVideo({ nome_file_originale: 'clip.MP4' }), true);
  assert.equal(annoFoto({}), 'Senza data');
});

test('foto: la catalogazione tocca solo foto e video, con campi ripuliti', async () => {
  const passi = [];
  const catena = new Proxy({}, { get: (_t, m) => (m === 'then' ? (ok) => Promise.resolve({ data: [{ id: '1' }], error: null }).then(ok) : (...a) => { passi.push([m, ...a]); return catena; }) });
  await catalogaFoto({ from: (t) => { passi.push(['from', t]); return catena; } }, ['1', '2'], { album: '  Mare 2025 ', luogo: '', data_documento: 'boh' });
  assert.deepEqual(passi.slice(0, 4), [['from', 'documenti'], ['update', { album: 'Mare 2025', luogo: null, data_documento: null }], ['in', 'id', ['1', '2']], ['eq', 'fascicolo', 'foto_video']]);
});

test('foto: area raggiungibile da Documenti e dal +, migrazione solo additiva', () => {
  assert.match(readFileSync('personal/src/sezioni/documenti/Documenti.jsx', 'utf8'), /apri\(\{ tipo: 'fotovideo' \}\)/);
  assert.match(readFileSync('personal/src/Aggiungi.jsx', 'utf8'), /\['fotovideo', 'Foto o video'/);
  const sezione = readFileSync('personal/src/sezioni/foto/index.jsx', 'utf8');
  assert.match(sezione, /fotovideo: \{ titolo: 'Foto e video', render: \(p, \{ ctx \}\) => <VistaFoto/);
  assert.match(sezione, /foto: \{ titolo: 'Foto', render: \(p, \{ ctx \}\) => <PaginaFoto/);
  const sql = readFileSync('supabase/archivio/migrations/20261018100000_pol_vita_015_foto_video.sql', 'utf8').split('\n').filter((r) => !r.startsWith('--')).join('\n');
  assert.match(sql, /add column if not exists album text/);
  assert.doesNotMatch(sql, /\bdrop\b|delete from/i);
});
