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
  assert.match(source, /const handleBlur = \(\) => \{ blurTimeoutRef\.current = setTimeout\(\(\) => setFocused\(false\), 150\); \};/);
  assert.match(source, /onFocus=\{handleFocus\}/);
  assert.match(source, /onBlur=\{handleBlur\}/);
  assert.match(source, /useEffect\(\(\) => \(\) => clearTimeout\(blurTimeoutRef\.current\), \[\]\);/);
});

test('the "no results / create patient" panel also respects focus, not just typed text', () => {
  assert.match(source, /\{focused && search\.trim\(\) && filtered\.length === 0 && \(/);
});
