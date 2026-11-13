// POL-VITA-031 CARTELLE-MIE — albero, ZIP (anche con password), migrazione solo additiva, collegamenti nell'app.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { costruisciAlbero, discendenti, percorso, destinazioniPossibili, elencoConPercorso, nomeFileDoc, nomeSicuro, rendiUnici, aggiungiDocumenti, togliDocumenti } from '../personal/src/lib/cartelleMie.js';
import { vociPacchetto, creaZip, scaricaFile } from '../personal/src/lib/pacchetto.js';

const C = [
  { id: 'casa', nome: 'Casa', padre_id: null, posizione: 0 },
  { id: 'utenze', nome: 'Utenze', padre_id: 'casa', posizione: 0 },
  { id: 'luce', nome: 'Luce', padre_id: 'utenze', posizione: 0 },
  { id: 'auto', nome: 'Auto', padre_id: null, posizione: 0 },
  { id: 'vecchia', nome: 'Vecchia', padre_id: 'casa', posizione: 0, archiviata_il: '2026-11-01T10:00:00Z' },
];
const doc = (id, titolo, extra = {}) => ({ id, titolo, drive_file_id: `f-${id}`, nome_file_originale: `${id}.pdf`, mime_type: 'application/pdf', fascicolo: 'utenze', ...extra });

test('albero ordinato, archiviate fuori', () => {
  const { radici, perId } = costruisciAlbero(C);
  assert.deepEqual(radici.map((c) => c.nome), ['Auto', 'Casa']);
  assert.deepEqual(perId.get('casa').figli.map((c) => c.nome), ['Utenze']);
  assert.equal(perId.has('vecchia'), false);
});

test('discendenti, percorso e destinazioni senza cicli', () => {
  assert.deepEqual([...discendenti(C, 'casa')].sort(), ['casa', 'luce', 'utenze', 'vecchia']);
  assert.deepEqual(percorso(C, 'luce').map((p) => p.nome), ['Casa', 'Utenze', 'Luce']);
  assert.deepEqual(destinazioniPossibili(C, ['utenze']).map((c) => c.id).sort(), ['auto', 'casa']);
  assert.deepEqual(elencoConPercorso(C).map((v) => v.nome), ['Auto', 'Casa', 'Casa › Utenze', 'Casa › Utenze › Luce']);
});

test('nomi di file sicuri e unici', () => {
  assert.equal(nomeSicuro('a/b:c*?'), 'a b c');
  assert.equal(nomeFileDoc({ titolo: 'Bolletta / novembre', nome_file_originale: 'x.PDF' }), 'Bolletta novembre.pdf');
  assert.equal(nomeFileDoc({ titolo: 'Foto', mime_type: 'image/jpeg' }), 'Foto.jpg');
  assert.deepEqual(rendiUnici(['A/x.pdf', 'A/X.pdf', 'A/x.pdf', 'B/x.pdf']), ['A/x.pdf', 'A/X (2).pdf', 'A/x (3).pdf', 'B/x.pdf']);
});

test('voci dello ZIP: sottocartelle con struttura, documenti singoli in radice, pazienti esclusi', () => {
  const righe = [
    { cartella_id: 'utenze', documenti: doc('d1', 'Contratto gas') },
    { cartella_id: 'luce', documenti: doc('d2', 'Bolletta') },
    { cartella_id: 'luce', documenti: doc('d3', 'Bolletta') },
    { cartella_id: 'luce', documenti: doc('p1', 'Referto', { fascicolo: 'clinico_pazienti' }) },
    { cartella_id: 'vecchia', documenti: doc('d9', 'Archiviata') },
  ];
  const r = vociPacchetto({ cartelle: C, cartelleScelte: ['utenze'], documentiScelti: [doc('d5', 'Polizza')], righe });
  assert.deepEqual(r.voci.map((v) => v.percorso).sort(), ['Polizza.pdf', 'Utenze/Contratto gas.pdf', 'Utenze/Luce/Bolletta (2).pdf', 'Utenze/Luce/Bolletta.pdf'].sort());
  assert.deepEqual(r.esclusi, ['Referto (paziente)']);
  // dalla radice «Casa» le archiviate non entrano
  const r2 = vociPacchetto({ cartelle: C, cartelleScelte: ['casa'], righe });
  assert.ok(r2.voci.every((v) => v.percorso.startsWith('Casa/')));
  assert.ok(!r2.voci.some((v) => v.percorso.includes('Archiviata')));
  assert.ok(r2.cartelleVuote.includes('Casa'));
});

