// POL-VITA-004 — calcoli dell'agenda di Personal.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
// rigaImpegno è in agenda.js: studio.js crea il client Supabase all'import (Node 20 in CI non ha WebSocket).
import { elementiDelGiorno, colonne, grigliaMese, giorniSettimana, piuGiorni, generaDateRipetizione, coloreEvento, ETICHETTE_PREDEFINITE, rigaImpegno } from '../personal/src/lib/agenda.js';
import { normalizza } from '../personal/src/lib/impostazioni.js';

test('giorno: appuntamenti ed eventi a orario, eventi di tutto il giorno e scadenze separati', () => {
  const g = '2026-10-20';
  const el = elementiDelGiorno(g, {
    appuntamenti: [{ id: 1, data: g, ora: '09:00', durata: 60 }, { id: 2, data: '2026-10-21', ora: '09:00' }],
    impegni: [
      { id: 7, data_inizio: g, data_fine: g, tutto_il_giorno: false, ora_inizio: '08:30', ora_fine: '09:30' },
      { id: 8, data_inizio: '2026-10-19', data_fine: '2026-10-22', tutto_il_giorno: true },
    ],
    scadenze: [{ id: 's', data: g }, { id: 't', data: '2026-10-25' }],
  });
  assert.deepEqual(el.aOrario.map((x) => x.id), ['e7', 'a1']);
  assert.deepEqual(el.tuttoIlGiorno.map((x) => x.id), [8]);
  assert.deepEqual(el.scadenze.map((x) => x.id), ['s']);
});

test('colonne: gli elementi sovrapposti si dividono la larghezza, quelli separati no', () => {
  const r = colonne([{ id: 'a', inizio: 540, fine: 600 }, { id: 'b', inizio: 570, fine: 630 }, { id: 'c', inizio: 700, fine: 730 }]);
  assert.deepEqual(r.map((x) => [x.id, x.col, x.colonne]), [['a', 0, 2], ['b', 1, 2], ['c', 0, 1]]);
});

test('mese e settimana partono da lunedì', () => {
  const m = grigliaMese('2026-10-15');
  assert.equal(m.length, 42);
  assert.equal(m[0], '2026-09-28');
  assert.deepEqual(giorniSettimana('2026-10-15'), ['2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16', '2026-10-17', '2026-10-18']);
  assert.equal(piuGiorni('2026-10-31', 1), '2026-11-01');
});

test('evento → riga di impegni_personali come la usa l\'agenda dello studio', () => {
  assert.deepEqual(rigaImpegno({ titolo: ' Calcetto ', tipo: 'sport', colore: '#059669', data_inizio: '2026-10-20', ora_inizio: '20:00', ora_fine: '21:30' }), {
    titolo: 'Calcetto', tipo: 'personale', etichetta: 'sport', colore: '#059669', data_inizio: '2026-10-20', data_fine: '2026-10-20',
    tutto_il_giorno: false, ora_inizio: '20:00', ora_fine: '21:30', note: null, recurrence_id: null, visibile_studio: true,
  });
  const ferie = rigaImpegno({ titolo: 'Ferie', tutto_il_giorno: true, data_inizio: '2026-08-01', data_fine: '2026-08-15', ora_inizio: '09:00' });
  assert.equal(ferie.ora_inizio, null);
  assert.equal(ferie.data_fine, '2026-08-15');
  assert.equal(rigaImpegno({ titolo: '', data_inizio: '2026-01-02', data_fine: '2026-01-01' }).data_fine, '2026-01-02');
});

test('etichette: predefinite, colore valido, colore dell\'evento prima di quello dell\'etichetta', () => {
  assert.deepEqual(normalizza({}).etichette, ETICHETTE_PREDEFINITE);
  assert.equal(normalizza({ etichette: [{ nome: 'Barca', colore: 'rosso' }] }).etichette[0].colore, '#64748b');
  assert.equal(coloreEvento({ tipo: 'sport' }, ETICHETTE_PREDEFINITE), '#059669');
  assert.equal(coloreEvento({ tipo: 'sport', colore: '#111111' }, ETICHETTE_PREDEFINITE), '#111111');
});


