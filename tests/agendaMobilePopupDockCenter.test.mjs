import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const agendaSource = await readFile(new URL('../src/components/Agenda.jsx', import.meta.url), 'utf8');
const premiumCss = await readFile(new URL('../src/components/PremiumVisualSystem.css', import.meta.url), 'utf8');

// Product Owner: "In agenda mobile quando clicco su appuntamento compare il
// popup ma non scrollabile e al di sotto del dock flottante, deve comparire
// in centro schermo e scrollabile così di possono selezionare i vari tasti"
// (POL-UI-039).
//
// Root cause, confirmed empirically in a real headless-Chromium repro (not
// just source reading — a prior single-class hypothesis was disproven in
// this same codebase this way): `.agenda-appointment-menu-backdrop`/`-sheet`
// were single-class selectors, so designTokens.css's `html .pol-modal-
// backdrop`/`html .pol-modal-sheet` base rules (element + class beats class
// alone, and the sheet rule is additionally `!important`) always won on the
// cascade. The dock/FAB clearance never actually applied: real computed
// padding-bottom was 0 and real computed max-height was the generic
// `100dvh - space-2`, so the sheet sat flush against the screen's bottom
// edge, overlapping the floating dock. Fixed by bumping both selectors to
// 2-class compound selectors (`.pol-modal-backdrop.agenda-appointment-menu-
// backdrop`, `.pol-modal-sheet.agenda-appointment-menu-sheet`) with
// `!important` on max-height — the same technique POL-UI-030 already used
// for the appointment form sheet, which never had bottom dock clearance at
// all and got it added here for the first time.

test('the quick-action menu backdrop/sheet selectors have enough specificity to actually beat designTokens.css\'s base rules', () => {
  assert.match(premiumCss, /\.pol-modal-backdrop\.agenda-appointment-menu-backdrop\s*\{/);
  assert.match(premiumCss, /\.pol-modal-sheet\.agenda-appointment-menu-sheet\s*\{/);
  const sheetRuleMatch = premiumCss.match(/\.pol-modal-sheet\.agenda-appointment-menu-sheet\s*\{([^}]*)\}/s);
  assert.ok(sheetRuleMatch, 'expected the compound-selector rule to exist');
  assert.match(sheetRuleMatch[1], /max-height:\s*calc\([\s\S]*?\)\s*!important;/);
});

test('the quick-action menu and the appointment form sheet both center on screen instead of bottom-anchoring', () => {
  assert.match(premiumCss, /\.pol-modal-backdrop\.agenda-appointment-menu-backdrop\s*\{[^}]*align-items:\s*center;/s);
  assert.match(premiumCss, /\.pol-modal-backdrop\.agenda-appointment-form-backdrop\s*\{[^}]*align-items:\s*center;/s);
});

test('the appointment form sheet now also reserves real bottom dock/FAB clearance, not just top clearance', () => {
  const formBackdropRule = premiumCss.match(/\.pol-modal-backdrop\.agenda-appointment-form-backdrop\s*\{([^}]*)\}/s);
  assert.ok(formBackdropRule, 'expected the form backdrop rule to exist');
  assert.match(formBackdropRule[1], /padding-bottom:\s*calc\(max\(var\(--agenda-mobile-dock-offset, 0px\), var\(--agenda-mobile-fab-offset, 0px\)\)/s);

  const formSheetRule = premiumCss.match(/\.pol-modal-sheet\.agenda-appointment-form-sheet\s*\{([^}]*)\}/s);
  assert.ok(formSheetRule, 'expected the form sheet rule to exist');
  assert.match(formSheetRule[1], /max-height:\s*calc\([\s\S]*?max\(var\(--agenda-mobile-dock-offset, 0px\), var\(--agenda-mobile-fab-offset, 0px\)\)[\s\S]*?\)\s*!important;/);
});

test('Agenda.jsx feeds the real dock/FAB offset constants into the form modal, mirroring what the quick-action menu already receives', () => {
  assert.match(
    agendaSource,
    /backdropStyle=\{\{\s*\n\s*'--agenda-mobile-overlay-clearance-form':[^\n]*\n\s*'--agenda-mobile-dock-offset':\s*`\$\{MOBILE_APPOINTMENT_MENU_DOCK_OFFSET\}px`,\s*\n\s*'--agenda-mobile-fab-offset':\s*`\$\{MOBILE_APPOINTMENT_MENU_FAB_OFFSET\}px`,/,
  );
});

test('the quick-action menu\'s scrollable actions area is untouched (still the working overflow-y:auto mechanism)', () => {
  assert.match(premiumCss, /\.agenda-appointment-menu-actions\s*\{[^}]*overflow-y:\s*auto;/s);
});
