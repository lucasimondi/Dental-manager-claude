// PO 2026-11-08: Poliedron deve essere indipendente dall'AI esterna ed eseguire comandi semplici.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { interpretaComando, leggiData, leggiOra, leggiImporto } from '../personal/src/lib/comandi.js';

const OGGI = '2026-11-08'; // domenica
const vista = readFileSync('personal/src/sezioni/poliedron/Poliedron.jsx', 'utf8');

test('promemoria completi: titolo, data e ora letti senza AI', () => {
  assert.deepEqual(interpretaComando('ricordami di chiamare il commercialista domani alle 10', OGGI),
    { tipo: 'promemoria', m: { cosa: 'evento', titolo: 'Chiamare il commercialista', data: '2026-11-09', ora: '10:00', importo: '' }, completo: true, manca: [] });
  assert.equal(interpretaComando('segna dentista venerdì alle 15', OGGI).m.data, '2026-11-13');
  const cena = interpretaComando('metti in agenda cena con Giulia sabato alle 8 di sera', OGGI).m;
  assert.deepEqual([cena.titolo, cena.data, cena.ora], ['Cena con Giulia', '2026-11-14', '20:00']);
  const palestra = interpretaComando('ricordami domani alle 18 e mezza di andare in palestra', OGGI).m;
  assert.deepEqual([palestra.titolo, palestra.ora], ['Andare in palestra', '18:30']);
  assert.equal(interpretaComando('ricordami tra 3 giorni di richiamare il meccanico', OGGI).m.data, '2026-11-11');
});

test('pagamenti: vanno in Da pagare con importo e data', () => {
  assert.deepEqual(interpretaComando('Ricordami di pagare il bollo auto il 30', OGGI).m,
    { cosa: 'pagamento', titolo: 'Bollo auto', data: '2026-11-30', ora: '', importo: '' });
  assert.deepEqual(interpretaComando('devo pagare la luce 80€ entro il 5', OGGI).m,
    { cosa: 'pagamento', titolo: 'Luce', data: '2026-12-05', ora: '', importo: 80 });
  assert.equal(interpretaComando('aggiungi pagamento assicurazione 450,50 euro il 15 dicembre', OGGI).m.importo, 450.5);
});

test('comando incompleto: non scrive, chiede i dati mancanti', () => {
  const r = interpretaComando('ricordami di comprare il latte', OGGI);
  assert.equal(r.completo, false);
  assert.deepEqual(r.manca, ['data']);
  assert.equal(interpretaComando('ricordami', OGGI).tipo, 'chiarisci');
});

test('apri sezioni; parole di ricerca e domande non diventano comandi', () => {
  assert.deepEqual(interpretaComando("vai all'agenda", OGGI), { tipo: 'apri', vista: 'agenda', nome: 'Agenda' });
  assert.deepEqual(interpretaComando('apri impostazioni', OGGI), { tipo: 'apri', pagina: 'impostazioni', nome: 'Impostazioni' });
  assert.equal(interpretaComando('documenti', OGGI).vista, 'documenti');
  assert.equal(interpretaComando('mostrami le foto', OGGI).vista, 'foto');
  assert.equal(interpretaComando('scadenze', OGGI), null, 'da sola resta una ricerca');
  assert.equal(interpretaComando('apri le scadenze', OGGI).vista, 'conti');
  assert.equal(interpretaComando('cosa ho domani?', OGGI), null);
  assert.equal(interpretaComando('Cosa devo pagare questa settimana?', OGGI), null);
  assert.equal(interpretaComando('Trova depliant e pubblicità da eliminare', OGGI), null);
  assert.equal(interpretaComando('aiuto', OGGI).tipo, 'aiuto');
});

test('date, ore e importi', () => {
  assert.equal(leggiData('il 30', OGGI).data, '2026-11-30');
  assert.equal(leggiData('il 3', OGGI).data, '2026-12-03', 'giorno passato: mese dopo');
  assert.equal(leggiData('12/03', OGGI).data, '2027-03-12');
  assert.equal(leggiData('lunedì prossimo', OGGI).data, '2026-11-09');
  assert.equal(leggiData('domenica', OGGI).data, '2026-11-15', 'mai oggi per un giorno della settimana');
  assert.equal(leggiData('appoggio', OGGI), null);
  assert.equal(leggiData('il 31', '2026-02-10').data, '2026-03-31', 'febbraio non ha il 31');
  assert.equal(leggiOra('alle 3 del pomeriggio').ora, '15:00');
  assert.equal(leggiOra('ore 9:30').ora, '09:30');
  assert.equal(leggiOra('alle 25'), null);
  assert.equal(leggiImporto('€ 45,50').importo, 45.5);
});

test('la chat esegue i comandi prima dell\'AI, con Annulla, e senza AI non mostra errori', () => {
  assert.match(vista, /const comando = !allegato && interpretaComando\(q, oggiAgenda\(\)\);/);
  assert.ok(vista.indexOf('interpretaComando(q') < vista.indexOf("if (modo === 'ai')"), 'comandi prima della chiamata all\'AI');
  assert.match(vista, /fatto: `\$\{esito\.messaggio\}/);
  assert.match(vista, /annulla: esito\.annulla/);
  assert.doesNotMatch(vista, /Ti rispondo con la ricerca di Poliedron/);
  assert.match(vista, /senzaAi: true/);
});
