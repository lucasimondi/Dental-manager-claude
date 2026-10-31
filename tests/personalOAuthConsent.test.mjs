import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { authorizationIdFromSearch, consentRedirectUrl, isPersonalConsentPath } from '../personal/src/lib/oauthConsent.js';

test('Personal consent path reaches the Personal HTML before the Studio catch-all', () => {
  const config = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url)));
  for (const path of ['/oauth/consent', '/oauth/consent/']) {
    assert.equal(isPersonalConsentPath(path), true);
    const firstMatch = config.rewrites.find(r => r.source === path || r.source === '/(.*)');
    assert.equal(firstMatch.destination, '/personal/index.html');
  }
  for (const path of ['/connector/consent', '/personal/', '/oauth/consent-other']) assert.equal(isPersonalConsentPath(path), false);
});

test('authorization request must be a single opaque ID; callback query input is ignored', () => {
  assert.equal(authorizationIdFromSearch('?authorization_id=abc-123_xyz&redirect_url=https://untrusted.invalid'), 'abc-123_xyz');
  for (const search of ['', '?authorization_id=', '?authorization_id=a&authorization_id=b', '?authorization_id=%3Cscript%3E', `?authorization_id=${'a'.repeat(257)}`]) {
    assert.throws(() => authorizationIdFromSearch(search));
  }
});

test('OAuth server destinations require absolute HTTPS without embedded credentials', () => {
  assert.equal(consentRedirectUrl('https://chatgpt.com/callback?code=synthetic&state=test'), 'https://chatgpt.com/callback?code=synthetic&state=test');
  for (const value of ['javascript:alert(1)', '//evil.invalid', '/callback', 'http://example.invalid', 'https://user:password@example.invalid']) assert.throws(() => consentRedirectUrl(value));
});
