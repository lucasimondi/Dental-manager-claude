// POL-VITA-002 — dashboard dell'archivio personale pubblicata su /archivio/ del sito esistente.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const config = readFileSync('vite.config.js', 'utf8');
const vercel = JSON.parse(readFileSync('vercel.json', 'utf8'));
const dashboard = readFileSync('poliedron/archivio/index.html', 'utf8');

test('la build copia la dashboard (fonte unica) su /archivio/', () => {
  assert.match(config, /copyFileSync\(resolve\('poliedron\/archivio\/index\.html'\), resolve\('dist\/archivio\/index\.html'\)\)/);
});

test('/archivio ha le sue rewrite prima di quella generale e non passa dal service worker dello studio', () => {
  const i = (src) => vercel.rewrites.findIndex((r) => r.source === src);
  assert.ok(i('/archivio/') >= 0 && i('/archivio/') < i('/(.*)'));
  assert.equal(vercel.rewrites[i('/archivio/')].destination, '/archivio/index.html');
  assert.match(config, /navigateFallbackDenylist: \[[^\]]*\/\^\\\/archivio\//);
});

test('la dashboard usa solo il progetto archivio-documenti e la chiave pubblica', () => {
  assert.match(dashboard, /https:\/\/tkcwvjzjkfhcuebrjvsp\.supabase\.co/);
  assert.doesNotMatch(dashboard, /idklxdqebfceplrualgh/, 'mai il progetto dello studio');
  assert.doesNotMatch(dashboard, /sb_secret_|service_role|sk-ant-/, 'nessuna chiave segreta');
});

test('lo script Apps Script carica solo Code.gs e appsscript.json', () => {
  assert.equal(readFileSync('poliedron/archivio/.claspignore', 'utf8').trim(), '**/**\n!Code.gs\n!appsscript.json');
  const clasp = JSON.parse(readFileSync('poliedron/archivio/.clasp.json', 'utf8'));
  assert.match(clasp.scriptId, /^[\w-]{20,}$/);
  assert.equal(Object.keys(clasp).some((k) => /token|secret|key/i.test(k)), false);
});

test('/poliedron/archivio/ apre la dashboard anche con un service worker dello studio non aggiornato', () => {
  const i = (src) => vercel.rewrites.findIndex((r) => r.source === src);
  for (const src of ['/poliedron/archivio', '/poliedron/archivio/']) {
    assert.ok(i(src) >= 0 && i(src) < i('/poliedron/') && i(src) < i('/(.*)'), src);
    assert.equal(vercel.rewrites[i(src)].destination, '/archivio/index.html');
  }
});
