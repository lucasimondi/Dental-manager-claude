import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { runModelTask } from '../src/lib/poliedron/modelGateway.js';
import { processQuery } from '../src/lib/poliedron/poliedraCore.js';
import {
  ATTACHMENT_ONLY_TEXT,
  MAX_PDF_BYTES,
  attachmentKind,
  attachmentMetadata,
  attachmentPayload,
  attachmentProblem,
  formatAttachmentSize,
  scaledSize,
} from '../src/lib/poliedron/chatAttachment.js';
import {
  MAX_BYTE_IMMAGINE,
  MAX_BYTE_PDF,
  messaggiConAllegato,
  senzaDatiAllegato,
  validaAllegato,
} from '../supabase/functions/agente-assistente/allegato.js';

// POL-AI-008 — documenti e foto allegati alla Chat Poliedron.

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const controller = read('../src/components/poliedron/Poliedron.jsx');
const chatPage = read('../src/components/poliedron/PoliedronChatPage.jsx');
const edge = read('../supabase/functions/agente-assistente/index.ts');

const PDF = { nome: 'referto.pdf', media_type: 'application/pdf', data: 'JVBERi0xLjQK' };

const fakeClient = (sink, reply = { text: 'Il referto indica…' }) => ({
  functions: {
    invoke: async (name, options) => {
      sink.push({ name, body: options.body });
      return { data: reply, error: null };
    },
  },
});

test('the client and the Edge Function use the same PDF limit', () => {
  assert.equal(MAX_PDF_BYTES, MAX_BYTE_PDF);
  assert.equal(MAX_BYTE_IMMAGINE, 5 * 1024 * 1024);
});

test('only PDFs and photos can be attached, within the size limits', () => {
  assert.equal(attachmentKind({ type: 'application/pdf', name: 'a.pdf' }), 'pdf');
  assert.equal(attachmentKind({ type: '', name: 'Scan.PDF' }), 'pdf');
  assert.equal(attachmentKind({ type: 'image/heic', name: 'IMG_1.heic' }), 'image');
  assert.equal(attachmentKind({ type: 'text/plain', name: 'a.txt' }), null);
  assert.equal(attachmentProblem({ type: 'application/pdf', name: 'a.pdf', size: 1000 }), null);
  assert.match(attachmentProblem({ type: 'application/pdf', name: 'a.pdf', size: MAX_PDF_BYTES + 1 }), /troppo grande/);
  assert.match(attachmentProblem({ type: 'application/zip', name: 'a.zip', size: 10 }), /Formato non supportato/);
  assert.match(attachmentProblem({ type: 'image/jpeg', name: 'a.jpg', size: 0 }), /vuoto/);
  assert.match(attachmentProblem(null), /Nessun file/);
});

test('photos are scaled so the long side is at most 2048 px, never enlarged', () => {
  assert.deepEqual(scaledSize(4032, 3024), { width: 2048, height: 1536 });
  assert.deepEqual(scaledSize(3024, 4032), { width: 1536, height: 2048 });
  assert.deepEqual(scaledSize(800, 600), { width: 800, height: 600 });
  assert.equal(formatAttachmentSize(512 * 1024), '512 kB');
  assert.equal(formatAttachmentSize(1.5 * 1024 * 1024), '1,5 MB');
});

test('the database only ever receives name, type and size — never the file content', () => {
  const attachment = { name: 'referto.pdf', mediaType: 'application/pdf', size: 1234, data: 'JVBERi0xLjQK' };
  assert.deepEqual(attachmentMetadata(attachment), { nome: 'referto.pdf', tipo: 'application/pdf', dimensione: 1234 });
  assert.deepEqual(attachmentPayload(attachment), PDF);
  assert.match(controller, /metadata: \{ allegato: attachmentMetadata\(attachment\) \}/);
  assert.doesNotMatch(controller, /metadata: \{[^}]*\bdata\b/);
});

test('the gateway adds the file to the current request only; history and messages stay plain text', async () => {
  const calls = [];
  await runModelTask({
    taskType: 'ASK',
    input: 'Cosa dice?',
    history: [{ role: 'user', content: 'Ciao' }, { role: 'assistant', content: 'Ciao!' }],
    supabaseClient: fakeClient(calls),
    attachment: PDF,
  });
  assert.equal(calls[0].name, 'agente-assistente');
  assert.deepEqual(calls[0].body.allegato, PDF);
  assert.deepEqual(calls[0].body.messages, [
    { role: 'user', content: 'Ciao' },
    { role: 'assistant', content: 'Ciao!' },
    { role: 'user', content: 'Cosa dice?' },
  ]);

  const plain = [];
  await runModelTask({ taskType: 'ASK', input: 'Ciao', supabaseClient: fakeClient(plain) });
  assert.equal('allegato' in plain[0].body, false);
});

test('a message with a file always reaches the model, even when its text looks like a command', async () => {
  const calls = [];
  const result = await processQuery({
    query: 'vai in agenda',
    context: { page: 'chat' },
    sources: { navigationIndex: [{ id: 'agenda', label: 'Agenda', keywords: ['agenda'] }] },
    supabaseClient: fakeClient(calls),
    allowModel: true,
    attachment: PDF,
  });
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].body.allegato, PDF);
  assert.equal(result.answer, 'Il referto indica…');
  assert.equal(result.directNavigation, undefined);

  const quick = await processQuery({ query: ATTACHMENT_ONLY_TEXT, supabaseClient: fakeClient([]), allowModel: false, attachment: PDF });
  assert.equal(quick.awaitingSubmit, true);
});

