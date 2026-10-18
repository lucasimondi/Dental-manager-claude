// PO 2026-10-17: "Lavoriamo su chat poliedron: non è impaginata bene, deve essere una pagina a sé,
// come poliedron per lo studio, deve poter avere anche allegati tramite tastino".
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ACCETTA_ALLEGATI, CHAT_VUOTA, DOMANDA_ALLEGATO, dimensioneFile, domandaDa, esitoAllegato, puoInviare, storiaChat } from '../personal/src/lib/chat.js';

test('chat: si invia con una domanda, con un file o con entrambi, mai durante l\'attesa', () => {
  assert.equal(puoInviare({ testo: 'ciao' }), true);
  assert.equal(puoInviare({ testo: '  ', file: { name: 'a.pdf' } }), true);
  assert.equal(puoInviare({ testo: '  ' }), false);
  assert.equal(puoInviare({ testo: 'ciao', attesa: 'Cerco…' }), false);
  assert.equal(domandaDa('  quanto costa? '), 'quanto costa?');
  assert.equal(domandaDa('', true), DOMANDA_ALLEGATO);
  assert.equal(domandaDa('', false), '');
});

test('chat: la storia per il modello ha solo i messaggi con testo, al massimo 6', () => {
  const messaggi = [
    { ruolo: 'utente', testo: '', allegato: { nome: 'a.pdf' } },
    { ruolo: 'assistente', fonte: 'archivio', archiviato: { id: 'x', titolo: 'A' } },
    ...Array.from({ length: 8 }, (_, i) => ({ ruolo: i % 2 ? 'assistente' : 'utente', testo: `m${i}`, fonte: 'ai' })),
  ];
  const storia = storiaChat(messaggi);
  assert.equal(storia.length, 6);
  assert.deepEqual(storia[0], { ruolo: 'utente', testo: 'm2' });
  assert.ok(storia.every((m) => Object.keys(m).join() === 'ruolo,testo'));
});

test('chat: il file archiviato diventa il documento della conversazione', () => {
  const nuovo = esitoAllegato({ ok: true, id: 'd1', titolo: 'Bolletta Enel' }, 'enel.pdf');
  assert.deepEqual(nuovo.documento, { id: 'd1', titolo: 'Bolletta Enel' });
  assert.equal(nuovo.messaggio.duplicato, false);
  assert.equal(esitoAllegato({ ok: true, duplicato: true, id: 'd2' }, 'x.jpg').messaggio.duplicato, true);
  assert.equal(esitoAllegato({ ok: true, duplicato: true, id: 'd2' }, 'x.jpg').documento.titolo, 'x.jpg');
  assert.equal(esitoAllegato({ ok: true }, 'x.jpg').documento, null);
  assert.equal(dimensioneFile(300), '1 KB');
  assert.equal(dimensioneFile(2.5 * 1048576), '2.5 MB');
  assert.match(ACCETTA_ALLEGATI, /image\/\*/);
  assert.match(ACCETTA_ALLEGATI, /application\/pdf/);
  assert.deepEqual(CHAT_VUOTA, { modo: 'ai', messaggi: [], documento: null });
});

test('chat: Poliedron è una scheda a pagina intera con la graffetta', () => {
  const leggi = (f) => readFileSync(new URL(`../personal/src/${f}`, import.meta.url), 'utf8');
  const app = leggi('App.jsx');
  const sezione = leggi('sezioni/poliedron/index.jsx');
  const vista = leggi('sezioni/poliedron/Poliedron.jsx');
  const documento = leggi('sezioni/documenti/Documento.jsx');
  const css = readFileSync(new URL('../personal/src/personal.css', import.meta.url), 'utf8');
  for (const src of [app, sezione, vista, documento]) assert.doesNotMatch(src, /PaginaChat|tipo: 'chat'/, 'non più una pagina sovrapposta');
  assert.match(app, /onClick=\{\(\) => vai\('poliedron'\)\} aria-label="Apri Poliedron"/);
  assert.match(sezione, /id: 'poliedron', nome: 'Poliedron', Icona: IconaChat, Vista: VistaPoliedron/);
  assert.match(app, /<Vista ctx=\{ctx\} \/>/);
  assert.match(app, /apriChat, chat, setChat,/);
  assert.match(vista, /const \{ apri, aggiorna, chat, setChat \} = ctx;/);
  assert.match(app, /const \[chat, setChat\] = useState\(CHAT_VUOTA\);/, 'la conversazione resta cambiando scheda');
  assert.match(documento, /ctx\.apriChat\(\{ id: doc\.id, titolo: titoloDoc\(doc\) \}\)/);
  assert.match(vista, /aria-label="Allega una foto, un PDF o un file"/);
  assert.match(vista, /type="file" accept=\{ACCETTA_ALLEGATI\}/);
  // Il file passa dal caricamento normale: stesse regole dell'archivio (duplicati, mai clinici al modello).
  assert.match(vista, /caricaDocumento\(\{ token: await tokenSessione\(\), \.\.\.\(await preparaCaricamento\(allegato\)\) \}\)/);
  assert.match(sezione, /senzaPiu: true/);
  assert.match(app, /!attuale\.senzaPiu && <button className="pp-fab"/);
  assert.match(css, /\.pp-app:has\(\.pp-contenuto-chat\) \{ height: 100dvh;/);
  assert.match(css, /\.pp-chat-lista \{ flex: 1; min-height: 0; overflow-y: auto;/);
});
