import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync('src/components/SchedaPaz.jsx', 'utf8');

test('production recovery uses the self-contained stable patient record', () => {
  assert.doesNotMatch(source, /from ['"]\.\.\/lib\/supabase/);
  assert.doesNotMatch(source, /useEffect|supabase\.|Promise\.all/);
});

test('patient recovery normalizes nullable collections and plan rows before render', () => {
  assert.match(source, /Array\.isArray\(plans\)/);
  assert.match(source, /Array\.isArray\(payments\)/);
  assert.match(source, /Array\.isArray\(appointments\)/);
  assert.match(source, /voci: Array\.isArray\(pl\.voci\) \? pl\.voci : \[\]/);
});

test('stable patient record keeps the essential patient workflows available', () => {
  for (const tab of ["'info'", "'piani'", "'paga'", "'app'"]) {
    assert.match(source, new RegExp(`id: ${tab}`));
  }
  assert.match(source, /onClose/);
  assert.match(source, /onEdit\(paz\)/);
  assert.match(source, /onNuovoPiano\(paz\.id\)/);
});
