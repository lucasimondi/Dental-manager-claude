import { test } from 'node:test';
import assert from 'node:assert/strict';
import { leggiAzioneWidget, urlSenzaAzioneWidget, rimandaDiUnGiorno, paginaDaAzioneWidget } from '../personal/src/lib/widgetAzioni.js';
import { widgetSnapshot } from '../personal/src/lib/androidAgendaWidget.js';

const deps = (over = {}) => ({ sessione: async () => ({ user: { id: 'synthetic' } }), appuntamento: async () => null, impegno: async () => null, ...over });

test('widget new actions open the personal or Studio editor on the chosen day, legacy value included', async () => {
  assert.deepEqual(leggiAzioneWidget('?agenda=1&agendaDate=2026-11-05&widgetNew=appuntamento'), { tipo: 'nuovo', cosa: 'appuntamento', giorno: '2026-11-05' });
  assert.equal(leggiAzioneWidget('?widgetNew=1').cosa, 'evento');
  assert.equal(leggiAzioneWidget('?widgetNew=evento&agendaDate=bad').giorno, null);
  assert.deepEqual(await paginaDaAzioneWidget(leggiAzioneWidget('?agendaDate=2026-11-05&widgetNew=appuntamento'), deps()), { tipo: 'evento', evento: { data_inizio: '2026-11-05', data_fine: '2026-11-05' }, cosa: 'appuntamento' });
  assert.deepEqual(await paginaDaAzioneWidget(leggiAzioneWidget('?widgetNew=evento'), deps({ sessione: async () => { throw Error('no read for new'); } })), { tipo: 'evento' });
});

test('row references are strict and postpone applies to personal events only', () => {
  assert.deepEqual(leggiAzioneWidget('?widgetOpen=studio:42'), { tipo: 'apri', fonte: 'studio', id: '42', rimanda: false, giorno: null });
  assert.equal(leggiAzioneWidget('?widgetOpen=studio:42&widgetAction=rimanda').rimanda, false);
  assert.equal(leggiAzioneWidget('?widgetOpen=personal:1700000000123&widgetAction=rimanda').rimanda, true);
  for (const bad of ['patients:1', 'studio:', 'studio:1,2', 'studio:../x', 'personal:' + 'a'.repeat(65), 'studio:1%20or%201']) assert.equal(leggiAzioneWidget('?widgetOpen=' + bad), null, bad);
});

test('opening a row reads it through the session and refuses hidden, cancelled or missing rows', async () => {
  const visto = [];
  const a = { id: 42, data: '2026-11-05', stato: 'confermato', paziente: 'SYNTHETIC' };
  assert.deepEqual(await paginaDaAzioneWidget({ tipo: 'apri', fonte: 'studio', id: '42' }, deps({ appuntamento: async (id) => { visto.push(id); return a; } })), { tipo: 'appuntamento', a });
  assert.deepEqual(visto, ['42']);
  assert.ok((await paginaDaAzioneWidget({ tipo: 'apri', fonte: 'studio', id: '42' }, deps({ appuntamento: async () => ({ ...a, stato: 'annullato' }) }))).avviso);
  assert.ok((await paginaDaAzioneWidget({ tipo: 'apri', fonte: 'personal', id: '7' }, deps({ impegno: async () => ({ id: 7, visibile_personal: false }) }))).avviso);
  assert.ok((await paginaDaAzioneWidget({ tipo: 'apri', fonte: 'personal', id: '7' }, deps())).avviso);
  const senza = await paginaDaAzioneWidget({ tipo: 'apri', fonte: 'studio', id: '42' }, deps({ sessione: async () => null, appuntamento: async () => { throw Error('must not read'); } }));
  assert.match(senza.avviso, /Collega/);
});

test('postpone proposes the same event one day later without saving', async () => {
  assert.deepEqual(rimandaDiUnGiorno({ data_inizio: '2026-11-30', data_fine: '2026-12-01' }), { data_inizio: '2026-12-01', data_fine: '2026-12-02' });
  assert.deepEqual(rimandaDiUnGiorno({ data_inizio: '2026-12-31', data_fine: null }), { data_inizio: '2027-01-01', data_fine: '2027-01-01' });
  const e = { id: 7, titolo: 'Prova', data_inizio: '2026-11-05', data_fine: '2026-11-05' };
  const p = await paginaDaAzioneWidget({ tipo: 'apri', fonte: 'personal', id: '7', rimanda: true }, deps({ impegno: async () => e }));
  assert.equal(p.evento, e); assert.deepEqual(p.proposta, { data_inizio: '2026-11-06', data_fine: '2026-11-06' });
});

test('action parameters are removed from the address after use, agenda location kept', () => {
  const u = urlSenzaAzioneWidget('https://personal.poliedrasoft.it/?agenda=1&agendaDate=2026-11-05&widgetOpen=personal:7&widgetAction=rimanda&widgetNew=1');
  assert.equal(u.search, '?agenda=1&agendaDate=2026-11-05');
});

test('snapshot carries only an opaque row reference for actions', () => {
  const s = widgetSnapshot({ from: '2026-11-01', to: '2026-11-30', appuntamenti: [{ id: 42, paziente_id: 9, data: '2026-11-03', ora: '09:00' }, { id: 'x y', data: '2026-11-03', ora: '10:00' }], impegni: [{ id: 1700000000123, titolo: 'Prova', data_inizio: '2026-11-03' }] });
  assert.deepEqual(s.entries.map((e) => e.ref), ['1700000000123', '42', '']);
  assert.doesNotMatch(JSON.stringify(s), /paziente|"9"/);
});

test('startup action runs once, cleans the address and ignores late results after unmount', async () => {
  const { avviaAzioneWidget } = await import('../personal/src/lib/widgetAzioni.js');
  const aperte = [], indirizzi = [];
  const host = (search) => ({ location: { search, href: 'https://personal.poliedrasoft.it/' + search }, history: { state: null, replaceState: (_s, _t, u) => indirizzi.push(String(u)) } });
  avviaAzioneWidget({ host: host('?agenda=1'), apri: () => { throw Error('no action'); } })();
  assert.equal(indirizzi.length, 0);
  avviaAzioneWidget({ host: host('?agendaDate=2026-11-05&widgetNew=evento'), apri: (p) => aperte.push(p), mostra() {}, errore() {} });
  await new Promise((r) => setImmediate(r));
  assert.equal(aperte.length, 1); assert.equal(indirizzi[0], 'https://personal.poliedrasoft.it/?agendaDate=2026-11-05');
  let rilascia; const stop = avviaAzioneWidget({ host: host('?widgetOpen=studio:42'), apri: () => { throw Error('late'); }, mostra() {}, errore() {}, sessione: () => new Promise((r) => { rilascia = r; }) });
  stop(); rilascia({ user: {} }); await new Promise((r) => setImmediate(r));
});
