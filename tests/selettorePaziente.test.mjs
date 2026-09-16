import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// POL-UI-020 follow-up: Product Owner — "il tab aggiungi spesa ha su
// mobile un menu a tendina che elenca i pazienti che però deve essere
// anche tolto senza selezionare alcun paziente perché copre altro". Con
// nessun paziente già selezionato (il caso di default in Spese.jsx, e in
// SpesaModal ogni volta che si toglie l'associazione), l'elenco completo
// si apriva al mount e non c'era modo di chiuderlo senza scegliere
// qualcuno. Ora si apre solo col focus e si chiude sfocando (delay per
// lasciare il tempo al click su una voce di registrarsi).
const source = fs.readFileSync(new URL('../src/components/ui/SelettorePaziente.jsx', import.meta.url), 'utf8');

test('the patient dropdown only opens while the field is focused, not merely because nothing is selected yet', () => {
  assert.match(source, /const \[focused, setFocused\] = useState\(false\);/);
  assert.match(source, /const showDropdown = focused && \(!sel \|\| search\);/);
  assert.match(source, /\{showDropdown && filtered\.length > 0 && \(/);
  assert.doesNotMatch(source, /\{\(!sel \|\| search\) && filtered\.length > 0 && \(/);
});

test('losing focus closes the dropdown (delayed so a click on a result or "create patient" still registers)', () => {
  assert.match(source, /const handleBlur = \(e\) => \{/);
  assert.match(source, /blurTimeoutRef\.current = setTimeout\(\(\) => setFocused\(false\), 150\);/);
  assert.match(source, /useEffect\(\(\) => \(\) => clearTimeout\(blurTimeoutRef\.current\), \[\]\);/);
});

// POL-UI-042: Product Owner — "se non esiste paziente ce la funzione crea
// che però funziona male, non fa compilare i dati". CreaPazienteInline
// monta i propri campi Nome/Cognome come elementi DOM separati dall'input
// di ricerca esterno: cliccarci dentro sfocava comunque l'input esterno e,
// dopo 150ms, chiudeva l'intero blocco (inclusi i campi appena cliccati),
// impedendo di scrivere. Il focus/blur ora è ascoltato sul contenitore
// esterno e ignora il blur quando il focus si sposta su un elemento
// dentro lo stesso widget (i campi di CreaPazienteInline inclusi).
test('focus/blur is handled on the outer wrapper (not just the search input), so clicking into CreaPazienteInline\'s own fields does not close the widget mid-typing', () => {
  assert.match(source, /<div style=\{\{ position: 'relative' \}\} onFocus=\{handleFocus\} onBlur=\{handleBlur\}>/);
  const inputBlock = source.slice(source.indexOf('<input'), source.indexOf('/>', source.indexOf('<input')));
  assert.doesNotMatch(inputBlock, /onFocus=\{handleFocus\}/);
  assert.doesNotMatch(inputBlock, /onBlur=\{handleBlur\}/);
  assert.match(source, /if \(e\.relatedTarget && e\.currentTarget\.contains\(e\.relatedTarget\)\) return;/);
});

test('the "no results / create patient" panel also respects focus, not just typed text', () => {
  assert.match(source, /\{focused && search\.trim\(\) && filtered\.length === 0 && \(/);
});