test('ripetizione settimanale mantiene il giorno scelto e non sposta l’evento al lunedì della settimana', () => {
  const date = generaDateRipetizione('2026-10-16', '2026-10-30', 'settimanale');
  assert.deepEqual(date, ['2026-10-16', '2026-10-23', '2026-10-30']);
  const impegni = date.map((data, id) => ({ id, titolo: 'Impegno', data_inizio: data, data_fine: data, tutto_il_giorno: true }));
  assert.equal(elementiDelGiorno('2026-10-12', { impegni }).tuttoIlGiorno.length, 0);
  assert.equal(elementiDelGiorno('2026-10-16', { impegni }).tuttoIlGiorno.length, 1);
});

test('ripetizione mensile mantiene il giorno di partenza anche dopo febbraio', () => {
  assert.deepEqual(
    generaDateRipetizione('2027-01-31', '2027-03-31', 'mensile'),
    ['2027-01-31', '2027-02-28', '2027-03-31'],
  );
});

test('rigaImpegno conserva il gruppo di ripetizione già esistente', () => {
  assert.equal(rigaImpegno({ titolo: 'Riunione', data_inizio: '2026-10-16', recurrence_id: 12345 }).recurrence_id, 12345);
});

test('ripetizione: recurrence_id è un uuid valido (colonna uuid nel database dello studio)', async () => {
  const { nuovoIdRipetizione } = await import('../personal/src/lib/agenda.js');
  const fs = await import('node:fs');
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
  assert.match(nuovoIdRipetizione(), uuid);
  assert.notEqual(nuovoIdRipetizione(), nuovoIdRipetizione());
  const personal = fs.readFileSync('personal/src/sezioni/agenda/Evento.jsx', 'utf8');
  const studio = fs.readFileSync('src/components/Agenda.jsx', 'utf8');
  assert.match(personal, /recurrenceId = date\.length > 1 \? nuovoIdRipetizione\(\)/);
  assert.match(studio, /recurrenceId = occorrenze\.length > 1 \? crypto\.randomUUID\(\)/);
});

