// AGENDA-UNICA (PO 2026-11-08): "una sola agenda e da lì fare tutto"; base = l'agenda di Studio;
// le scadenze dell'archivio personale compaiono nell'agenda. Computer e app Android invariati.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { agendaUnica } from '../shared/agenda/navigation.js';
import { scadenzeDelGiorno } from '../src/lib/scadenzePersonali.js';
const read = (p) => readFileSync(p, 'utf8');
const mm = (matches) => () => ({ matches });

test('solo sul telefono, mai nell\'app Android con i widget né sul computer', () => {
  assert.equal(agendaUnica({ matchMedia: mm(true) }), true);
  assert.equal(agendaUnica({ matchMedia: mm(false) }), false, 'computer');
  assert.equal(agendaUnica({ matchMedia: mm(true), PoliedraWidget: {} }), false, 'APK Poliedra Agenda');
  assert.equal(agendaUnica({}), false);
  assert.equal(agendaUnica({ matchMedia() { throw new Error('x'); } }), false);
});

test('Personal porta all\'agenda di Studio nello stesso indirizzo, conservando giorno e vista', () => {
  const src = read('personal/src/sezioni/agenda/Agenda.jsx');
  assert.match(src, /const \[unica\] = useState\(\(\) => agendaUnica\(\)\);/);
  assert.match(src, /location\.replace\(agendaDestination\('studio', l\.day \|\| oggi\(\), l\.view \|\| 'settimana', globalThis\.location\)\)/);
  assert.match(src, /return <VistaAgendaPersonal ctx=\{ctx\} \/>;/, 'computer e Android: l\'agenda di Personal resta');
  const m = JSON.parse(read('public/personal-dominio.webmanifest'));
  assert.equal(m.scope, '/', 'dal dominio di Personal l\'app installata comprende /studio');
});

test('scadenze personali come impegni del giorno flottanti', () => {
  const aperte = [];
  const items = scadenzeDelGiorno([{ id: 1, data: '2026-11-15', descrizione: 'Bolletta luce' }, { id: 2, data: '2026-11-16', descrizione: 'Affitto' }], '2026-11-15', (s) => aperte.push(s.id));
  assert.deepEqual(items.map(({ id, title, color }) => ({ id, title, color })), [{ id: 'scadenza-1', title: '€ Bolletta luce', color: '#b45309' }]);
  items[0].onOpen();
  assert.deepEqual(aperte, [1]);
});

test('lettura delle scadenze: archivio separato, nessun nuovo accesso, nessun token preso dall\'indirizzo, solo telefono', () => {
  const lib = read('src/lib/scadenzePersonali.js');
  assert.match(lib, /detectSessionInUrl: false/);
  assert.match(lib, /if \(!data\?\.session\) return \{ collegato: false, scadenze: \[\] \};/);
  assert.doesNotMatch(lib, /signIn|insert\(|update\(|delete\(|\.upsert\(/, 'sola lettura, nessun accesso');
  assert.match(read('personal/src/lib/archivioConfig.js'), /ARCHIVIO_STORAGE_KEY = 'poliedron-personal-auth'/);
  const agenda = read('src/components/Agenda.jsx');
  assert.match(agenda, /\.\.\.\(isMobile \? scadenzeDelGiorno\(scadenzePersonali, date, apriScadenza\) : \[\]\)/);
  assert.match(agenda, /if \(!isMobile\) return undefined;\n\s+let vivo = true;\n\s+const carica = \(\) => leggiScadenzePersonali\(\)/);
});