test('scarica con avanzamento e raccoglie gli errori', async () => {
  const voci = [{ percorso: 'a.pdf', doc: { id: 1 } }, { percorso: 'b.pdf', doc: { id: 2 } }, { percorso: 'c.pdf', doc: { id: 3 } }];
  const passi = [];
  const r = await scaricaFile(voci, async (d) => { if (d.id === 2) throw new Error('no'); return new File([String(d.id)], `${d.id}`); }, (f, t) => passi.push(`${f}/${t}`));
  assert.deepEqual(r.file.map((f) => f.percorso), ['a.pdf', 'c.pdf']);
  assert.deepEqual(r.errori, ['b.pdf']);
  assert.equal(passi.at(-1), '3/3');
});

async function leggiZip(file, password) {
  const { ZipReader, BlobReader, TextWriter, configure } = await import('@zip.js/zip.js');
  configure({ useWebWorkers: false });
  const lettore = new ZipReader(new BlobReader(file), password ? { password } : {});
  const voci = await lettore.getEntries();
  const fuori = {};
  for (const v of voci) fuori[v.filename] = v.directory ? '/' : await v.getData(new TextWriter());
  await lettore.close();
  return { fuori, cifrati: voci.filter((v) => !v.directory).every((v) => v.encrypted) };
}

const fileProva = [
  { percorso: 'Casa/Utenze/bolletta.pdf', file: new File(['CONTENUTO BOLLETTA'], 'bolletta.pdf') },
  { percorso: 'polizza.pdf', file: new File(['CONTENUTO POLIZZA'], 'polizza.pdf') },
];

test('ZIP senza password: struttura e contenuti', async () => {
  const zip = await creaZip({ nome: 'Casa: 2026', file: fileProva, cartelleVuote: ['Casa/Vuota'] });
  assert.equal(zip.name, 'Casa 2026.zip');
  assert.equal(zip.type, 'application/zip');
  const { fuori, cifrati } = await leggiZip(zip);
  assert.equal(cifrati, false);
  assert.equal(fuori['Casa/Utenze/bolletta.pdf'], 'CONTENUTO BOLLETTA');
  assert.equal(fuori['polizza.pdf'], 'CONTENUTO POLIZZA');
  assert.equal(fuori['Casa/Vuota/'], '/');
});

for (const protezione of ['forte', 'compatibile']) {
  test(`ZIP con password (${protezione}): si apre solo con la password giusta`, async () => {
    const zip = await creaZip({ nome: 'Riservato', file: fileProva, password: 'Prova-2026', protezione });
    const ok = await leggiZip(zip, 'Prova-2026');
    assert.equal(ok.cifrati, true);
    assert.equal(ok.fuori['polizza.pdf'], 'CONTENUTO POLIZZA');
    await assert.rejects(() => leggiZip(zip, 'sbagliata'));
    await assert.rejects(() => leggiZip(zip));
    const grezzo = Buffer.from(await zip.arrayBuffer()).toString('latin1');
    assert.ok(!grezzo.includes('CONTENUTO POLIZZA'), 'il contenuto non si legge in chiaro');
  });
}

function dbFinto() {
  const chiamate = [];
  const catena = (q) => new Proxy({}, { get(_t, m) {
    if (m === 'then') return (ok) => Promise.resolve({ data: [], error: null }).then(ok);
    return (...a) => { q.passi.push([m, ...a]); return catena(q); };
  } });
  return { chiamate, from(t) { const q = { t, passi: [] }; chiamate.push(q); return catena(q); } };
}

