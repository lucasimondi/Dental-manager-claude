import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { parse } from '@babel/parser';
import traversePkg from '@babel/traverse';

const traverse = traversePkg.default || traversePkg;

// POL-UI-039/040 root cause, found only after the Product Owner sent a
// screenshot of the real browser error: "Can't find variable:
// mobileOverlayHeight". `GridView` (a separate function component in
// Agenda.jsx, NOT the same function as the default-exported `Agenda`)
// renders the mobile appointment quick-action menu, and a POL-UI-039
// follow-up added a reference to `mobileOverlayHeight` there — a piece of
// state that only exists inside `Agenda`'s own function body. Every
// previous "fix" in this incident (CSS specificity, centering, retry-on-
// chunk-failure, hardReload clearing the service worker) was chasing a
// caching/layout theory; none of them could ever have caught a plain
// cross-function JS scoping mistake, because `npm run build` (esbuild)
// only checks syntax, not whether an identifier resolves at the point of
// use, and this codebase's own tests are all regex-on-source-text checks
// that never actually parse or execute the component tree.
//
// This test uses a real JS parser + scope analyzer (already a transitive
// dependency via the build toolchain) to catch exactly this class of bug:
// a referenced identifier with no reachable binding anywhere in its scope
// chain, in the one file that just broke production twice from it.
function findUnresolvedIdentifiers(code) {
  const ast = parse(code, { sourceType: 'module', plugins: ['jsx'] });
  // Real browser/runtime globals this file legitimately uses — anything
  // not in this list and not bound by an import/declaration is flagged.
  const knownGlobals = new Set([
    'window', 'document', 'navigator', 'console', 'fetch', 'Promise', 'Math', 'JSON',
    'Date', 'Array', 'Object', 'String', 'Number', 'Boolean', 'RegExp', 'Error', 'Map',
    'Set', 'Symbol', 'parseInt', 'parseFloat', 'isNaN', 'isFinite', 'setTimeout',
    'clearTimeout', 'setInterval', 'clearInterval', 'undefined', 'NaN', 'Infinity',
    'globalThis', 'ResizeObserver', 'IntersectionObserver', 'localStorage',
    'sessionStorage', 'FormData', 'Blob', 'File', 'URL', 'URLSearchParams',
    'AbortController', 'structuredClone', 'requestAnimationFrame', 'cancelAnimationFrame',
    'alert', 'confirm', 'prompt', 'crypto', 'encodeURIComponent', 'decodeURIComponent',
    'encodeURI', 'decodeURI', 'btoa', 'atob',
  ]);
  const found = [];
  const seen = new Set();
  traverse(ast, {
    ReferencedIdentifier(path) {
      const name = path.node.name;
      if (knownGlobals.has(name)) return;
      if (path.scope.getBinding(name)) return;
      const line = path.node.loc?.start.line;
      const key = `${name}:${line}`;
      if (seen.has(key)) return;
      seen.add(key);
      found.push({ name, line });
    },
  });
  return found;
}

test('the scope checker itself actually flags a cross-function reference (the exact bug pattern that shipped)', () => {
  const buggyPattern = `
    function Outer() {
      const [localState] = useState(0);
      return <div>{Inner()}</div>;
    }
    function Inner() {
      // localState belongs to Outer's scope, not Inner's — this must be flagged.
      return <div style={{ '--x': localState }} />;
    }
  `;
  const unresolved = findUnresolvedIdentifiers(buggyPattern);
  assert.ok(
    unresolved.some((u) => u.name === 'localState'),
    'the checker must catch a variable used outside the function scope that declares it',
  );
});

test('Agenda.jsx has no unresolved identifiers — GridView must receive every value it uses as a prop, not close over Agenda\'s own local state', () => {
  const code = readFileSync(new URL('../src/components/Agenda.jsx', import.meta.url), 'utf8');
  const unresolved = findUnresolvedIdentifiers(code);
  assert.deepEqual(
    unresolved,
    [],
    `found identifiers with no reachable binding: ${unresolved.map((u) => `${u.name} (line ${u.line})`).join(', ')}`,
  );
});

test('mobileOverlayHeight specifically is threaded from Agenda into GridView as a real prop, not left as a bare closure reference', () => {
  const code = readFileSync(new URL('../src/components/Agenda.jsx', import.meta.url), 'utf8');
  assert.match(code, /function GridView\(\{[^}]*\bmobileOverlayHeight\b[^}]*\}\)/s, 'GridView must destructure mobileOverlayHeight from its props');
  assert.match(code, /const gridProps = \{[^}]*\bmobileOverlayHeight\b[^}]*\};/s, 'Agenda must pass mobileOverlayHeight into gridProps, spread onto every <GridView>');
});
