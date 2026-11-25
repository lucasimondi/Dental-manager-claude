// APP-AUTO-CASA-SALUTE (PO 2026-11-25): Auto e motori, Casa, Salute. Solo dati di esempio, mai quelli veri.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { AMBITI, registroDi, campiCosa, campiDi, dataIso, daGuardare, filtra, nuovaCosa, ordinaRegistro, scadenzeDi, scadenzeTutte, testoCosa, testoScadenza, totaleRegistro } from '../personal/src/lib/mieCose.js';
import { appCosaDaIndirizzo, indirizzoAppCosa, manifestAppCosa } from '../personal/src/lib/appCose.js';

const OGGI = new Date('2026-11-25T10:00:00');
const auto = () => {
  const s = { id: 'a1', ...nuovaCosa('auto', 'auto', 'Utilitaria di prova') };
  const metti = (etichetta, valore) => { s.campi.find((c) => c.etichetta === etichetta).valore = valore; };
  metti('Targa', 'AA000AA'); metti('Scadenza assicurazione', '2026-12-10'); metti('Scadenza bollo', '2026-11-01');
  metti('Prossima revisione', '2027-06-30'); metti('Km attuali', '99.500'); metti('Prossimo tagliando a km', '100000');
  return s;
};

test('ogni app ha gruppi, tipi, registro e contatti; i campi base stanno nei gruppi', () => {
  for (const a of Object.values(AMBITI)) {
    assert.ok(a.gruppi.length >= 4 && a.tipi.length >= 2 && a.registro.voci.length && a.contatti.ruoli.length, a.id);
    for (const [t] of a.tipi) {
      const s = nuovaCosa(a.id, t);
      assert.ok(s.campi.length, `${a.id}/${t}`);
      for (const c of s.campi) assert.ok(a.gruppi.some(([g]) => g === c.gruppo), `${a.id}/${t}: ${c.etichetta}`);
    }
  }
  const v = nuovaCosa('auto', 'auto');
  for (const e of ['Targa', 'Numero polizza', 'Scadenza assicurazione', 'Scadenza bollo', 'Prossima revisione', 'Prossimo tagliando']) assert.ok(v.campi.some((c) => c.etichetta === e), e);
  assert.ok(v.campi.find((c) => c.etichetta === 'Scadenza bollo').avviso);
  assert.equal(nuovaCosa('casa', 'box').campi.some((c) => c.gruppo === 'utenze'), false);
  assert.ok(nuovaCosa('salute', 'persona').campi.some((c) => c.etichetta === 'Tessera sanitaria: scadenza' && c.avviso));
  assert.equal(nuovaCosa('auto', 'boh').tipo, 'auto');
  // «Multe e pedaggi»: le multe non legate a un veicolo, registro senza km.
  const multe = nuovaCosa('auto', 'multe');
  assert.equal(registroDi(multe).titolo, 'Multe e pedaggi'); assert.equal(registroDi(multe).km, false);
  assert.equal(registroDi(nuovaCosa('auto', 'auto')).km, true);
  assert.ok(multe.campi.some((c) => c.avviso));
  assert.throws(() => nuovaCosa('boh'), /Ambito/);
});

test('scadenze: scaduta, presto (30 giorni), ok e tagliando a km', () => {
  const sc = scadenzeDi(auto(), OGGI);
  assert.deepEqual(sc.map((x) => [x.voce, x.stato]), [['Scadenza bollo', 'scaduta'], ['Tagliando', 'presto'], ['Scadenza assicurazione', 'presto'], ['Prossima revisione', 'ok']]);
  assert.equal(testoScadenza(sc[0]), '01/11/2026 · scaduta da 24 giorni');
  assert.equal(sc[1].testo, 'tra 500 km');
  assert.equal(testoScadenza(sc[2]), '10/12/2026 · tra 15 giorni');
  assert.equal(daGuardare([auto()], OGGI), 3);
  assert.equal(scadenzeTutte([auto(), { ...nuovaCosa('casa', 'casa'), id: 'c' }], OGGI).length, 4);
  assert.equal(dataIso('5/3/2027'), '2027-03-05');
  assert.equal(dataIso('marzo'), null);
});

