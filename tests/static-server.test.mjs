import { test } from 'node:test';
import assert from 'node:assert/strict';
import { request } from 'node:http';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startStaticServer } from '../scripts/lib/static-server.mjs';
for (const suffix of ['', '/', '///']) test(`static server normalizes root ${JSON.stringify(suffix)}, decodes files and rejects traversal`, async () => {
  const root = await mkdtemp(join(tmpdir(), 'static-test-'));
  await writeFile(join(root, 'hello world.txt'), 'hello');
  const server = await startStaticServer(root + suffix);
  const read = (path) => new Promise((resolve, reject) => {
    const req = request({ hostname: '127.0.0.1', port: server.address().port, path }, (res) => {
      let body = ''; res.on('data', (x) => body += x); res.on('end', () => resolve({ status: res.statusCode, body }));
    }); req.on('error', reject); req.end();
  });
  try {
    assert.deepEqual(await read('/hello%20world.txt'), { status: 200, body: 'hello' });
    assert.equal((await read('/%2e%2e%2foutside.txt')).status, 403);
    assert.equal((await read('/%')).status, 404);
    assert.equal((await read('http://[invalid')).status, 404);
    assert.equal((await read('/hello%20world.txt')).status, 200);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await rm(root, { recursive: true, force: true });
  }
});
