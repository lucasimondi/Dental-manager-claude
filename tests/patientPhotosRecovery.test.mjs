import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const photos = fs.readFileSync('src/components/PatientPhotos.jsx', 'utf8');

test('photo storage is patient-scoped, lazy-safe and sequential', () => {
  assert.match(photos, /list\(`\$\{patientId\}\/`/);
  assert.match(photos, /createSignedUrl\(`\$\{patientId\}\/\$\{file\.name\}`/);
  assert.doesNotMatch(photos, /Promise\.all/);
  assert.match(photos, /return \(\) => \{ active = false; \}/);
  assert.match(photos, /withTimeout/);
});

test('photo upload and delete retain the patient path', () => {
  assert.match(photos, /upload\(`\$\{patientId\}\//);
  assert.match(photos, /remove\(\[`\$\{patientId\}\/\$\{name\}`\]\)/);
});
