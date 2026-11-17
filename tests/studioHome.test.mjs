// HOME-STUDIO (PO 2026-11-17, mockup approvato): «Studio» apre la Home dello Studio.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('riepilogoStudio: oggi, prossimo, da confermare, richiami; scadenze solo con permesso', async () => {
  const { riepilogoStudio } = await import('../src/lib/studioHome.js');
  const oggi = '2026-11-17';
  const appointments = [
    { id: 1, data: oggi, ora: '09:00', stato: 'confermato', pazienteId: 1 },
    { id: 2, data: oggi, ora: '11:30', stato: 'da confermare', pazienteId: 2, tipo: 'Igiene' },
    { id: 3, data: oggi, ora: '15:00', stato: 'annullato' },
    { id: 4, data: '2026-11-20', ora: '10:00', stato: 'da confermare' },
    { id: 5, data: '2026-12-20', ora: '10:00', stato: 'da confermare' },
  ];
  const richiami = [
    { stato: 'da_fare', dataScadenza: '2026-11-01' }, { stato: 'da_fare', dataScadenza: oggi },
    { stato: 'fatto', dataScadenza: '2026-11-01' },
  ];
  const r = riepilogoStudio({ appointments, richiami, oggi, ora: '10:00' });
  assert.equal(r.diOggi.length, 2);
  assert.equal(r.prossimo.id, 2);
  assert.equal(r.daConfermareOggi, 1);
  assert.equal(r.daConfermare, 1);
  assert.equal(r.richiamiScaduti, 1);
  assert.equal(r.richiamiOggi, 1);
  assert.equal(r.fine, '11:30');
  assert.equal(r.pagamentiScaduti, 0, 'senza permesso del controllo di gestione nessuna scadenza');
});

test('Home Studio: azioni rapide con Ricetta e Preventivo, nessuna formula economica nuova', () => {
  const home = read('src/components/StudioHome.jsx');
  for (const nome of ['Appuntamento', 'Paziente', 'Ricetta', 'Preventivo', 'Incasso', 'Spesa']) assert.match(home, new RegExp(`nome: '${nome}'`));
  // Round 2 (PO 2026-11-17): il + ripeteva le azioni ed era coperto dalla gemma: tolto.
  assert.doesNotMatch(home, /aria-label="Crea"|sh-foglio/);
  assert.match(home, /conSpese && azioni\.spesa/);
  assert.match(home, /Oggi in studio/);
  assert.match(home, /Il tuo studio/);
  assert.match(home, /Da seguire/);
  // L'incassato di oggi viene dallo snapshot canonico, solo con il permesso.
  assert.match(home, /loadHomeFinancialSnapshot\(supabase, \{ authorized: true, period: \{ dateFrom: oggi, dateTo: oggi \} \}\)/);
  assert.match(home, /if \(!managementControl\) \{ setIncassatoOggi\(null\)/);
  assert.doesNotMatch(home, /\.reduce\(/);
  const app = read('src/App.jsx');
  assert.match(app, /ricetta: \(\) => openPrescription\(\{\}\)/);
  assert.match(app, /preventivo: \(\) => goNuovoElemento\('preventivi'\)/);
  assert.match(app, /appuntamento: \(\) => setPoliedronBookingOpen\(true\)/);
  assert.match(app, /managementControl=\{homePermissions\.managementControl\}/);
  // Acquisisci è sulla Home: il tasto galleggiante non si duplica lì.
  assert.match(app, /page !== 'chat' && page !== 'studio' && <TastoAcquisisci/);
});