test('registro ordinato dal più recente, totale dell’anno, testo da copiare, ricerca', () => {
  const r = [{ data: '2025-03-01', voce: 'Tagliando', importo: '210,50' }, { data: '2026-05-10', voce: 'Gomme', importo: '1.080' }, { data: '2026-01-02', voce: 'Revisione', importo: '79' }];
  assert.deepEqual(ordinaRegistro(r).map((x) => x.voce), ['Gomme', 'Revisione', 'Tagliando']);
  assert.equal(totaleRegistro(r, 2026), 1159);
  const s = { ...auto(), persone: [{ ruolo: 'Meccanico', nome: 'Officina Prova', telefono: '000 111' }] };
  const t = testoCosa(s);
  assert.match(t, /^Utilitaria di prova\n\nVEICOLO\nTarga: AA000AA\nKm attuali: 99.500\n/);
  assert.match(t, /Scadenza assicurazione: 10\/12\/2026/);
  assert.match(t, /CONTATTI\nMeccanico: Officina Prova tel\. 000 111$/);
  assert.deepEqual(filtra([s, nuovaCosa('auto', 'moto', 'Altra')], 'aa000aa officina').map((x) => x.nome), ['Utilitaria di prova']);
  assert.equal(campiDi(s, 'assicurazione').length, 4);
});

test('pulizia prima di salvare: date, gruppi, righe vuote, foto', () => {
  const c = campiCosa({ ambito: 'casa', nome: '  Casa   al mare ', tipo: 'strano',
    campi: [{ gruppo: 'utenze', etichetta: ' POD ', valore: ' IT000 ' }, { gruppo: 'x', etichetta: '', valore: '1/2/2027', tipo: 'data', avviso: true }, { gruppo: 'utenze', etichetta: 'a', valore: 'b', tipo: 'testo', avviso: true }],
    registro: [{ data: '', voce: '', note: '' }, { data: '03/04/2026', voce: ' Caldaia ', importo: '' }], persone: [{ ruolo: 'Idraulico' }, { ruolo: 'Idraulico', nome: ' Mario ' }] }, 'casa');
  assert.equal(c.nome, 'Casa al mare');
  assert.equal(c.tipo, 'altro');
  assert.deepEqual(c.campi[0], { gruppo: 'utenze', etichetta: 'POD', valore: 'IT000', tipo: 'testo', avviso: false });
  assert.deepEqual(c.campi[1], { gruppo: 'altro', etichetta: 'Campo', valore: '2027-02-01', tipo: 'data', avviso: true });
  assert.equal(c.campi[2].avviso, false, 'solo le date avvisano');
  assert.deepEqual(c.registro, [{ data: '2026-04-03', voce: 'Caldaia' }]);
  assert.deepEqual(c.persone, [{ ruolo: 'Idraulico', nome: 'Mario' }]);
  assert.throws(() => campiCosa({ nome: ' ' }), /nome/);
  assert.throws(() => campiCosa({ foto: 'http://esempio/x.jpg' }), /Foto/);
  assert.equal(campiCosa({ foto: 'data:image/jpeg;base64,AAAA' }).foto, 'data:image/jpeg;base64,AAAA');
  assert.throws(() => campiCosa({ ambito: 'barca' }), /Ambito/);
});