test('aggiungere non duplica, togliere tocca solo quella cartella', async () => {
  const db = dbFinto();
  await aggiungiDocumenti(db, 'casa', ['d1', 'd2']);
  const up = db.chiamate[0].passi.find((p) => p[0] === 'upsert');
  assert.deepEqual(up[1], [{ cartella_id: 'casa', documento_id: 'd1' }, { cartella_id: 'casa', documento_id: 'd2' }]);
  assert.deepEqual(up[2], { onConflict: 'cartella_id,documento_id', ignoreDuplicates: true });
  await togliDocumenti(db, 'casa', ['d1']);
  const passi = db.chiamate[1].passi.map((p) => p[0]);
  assert.equal(db.chiamate[1].t, 'cartelle_mie_documenti');
  assert.deepEqual(passi.slice(0, 3), ['delete', 'eq', 'in']);
});

test('migrazione CARTELLE-MIE: solo aggiunte, RLS proprietario, niente cancellazioni di cartelle', () => {
  const sql = readFileSync('supabase/archivio/migrations/20261113090000_pol_vita_031_cartelle_mie.sql', 'utf8').toLowerCase();
  assert.ok(!/\bdrop\s+(table|column|function|index|trigger|view|policy)\b/.test(sql));
  assert.ok(!/\bdelete\s+from\b/.test(sql));
  assert.match(sql, /create policy proprietario on cartelle_mie for all to authenticated/);
  assert.match(sql, /create policy proprietario on cartelle_mie_documenti for all to authenticated/);
  assert.match(sql, /archiviata_il timestamptz/);
  assert.match(sql, /security_invoker = true/);
  assert.match(sql, /non può stare dentro una sua sottocartella/);
  const lib = readFileSync('personal/src/lib/cartelleMie.js', 'utf8');
  assert.ok(!/from\('cartelle_mie'\)\.delete/.test(lib), 'le cartelle si archiviano, non si cancellano');
});

