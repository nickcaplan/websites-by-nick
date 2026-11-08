import { test } from 'node:test';
import assert from 'node:assert/strict';
import { request } from 'node:http';
import { mkdtemp, writeFile, rm, mkdir, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startStaticServer } from '../scripts/lib/static-server.mjs';
for (const suffix of ['', '/', '///']) test(`static server normalizes root ${JSON.stringify(suffix)}, decodes files and rejects traversal`, async () => {
  const root = await mkdtemp(join(tmpdir(), 'static.test-'));
  let outside, server;
  try {
  await writeFile(join(root, 'hello world.css'), 'hello');
  await writeFile(join(root, 'index.html'), 'root index');
  await mkdir(join(root, 'homepage-concepts', 'folder.name'), {recursive:true});
  await writeFile(join(root, 'homepage-concepts', 'folder.name', 'index.html'), 'dotted index');
  await mkdir(join(root, 'assets'));
  await writeFile(join(root, 'assets', 'test.css'), 'asset fixture');
  await mkdir(join(root, '.git'));
  await writeFile(join(root, '.git', 'config'), 'synthetic secret');
  await writeFile(join(root, '.env.local'), 'synthetic secret');
  await writeFile(join(root, 'package.json'), '{}');
  await mkdir(join(root, 'scripts'));
  await writeFile(join(root, 'scripts', 'private.js'), 'private');
  // Windows requires Developer Mode or symbolic-link permission for these fixtures.
  await symlink(join(root, 'scripts', 'private.js'), join(root, 'linked.js'));
  outside = await mkdtemp(join(tmpdir(), 'static-outside-'));
  await writeFile(join(outside, 'secret.html'), 'synthetic outside');
  await symlink(join(outside, 'secret.html'), join(root, 'escape.html'));
  await symlink(join(root, '.env.local'), join(root, 'disguised.css'));
  server = await startStaticServer(root + suffix);
  const read = (path, headers={}) => new Promise((resolve, reject) => {
    const req = request({ hostname: '127.0.0.1', port: server.address().port, path, headers }, (res) => {
      let body = ''; res.on('data', (x) => body += x); res.on('end', () => resolve({ status: res.statusCode, body }));
    }); req.on('error', reject); req.end();
  });
    for (const path of ['/.git/config','/.env.local','/package.json','/escape.html','/disguised.css','/scripts/private.js','/linked.js']) assert.equal((await read(path)).status,403,path);
    assert.equal((await read('/', {host:'attacker.invalid:'+server.address().port})).status,403);
    assert.equal((await read('/', {host:'localhost:1'})).status,403);
    assert.deepEqual(await read('/assets/test.css'), {status:200,body:'asset fixture'});
    assert.deepEqual(await read('/'), { status: 200, body: 'root index' });
    assert.deepEqual(await read('/homepage-concepts/folder.name/'), { status: 200, body: 'dotted index' });
    assert.deepEqual(await read('/hello%20world.css'), { status: 200, body: 'hello' });
    assert.equal((await read('/%2e%2e%2foutside.txt')).status, 403);
    assert.equal((await read('/%')).status, 404);
    assert.equal((await read('http://[invalid')).status, 404);
    assert.equal((await read('/hello%20world.css')).status, 200);
  } finally {
    if (server) await new Promise((resolve) => server.close(resolve));
    if (outside) await rm(outside, {recursive:true,force:true});
    await rm(root, { recursive: true, force: true });
  }
});