test('evento ripetuto: modifica ed eliminazione chiedono solo questo, successivi o tutti', async () => {
  const { occorrenzeDaToccare, applicaAOccorrenza, AMBITI_SERIE } = await import('../personal/src/lib/agenda.js');
  const fs = await import('node:fs');
  const serie = ['2026-10-17', '2026-10-31', '2026-11-14'].map((d, i) => ({ id: i + 1, recurrence_id: 'r', data_inizio: d, data_fine: d }));
  const aperto = { ...serie[1], data_inizio_originale: '2026-10-31' };
  assert.deepEqual(AMBITI_SERIE.map(([k]) => k), ['questo', 'successivi', 'tutti']);
  assert.deepEqual(occorrenzeDaToccare(serie, aperto, 'questo').map((x) => x.id), [2]);
  assert.deepEqual(occorrenzeDaToccare(serie, aperto, 'successivi').map((x) => x.id), [2, 3]);
  assert.deepEqual(occorrenzeDaToccare(serie, aperto, 'tutti').map((x) => x.id), [1, 2, 3]);
  // Spostando l'evento aperto di un giorno, gli altri della serie si spostano dello stesso giorno.
  const mod = applicaAOccorrenza(serie[2], { titolo: 'Bimbe dai nonni', data_inizio: '2026-11-01', data_fine: '2026-11-01' }, 1);
  assert.deepEqual([mod.id, mod.titolo, mod.data_inizio, mod.data_fine, mod.recurrence_id], [3, 'Bimbe dai nonni', '2026-11-15', '2026-11-15', 'r']);
  const ui = fs.readFileSync('personal/src/sezioni/agenda/Evento.jsx', 'utf8');
  assert.match(ui, /if \(inSerie && !ambito\) \{ setChiediSerie\('salva'\)/);
  assert.match(ui, /inSerie \? setChiediSerie\('elimina'\)/);
});

test('agenda Personal: settimana completa, scelta per nascondere il weekend e Settimana lavoro', async () => {
  const fs = await import('node:fs');
  const griglia = fs.readFileSync('personal/src/sezioni/agenda/AgendaGriglia.jsx', 'utf8');
  assert.match(griglia, /const GIORNI_NASCOSTI_PERSONAL = \[\];/);
  assert.match(griglia, /const weekly = view === 'settimana' \|\| view === 'settimana_lavoro';/);
  assert.match(griglia, /view === 'settimana_lavoro' \|\| weekendsHidden \? \[0, 6\] : GIORNI_NASCOSTI_PERSONAL/);
  assert.match(griglia, /onToggleWeekends=\{\(\) => setWeekendsHidden/);
});

test('POL-VITA-013: appuntamento dello studio scritto da Personal, validato come nello studio', async () => {
  const { rigaAppuntamento } = await import('../personal/src/lib/agenda.js');
  assert.deepEqual(rigaAppuntamento({ paziente_id: '42', data: '2026-10-20', ora: '09:15:00', durata: '45', tipo: ' Igiene ', note: ' ', stato: 'boh' }), {
    paziente_id: 42, data: '2026-10-20', ora: '09:15', durata: 45, tipo: 'Igiene', colore: null, note: null, stato: 'confermato',
  });
  assert.throws(() => rigaAppuntamento({ data: '2026-10-20', ora: '09:00' }), /paziente/);
  assert.throws(() => rigaAppuntamento({ paziente_id: 1, data: '', ora: '09:00' }), /giorno/);
});

test('POL-VITA-013: eventi nascosti restano in Personal e spariscono solo nello studio', async () => {
  const fs = await import('node:fs');
  const { rigaImpegno } = await import('../personal/src/lib/agenda.js');
  assert.equal(rigaImpegno({ titolo: 'x', data_inizio: '2026-10-20' }).visibile_studio, true);
  assert.equal(rigaImpegno({ titolo: 'x', data_inizio: '2026-10-20', visibile_studio: false }).visibile_studio, false);
  const app = fs.readFileSync('src/App.jsx', 'utf8');
  assert.match(app, /const impegniStudio = useMemo\(\(\) => impegni\.filter\(\(i\) => i\.visibileStudio !== false\), \[impegni\]\);/);
  assert.doesNotMatch(app, /impegni=\{impegni\}/, 'lo studio riceve solo gli eventi visibili');
  assert.match(fs.readFileSync('src/lib/supabase.js', 'utf8'), /visibileStudio: 'visibile_studio'/);
  const sql = fs.readFileSync('supabase/migrations/20261017120000_pol_vita_013_impegni_visibili_studio.sql', 'utf8');
  assert.match(sql, /add column if not exists visibile_studio boolean not null default true/);
});

// PO 2026-10-17: "La scritta del mese deve essere adattata bene, così è spaginata …
// forse conviene aumentare un po' verticalmente la misura degli slot".
test('Personal agenda: short month on one line, original slot height, Studio untouched', () => {
  const griglia = readFileSync(new URL('../personal/src/sezioni/agenda/AgendaGriglia.jsx', import.meta.url), 'utf8');
  const shared = readFileSync(new URL('../shared/agenda/AgendaPresentation.jsx', import.meta.url), 'utf8');
  assert.match(griglia, /viewPicker=\{pick\} floatingFooter=\{fasciaGiorno\} shortMonth \/>/);
  // PO 2026-10-17: slot di nuovo come prima; più spazio solo col pinch (1 = come prima).
  assert.doesNotMatch(griglia, /PX_PER_MIN_MIN/);
  assert.match(griglia, /const slotH = Math\.round\(Math\.max\(24, availH \/ slots\.length \* zoom\) \* pinch\);/);
  assert.match(griglia, /usePinchZoom\(containerRef, view !== 'mese'\)/);
  assert.match(shared, /shortMonth = false \}\) \{/, 'Studio keeps the full month name by default');
  assert.match(shared, /shortMonth \? \{ whiteSpace: 'nowrap', flexShrink: 0 \} : \{\}/);
});