test('collegamenti nell\'app: pagina, Chiedi, elenchi e scheda documento', () => {
  assert.match(readFileSync('personal/src/sezioni/documenti/index.jsx', 'utf8'), /'cartella-mia':/);
  assert.match(readFileSync('personal/src/sezioni/documenti/Chiedi.jsx', 'utf8'), /<CartelleInCima ctx=\{ctx\} \/>/);
  assert.match(readFileSync('personal/src/sezioni/documenti/Selezione.jsx', 'utf8'), /setFoglio\('mie'\)/);
  assert.match(readFileSync('personal/src/sezioni/documenti/Documento.jsx', 'utf8'), /<NelleMieCartelle doc=\{doc\} ctx=\{ctx\} \/>/);
  const pagina = readFileSync('personal/src/sezioni/documenti/CartelleMie.jsx', 'utf8');
  assert.ok(!/window\.(prompt|confirm)\(/.test(pagina), 'niente prompt/confirm: nell\'app Android non compaiono');
  assert.ok(!/localStorage|sessionStorage/.test(readFileSync('personal/src/lib/pacchetto.js', 'utf8')), 'la password non si salva');
});

/* ---------- POL-VITA-033 scrivania e trascinamento ---------- */
import { azioneTrascina, nomeProposto } from '../personal/src/lib/cartelleMie.js';

const T = [{ id: 'a', padre_id: null }, { id: 'b', padre_id: 'a' }, { id: 'c', padre_id: 'b' }, { id: 'z', padre_id: null }];

test('trascina: file su cartella = sposta dentro; cartella su cartella; niente cicli', () => {
  assert.deepEqual(azioneTrascina([{ tipo: 'doc', id: 'x' }], { tipo: 'cartella', id: 'z' }, 'a', T), { azione: 'sposta', documenti: ['x'], cartelle: [], verso: 'z' });
  assert.deepEqual(azioneTrascina([{ tipo: 'cartella', id: 'b' }], { tipo: 'cartella', id: 'z' }, 'a', T), { azione: 'sposta', documenti: [], cartelle: ['b'], verso: 'z' });
  assert.equal(azioneTrascina([{ tipo: 'cartella', id: 'a' }], { tipo: 'cartella', id: 'c' }, null, T), null, 'dentro una sua sottocartella');
  assert.equal(azioneTrascina([{ tipo: 'cartella', id: 'a' }], { tipo: 'cartella', id: 'a' }, null, T), null, 'su sé stessa');
});

test('trascina: file su file = nuova cartella; mai con cartelle o sullo stesso file', () => {
  assert.deepEqual(azioneTrascina([{ tipo: 'doc', id: 'x' }], { tipo: 'doc', id: 'y' }, null, T), { azione: 'raggruppa', documenti: ['x', 'y'] });
  assert.deepEqual(azioneTrascina([{ tipo: 'doc', id: 'x' }, { tipo: 'doc', id: 'w' }], { tipo: 'doc', id: 'y' }, 'a', T), { azione: 'raggruppa', documenti: ['x', 'w', 'y'] });
  assert.equal(azioneTrascina([{ tipo: 'doc', id: 'x' }], { tipo: 'doc', id: 'x' }, null, T), null);
  assert.equal(azioneTrascina([{ tipo: 'cartella', id: 'b' }], { tipo: 'doc', id: 'y' }, 'a', T), null);
});

test('trascina: in alto = fuori dalla cartella (verso il padre o la scrivania)', () => {
  assert.deepEqual(azioneTrascina([{ tipo: 'doc', id: 'x' }], { tipo: 'su', id: null }, 'b', T), { azione: 'sposta', documenti: ['x'], cartelle: [], verso: null });
  assert.deepEqual(azioneTrascina([{ tipo: 'doc', id: 'x' }], { tipo: 'su', id: 'a' }, 'b', T), { azione: 'sposta', documenti: ['x'], cartelle: [], verso: 'a' });
  assert.equal(azioneTrascina([{ tipo: 'doc', id: 'x' }], { tipo: 'su', id: 'b' }, 'b', T), null, 'già qui');
});

test('nome proposto: l\'ente comune, altrimenti «Nuova cartella»', () => {
  assert.equal(nomeProposto([{ ente: 'Enel' }, { ente: 'Enel ' }]), 'Enel');
  assert.equal(nomeProposto([{ ente: 'Enel' }, { ente: 'Hera' }]), 'Nuova cartella');
  assert.equal(nomeProposto([{}, {}]), 'Nuova cartella');
});

test('migrazione scrivania: solo aggiunte, RLS, funzioni con la RLS di chi chiama, cancella solo collegamenti', () => {
  const sql = readFileSync('supabase/archivio/migrations/20261113150000_pol_vita_033_scrivania.sql', 'utf8').toLowerCase();
  assert.ok(!/\bdrop\s+(table|column|function|index|trigger|view|policy)\b/.test(sql));
  assert.match(sql, /create policy proprietario on cartelle_mie_scrivania/);
  assert.equal((sql.match(/^security invoker$/gm) || []).length, 2);
  const cancellazioni = sql.match(/delete from \w+/g) || [];
  assert.deepEqual([...new Set(cancellazioni)].sort(), ['delete from cartelle_mie_documenti', 'delete from cartelle_mie_scrivania']);
  assert.match(sql, /revoke all on function sposta_documenti_mie\(uuid\[\], uuid, uuid\) from public, anon/);
});

test('scrivania a icone con trascinamento, senza prompt né emoji', () => {
  const pagina = readFileSync('personal/src/sezioni/documenti/CartelleMie.jsx', 'utf8');
  assert.match(pagina, /useTrascina\(/);
  assert.match(pagina, /data-bersaglio=\{`\$\{tipo === 'cartella' \? 'cartella' : 'doc'\}:\$\{voce\.id\}`\}/);
  assert.match(pagina, /Porta fuori da/);
  assert.ok(!/[\u{1F4C1}\u{1F4C4}]/u.test(pagina), 'niente emoji');
  const trascina = readFileSync('personal/src/sezioni/documenti/Trascina.jsx', 'utf8');
  assert.match(trascina, /passive: false/);
  assert.match(trascina, /onContextMenu/);
});