test('app a sé: indirizzi /poliedron/auto/ e /auto/ sul dominio personale, manifest e icone', () => {
  assert.equal(appCosaDaIndirizzo('/poliedron/auto/'), 'auto');
  assert.equal(appCosaDaIndirizzo('/casa'), 'casa');
  assert.equal(appCosaDaIndirizzo('/salute/x'), 'salute');
  assert.equal(appCosaDaIndirizzo('/poliedron/personal/'), null);
  assert.equal(appCosaDaIndirizzo('/autostrada'), null);
  const dominio = { hostname: 'personal.poliedrasoft.it' }, altro = { hostname: 'esempio.it' };
  assert.equal(indirizzoAppCosa('casa', dominio), '/casa/');
  assert.equal(indirizzoAppCosa('casa', altro), '/poliedron/casa/');
  assert.equal(manifestAppCosa('salute', dominio), '/salute-dominio.webmanifest');
  const vercel = JSON.parse(readFileSync('vercel.json', 'utf8')).rewrites;
  for (const id of ['auto', 'casa', 'salute']) {
    for (const [file, base] of [[`${id}.webmanifest`, '/poliedron/'], [`${id}-dominio.webmanifest`, '/']]) {
      const m = JSON.parse(readFileSync(`public/${file}`, 'utf8'));
      assert.equal(m.start_url, `${base}${id}/`); assert.equal(m.scope, `${base}${id}/`); assert.equal(m.display, 'standalone');
      for (const i of m.icons) assert.ok(readFileSync(`public${i.src}`).length > 1000, i.src);
    }
    for (const s of [`/poliedron/${id}`, `/poliedron/${id}/`, `/${id}`, `/${id}/`]) assert.ok(vercel.some((r) => r.source === s && r.destination === '/personal/index.html'), s);
  }
  assert.match(readFileSync('personal/index.html', 'utf8'), /\(auto\|casa\|salute\)/);
});

test('migrazione: tabella del proprietario, solo aggiunte, nessuna cancellazione né dato vero', () => {
  const sql = readFileSync('supabase/archivio/migrations/20261125150000_mie_cose.sql', 'utf8');
  assert.match(sql, /create table if not exists mie_cose/);
  assert.match(sql, /ambito in \('auto', 'casa', 'salute'\)/);
  assert.match(sql, /enable row level security/);
  assert.match(sql, /e_proprietario\(\)/);
  assert.match(sql, /revoke all on mie_cose from anon/);
  assert.doesNotMatch(sql, /drop table|delete from|truncate mie/i);
  const lib = readFileSync('personal/src/lib/mieCose.js', 'utf8'), vista = readFileSync('personal/src/cose/AppCose.jsx', 'utf8');
  assert.doesNotMatch(lib + vista, /\.delete\(/, 'le schede si archiviano');
  assert.doesNotMatch(lib + vista + sql, /SMNLCU|CM396|IT001E\d/, 'nessun dato vero nel repository');
});

test('app a sé: il service worker dello Studio non risponde su /auto/, /casa/, /salute/', () => {
  const cfg = readFileSync('vite.config.js', 'utf8');
  assert.match(cfg.match(/navigateFallbackDenylist: \[(.*)\]/)[1], /\(auto\|casa\|salute\)/);
  assert.match(cfg, /\/\^\\\/\(auto\|casa\|salute\)\(\\\/\|\$\)\/\.test\(url\.pathname\)/);
});

test('documenti della scheda: tag cosa/allegato, chiavi per trovarli in archivio', async () => {
  const { tagAllegato, chiaviRicerca, tipoAllegato, TIPI_ALLEGATO, FASCICOLO_ALLEGATI } = await import('../personal/src/lib/mieCose.js');
  assert.deepEqual(tagAllegato(['x', 'allegato:bollo'], 'v1', 'Libretto'), ['x', 'cosa:v1', 'allegato:libretto']);
  assert.deepEqual(tagAllegato(['x', 'cosa:v1', 'allegato:libretto'], 'v1', null, false), ['x', 'allegato:libretto']);
  assert.equal(tipoAllegato({ tag: ['cosa:v1', 'allegato:assicurazione'] }, 'auto'), 'Assicurazione');
  assert.ok(TIPI_ALLEGATO.auto.includes('Libretto') && TIPI_ALLEGATO.auto.includes('Assicurazione'));
  assert.equal(FASCICOLO_ALLEGATI.auto, 'veicoli');
  const s = { campi: [{ etichetta: 'Targa', valore: 'AA 000 AA' }, { etichetta: 'Numero polizza', valore: 'P-12345' }, { etichetta: 'Km attuali', valore: '100000' }, { etichetta: 'POD', valore: '' }] };
  assert.deepEqual(chiaviRicerca(s), ['AA000AA', 'P12345']);
  const vista = readFileSync('personal/src/cose/Allegati.jsx', 'utf8') + readFileSync('personal/src/lib/mieCose.js', 'utf8');
  assert.match(vista, /clinico_pazienti/, 'i documenti dei pazienti non si collegano');
  assert.doesNotMatch(vista, /\.delete\(/);
});
