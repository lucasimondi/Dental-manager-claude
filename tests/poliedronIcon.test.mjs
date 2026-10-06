import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url));

test('approved phone icons are opaque RGB PNGs at platform-required dimensions', () => {
  for (const [name, size] of [['180', 180], ['192', 192], ['512', 512], ['maskable-512', 512]]) {
    const png = read(`public/poliedron-v2-${name}.png`);
    assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    assert.equal(png.toString('ascii', 12, 16), 'IHDR');
    assert.equal(png.readUInt32BE(16), size);
    assert.equal(png.readUInt32BE(20), size);
    assert.equal(png[24], 8);
    assert.equal(png[25], 2, 'RGB without alpha: OS applies its own mask');
    assert.equal(png.includes(Buffer.from('tRNS')), false);
  }
  assert.deepEqual(read('public/poliedron-v2-512.png'), read('public/poliedron-v2-maskable-512.png'));
});

test('dedicated install entry and offline fallback share v2 identity; root brand stays separate', () => {
  const manifest = JSON.parse(read('public/poliedron.webmanifest'));
  assert.deepEqual(manifest.icons.map((i) => i.src), [
    '/poliedron-v2-192.png', '/poliedron-v2-512.png', '/poliedron-v2-maskable-512.png',
  ]);
  assert.equal(manifest.icons.at(-1).purpose, 'maskable');
  assert.match(read('poliedron/index.html').toString(), /apple-touch-icon" href="\/poliedron-v2-180\.png/);
  assert.match(read('src/main.jsx').toString(), /setAttribute\('href', '\/poliedron-v2-180\.png'\)/);
  assert.doesNotMatch(read('index.html').toString(), /poliedron-v2/);
  assert.match(read('vite.config.js').toString(), /poliedron-\*\.png/);
});
