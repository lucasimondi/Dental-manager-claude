import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { getMobileShellMode } from '../src/lib/mobileShell.js';

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const tokens = read('src/styles/designTokens.css');
const modal = read('src/components/ui/Modal.jsx');
const header = read('src/components/ui/PageHeader.jsx');
const uiIndex = read('src/components/ui/index.js');

test('required portrait widths preserve the intended shell modes', () => {
  for (const [width, height] of [[320,568],[360,800],[375,667],[390,844],[393,852],[430,932]]) {
    assert.equal(getMobileShellMode({ width, height, coarsePointer: false }), true, `${width}x${height}`);
  }
  assert.equal(getMobileShellMode({ width: 768, height: 1024, coarsePointer: true }), false);
  assert.equal(getMobileShellMode({ width: 1440, height: 900, coarsePointer: false }), false);
});

test('coarse-pointer landscape phones remain mobile without user-agent sniffing', () => {
  for (const [width, height] of [[844,390],[852,393],[932,430],[915,412]]) {
    assert.equal(getMobileShellMode({ width, height, coarsePointer: true }), true, `${width}x${height}`);
    assert.equal(getMobileShellMode({ width, height, coarsePointer: false }), false, `fine ${width}x${height}`);
  }
});

test('normal pages physically reserve dock, safe-area and visual-gap clearance', () => {
  assert.match(tokens, /#app-scroll:not\(:has\(\.agenda-mobile-page\)\):not\(:has\(\.poliedron-chat-host\)\):not\(:has\(\.home-widget-grid\)\)/);
  assert.match(tokens, /var\(--pol-mobile-dock-height\)/);
  assert.match(tokens, /var\(--pol-mobile-dock-bottom\)/);
  assert.match(tokens, /var\(--pol-mobile-dock-gap\)/);
  assert.match(tokens, /env\(safe-area-inset-bottom, 0px\)/);
  assert.match(tokens, /padding-bottom:[\s\S]*!important/);
});

test('shared shell supports normal and specialized one-scroller pages', () => {
  const shell = read('src/components/ui/MobilePageShell.jsx');
  assert.match(shell, /pol-mobile-page-shell--\$\{mode\}/);
  assert.match(tokens, /\.pol-mobile-page-shell--normal/);
  assert.match(tokens, /\.pol-mobile-page-shell--specialized/);
  assert.match(tokens, /overflow: hidden/);
});

test('touch contract keeps shared interactive wrappers at 44px', () => {
  assert.match(tokens, /--pol-touch-min: 44px/);
  for (const className of ['pol-btn','pol-icon-btn','pol-tab','pol-search-clear','pol-retry','pol-dismiss','pol-context-action']) {
    assert.ok(tokens.includes(`.${className}`), className);
  }
  assert.match(tokens, /min-width: var\(--pol-touch-min\)/);
  assert.match(tokens, /min-height: var\(--pol-touch-min\)/);
});

test('modal exposes standard, bottom-sheet and fullscreen-capable foundation', () => {
  assert.match(modal, /mobileVariant = 'standard'/);
  assert.match(modal, /data-mobile-variant=\{mobileVariant\}/);
  assert.match(modal, /role="dialog"/);
  assert.match(modal, /aria-modal="true"/);
  assert.match(modal, /pol-modal-header/);
  assert.match(modal, /pol-modal-content/);
  assert.match(modal, /pol-modal-footer/);
  assert.match(tokens, /100dvh/);
  assert.match(tokens, /data-mobile-variant="fullscreen"/);
  assert.match(tokens, /env\(keyboard-inset-height, 0px\)/);
});

test('PageHeader supports back, one primary action and secondary overflow', () => {
  assert.match(header, /onBack/);
  assert.match(header, /primaryAction/);
  assert.match(header, /secondaryActions/);
  assert.match(header, /pol-page-header__overflow-menu/);
  assert.match(header, /aria-label="Altre azioni"/);
});

test('loading, empty and error states share accessible semantics', () => {
  assert.match(uiIndex, /LoadingState/);
  assert.match(uiIndex, /EmptyState/);
  assert.match(uiIndex, /ErrorState/);
  assert.match(read('src/components/ui/LoadingState.jsx'), /role="status"/);
  assert.match(read('src/components/ui/ErrorState.jsx'), /role="alert"/);
  assert.match(read('src/components/ui/ErrorState.jsx'), /pol-retry/);
});

test('semantic tokens cover both light and dark foundation roles', () => {
  for (const token of ['--surface-page','--surface-card','--surface-elevated','--surface-overlay','--text-primary','--text-secondary','--text-muted','--brand-primary','--danger','--warning','--success']) {
    assert.ok(tokens.includes(token), token);
  }
  assert.match(tokens, /:root\[data-theme="dark"\][\s\S]*--surface-overlay/);
  for (const value of ['4px','8px','12px','16px','24px','32px']) assert.ok(tokens.includes(value));
  for (const value of ['--pol-radius-control: 10px','--pol-radius-card: 14px','--pol-radius-sheet: 20px']) assert.ok(tokens.includes(value));
});

test('Round 1 does not import or duplicate Polyedron, Chat, Agenda or Patient Workspace', () => {
  const changedFoundation = [tokens, modal, header, read('src/lib/mobileShell.js'), read('src/components/ui/MobilePageShell.jsx')].join('\n');
  assert.doesNotMatch(changedFoundation, /PatientWorkspaceV2|processQuery|conversationRepository|PoliedronOrb/);
});
