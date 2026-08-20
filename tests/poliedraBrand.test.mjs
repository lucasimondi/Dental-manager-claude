import test from 'node:test';
import assert from 'node:assert/strict';
import { LOGO_SLUG_PER_VERTICAL, LOGO_SLUG_LABEL, getLogoSlug } from '../src/lib/utils.js';

// POL-UX-002 section 4: the sidebar/mobile-header brand lockup (PoliedraBrand)
// renders LOGO_SLUG_LABEL[getLogoSlug(vertical)] as the vertical descriptor
// text ("Poliedra Dental", "Poliedra Physio", ...). Every slug a vertical can
// resolve to (including the "salus" default for unmapped verticals) must have
// a label, or the brand lockup would render an empty/undefined descriptor.
test('every logo slug reachable via getLogoSlug has a display label', () => {
  const reachableSlugs = new Set([...Object.values(LOGO_SLUG_PER_VERTICAL), 'salus']);
  for (const slug of reachableSlugs) {
    assert.ok(LOGO_SLUG_LABEL[slug], `LOGO_SLUG_LABEL is missing an entry for slug "${slug}"`);
  }
});

test('getLogoSlug falls back to salus for an unmapped or missing vertical', () => {
  assert.equal(getLogoSlug('some_future_vertical'), 'salus');
  assert.equal(getLogoSlug(undefined), 'salus');
  assert.equal(LOGO_SLUG_LABEL[getLogoSlug(undefined)], 'Salus');
});

test('a known vertical resolves to its expected brand descriptor', () => {
  assert.equal(LOGO_SLUG_LABEL[getLogoSlug('dentistico')], 'Dental');
  assert.equal(LOGO_SLUG_LABEL[getLogoSlug('fisioterapista')], 'Physio');
});