test('a model error with a file is reported, not hidden behind a fake answer', async () => {
  const result = await processQuery({
    query: 'Leggi',
    supabaseClient: fakeClient([], { error: 'Il file è troppo grande (massimo 6 MB).' }),
    attachment: PDF,
  });
  assert.equal(result.modelError, 'Il file è troppo grande (massimo 6 MB).');
});

test('Edge Function: accepts PDF and photos, rejects anything else or oversized', () => {
  assert.deepEqual(validaAllegato(PDF), { genere: 'document', tipo: 'application/pdf', dati: PDF.data, nome: 'referto.pdf' });
  assert.equal(validaAllegato({ media_type: 'image/jpeg', data: '/9j/4AAQ' }).genere, 'image');
  assert.equal(validaAllegato({ media_type: 'image/jpeg', data: '/9j/4AAQ' }).nome, 'immagine');
  assert.throws(() => validaAllegato({ media_type: 'text/html', data: 'PGI+' }), /Formato non supportato/);
  assert.throws(() => validaAllegato({ media_type: 'application/pdf', data: 'non base64!' }), /non valido/);
  assert.throws(() => validaAllegato({ media_type: 'application/pdf', data: '' }), /non valido/);
  assert.throws(() => validaAllegato({ media_type: 'constructor', data: 'JVBE' }), /Formato non supportato/);
  assert.throws(() => validaAllegato('x'), /non valido/);
  const tooBig = 'A'.repeat(Math.ceil((MAX_BYTE_PDF + 3) / 3) * 4);
  assert.throws(() => validaAllegato({ media_type: 'application/pdf', data: tooBig }), /troppo grande \(massimo 6 MB\)/);
  const bigImage = 'A'.repeat(Math.ceil((MAX_BYTE_IMMAGINE + 3) / 3) * 4);
  assert.throws(() => validaAllegato({ media_type: 'image/png', data: bigImage }), /massimo 5 MB/);
  assert.equal(validaAllegato({ ...PDF, nome: 'a\u0000b\n.pdf' }).nome, 'ab.pdf');
});

test('Edge Function: the file becomes a cached block of the last user message, and is not echoed back', () => {
  const allegato = validaAllegato(PDF);
  const convo = messaggiConAllegato([
    { role: 'user', content: 'Ciao' },
    { role: 'assistant', content: 'Ciao!' },
    { role: 'user', content: 'Cosa dice il referto?' },
  ], allegato);
  assert.deepEqual(convo.slice(0, 2), [{ role: 'user', content: 'Ciao' }, { role: 'assistant', content: 'Ciao!' }]);
  const [blocco, testo] = convo[2].content;
  assert.deepEqual(blocco, {
    type: 'document',
    source: { type: 'base64', media_type: 'application/pdf', data: PDF.data },
    cache_control: { type: 'ephemeral' },
  });
  assert.equal(testo.type, 'text');
  assert.match(testo.text, /^Cosa dice il referto\?/);
  assert.match(testo.text, /referto\.pdf/);
  assert.throws(() => messaggiConAllegato([{ role: 'assistant', content: 'x' }], allegato), /senza messaggio/);

  const echoed = JSON.stringify(senzaDatiAllegato(convo));
  assert.doesNotMatch(echoed, new RegExp(PDF.data));
  assert.match(echoed, /\[file allegato\]/);
});

test('Edge Function wiring: validated before use, not allowed with confirmations or the team', () => {
  assert.match(edge, /const \{ messages, confirm, team, allegato: allegatoRichiesta \} = await req\.json\(\);/);
  assert.match(edge, /if \(confirm \|\| richiestaTeam\) return json\(\{ error: 'Gli allegati/);
  assert.match(edge, /allegato = validaAllegato\(allegatoRichiesta\);/);
  assert.match(edge, /convo = messaggiConAllegato\(messages, allegato\);/);
  assert.match(edge, /messages: allegato \? senzaDatiAllegato\(convo\) : convo/);
  // Il controllo dei messaggi di testo resta quello di prima.
  assert.match(edge, /typeof m\.content !== 'string' \|\| m\.content\.length > 16000\)\) throw new Error\('Messaggi non validi'\)/);
});

test('Chat UI: paperclip, removable file chip, file-only send, retry needs the file in memory', () => {
  assert.match(chatPage, /aria-label="Allega un PDF o una foto"/);
  assert.match(chatPage, /accept=\{ATTACHMENT_ACCEPT\}/);
  assert.match(chatPage, /'Rimuovi allegato'/);
  assert.match(chatPage, /const value = draft\.trim\(\) \|\| \(attachment \? ATTACHMENT_ONLY_TEXT : ''\);/);
  assert.match(chatPage, /message\.metadata\?\.allegato/);
  assert.match(controller, /attachmentsByRequestRef\.current\.get\(retryMessage\.request_id\)/);
  assert.match(controller, /non è più disponibile: allegalo di nuovo/);
  assert.match(controller, /attachment: attachmentPayload\(attachment\)/);
  assert.match(controller, /: !attachment && pendingChatRequestRef\.current\?\.content === text/);
});
