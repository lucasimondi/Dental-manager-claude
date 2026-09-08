import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const supabaseLib = readFileSync(new URL('../src/lib/supabase.js', import.meta.url), 'utf8');
const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');

// Product Owner: "Quando aggiungo impegno in agenda mi da errore di
// salvataggio e non si toglie più l'avviso, togli avviso, sistema la cosa
// che si possa memorizzare un impegno". Root cause: Agenda.jsx's
// saveImpegno() always includes a `recurrenceId` key (even null, for a
// non-repeating impegno) on every timed impegno it creates, to later group
// occurrences generated from the same "Ripeti" request — but
// `impegni_personali`'s real column is `recurrence_id` (verified live:
// information_schema.columns), and src/lib/supabase.js's FIELD_MAP never
// mapped the two, so `toDb()` sent the raw camelCase key straight through.
// PostgREST rejected it every time with "Could not find the 'recurrenceId'
// column of 'impegni_personali' in the schema cache" — every timed impegno
// save failed, always, for every user.
test('impegni_personali FIELD_MAP maps recurrenceId to the real recurrence_id column', () => {
  assert.match(
    supabaseLib,
    /impegni_personali:\s*\{[\s\S]*recurrenceId:\s*'recurrence_id'[\s\S]*?\}/,
  );
});

// The banner itself was reachable but rendered flush at the physical top
// edge with no safe-area-top allowance, unlike every other mobile surface
// in this app (see App.jsx's own paddingTop convention a few lines below
// it) — on a notched/status-bar phone its text and "✕" dismiss button sat
// under the OS status bar, making it easy to believe the alert "wouldn't go
// away" when it was in fact just hard to tap precisely.
test('sync error banner respects the mobile safe-area-inset-top like the rest of the app', () => {
  assert.match(
    app,
    /background: C\.danL,[\s\S]{0,40}padding:\s*`\$\{isMobile \? 'calc\(9px \+ env\(safe-area-inset-top, 0px\)\)' : '9px'\}/,
  );
});
