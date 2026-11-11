// ACQUISISCI-UNICO (PO 2026-11-10): un tasto flottante in basso a destra, sopra il «+», in Studio e in
// Personal; dopo lo scatto si sceglie dove archiviare: Personale o Studio (paziente).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = p => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('lo stesso tasto in Studio e Personal, sopra il «+» e sopra il dock', () => {
  assert.match(read('shared/acquisisci/TastoAcquisisci.jsx'), /aria-label="Acquisisci documento"/);
  assert.match(read('personal/src/App.jsx'), /<TastoAcquisisci className="pp-acquisisci" onClick=\{\(\) => apri\(\{ tipo: 'scansione', opzioni: \{ destinazione: true \} \}\)\} \/>/);
  assert.match(read('src/App.jsx'), /<TastoAcquisisci className="studio-acquisisci" onClick=\{\(\) => setAcquisisciAperto\(true\)\} \/>/);
  assert.match(read('personal/src/personal.css'), /\.pp-acquisisci \{[^}]*--acquisisci-bottom: calc\(88px \+ 56px \+ 12px/);
  assert.match(read('shared/acquisisci/acquisisci.css'), /\.app-shell--mobile \.studio-acquisisci \{[^}]*--pol-mobile-dock-height/);
});

test('Personal: dopo lo scatto si sceglie Personale o Studio · paziente', () => {
  const carica = read('personal/src/sezioni/documenti/Carica.jsx');
  assert.match(carica, /opzioni\.destinazione && <div className="pp-campo"><span>Dove archiviare<\/span><Segmenti voci=\{\[\['personale', 'Personale'\], \['studio', 'Studio · paziente'\]\]\}/);
  assert.match(read('personal/src/sezioni/documenti/ArchiviaStudio.jsx'), /archiviaDocumentoStudio\(\{ file, titolo, tipo, tag, pazienteId: paziente\?\.id \|\| null \}\)/);
  // L'unica scrittura di Personal sui documenti dello studio è in lib/studio.js, con la stessa funzione di Studio.
  const studio = read('personal/src/lib/studio.js');
  assert.match(studio, /export async function archiviaDocumentoStudio/);
  assert.match(studio, /from '\.\.\/\.\.\/\.\.\/shared\/documenti\/documentiStudio\.js'/);
});

test('Studio: «Acquisisci documento» dal tasto offre anche il personale, senza nuovo accesso', () => {
  const acq = read('src/components/AcquisisciDocumento.jsx');
  assert.match(acq, /\[\['studio', 'Studio · paziente'\], \['personale', 'Personale'\]\]/);
  assert.match(acq, /if \(dove === 'personale'\) \{ const r = await archiviaInPersonale\(file, titolo, tag, tipo\);/);
  const pers = read('src/lib/archiviaPersonale.js');
  assert.match(pers, /Archivio personale non collegato/);
  assert.match(pers, /caricaDocumento\(\{ token: s\.access_token, \.\.\.pronto, descrizione, categoria: categoria \|\| null \}\)/);
  assert.match(read('src/lib/documentiStudio.js'), /export \* from '\.\.\/\.\.\/shared\/documenti\/documentiStudio\.js'/);
});
