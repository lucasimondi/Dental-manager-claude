// PO 2026-10-17: "si è frizzato, si è ingrandito di colpo e non scrolla".
// Two modals closed in the other order used to leave the page locked.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('page scroll lock: released only after the last modal, whatever the closing order', async () => {
  globalThis.document = { body: { style: { overflow: '' } } };
  const src = readFileSync(new URL('../src/components/ui/Modal.jsx', import.meta.url), 'utf8');
  const fn = src.slice(src.indexOf('let openModals'), src.indexOf('export default function Modal'))
    .replace('export function lockPageScroll', 'function lockPageScroll');
  const lockPageScroll = new Function(`${fn}; return lockPageScroll;`)();
  const body = document.body.style;
  const closeFirst = lockPageScroll();
  const closeSecond = lockPageScroll();
  assert.equal(body.overflow, 'hidden');
  closeFirst();
  assert.equal(body.overflow, 'hidden', 'the second modal is still open');
  closeSecond();
  assert.equal(body.overflow, '', 'old behaviour left "hidden" here: the page could not scroll');
  closeSecond();
  const again = lockPageScroll();
  again();
  assert.equal(body.overflow, '', 'a double release never unbalances the count');
  assert.match(src, /useEffect\(\(\) => lockPageScroll\(\), \[\]\);/);
});
