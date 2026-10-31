import test from 'node:test';
import assert from 'node:assert/strict';
import { handler } from './server.mjs';
import { createServer } from 'node:http';

test('health endpoint identifies content reading and existing upload support', async () => {
  const server = createServer(handler());
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const port = server.address().port;
    const response = await fetch(`http://127.0.0.1:${port}/health`);
    assert.equal(response.status, 200);
    const result = await response.json();
    assert.equal(result.mode, 'read-write');
    assert.equal(result.document_content, true);
  } finally { await new Promise(resolve => server.close(resolve)); }
});

test('no token never grants MCP access', async () => {
  const server = createServer(handler());
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const port = server.address().port;
    const response = await fetch(`http://127.0.0.1:${port}/mcp`, {method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/list'})});
    assert.ok([401,503].includes(response.status));
  } finally { await new Promise(resolve => server.close(resolve)); }
});
