import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { shouldBuild } from '../scripts/netlify-ignore.mjs';

const env = { PULL_REQUEST: 'true', REVIEW_ID: '137' };
const quiet = () => {};
const response = labels => async () => ({ ok: true, json: async () => ({ labels }) });

test('only the exact preview label enables a build', async () => {
  for (const [labels, expected] of [[[{ name: 'preview' }], true], [[{ name: 'bug' }, { name: 'preview' }], true], [[], false], [[{ name: 'Preview' }], false], [[{ name: 'preview-other' }], false], [null, false], [[null], false]]) {
    assert.equal(await shouldBuild(env, response(labels), quiet), expected);
  }
});
test('missing or invalid PR context skips without requesting GitHub', async () => {
  for (const context of [{}, { REVIEW_ID: '137' }, { PULL_REQUEST: 'false', REVIEW_ID: '137' }, { PULL_REQUEST: 'true' }, { ...env, REVIEW_ID: '../137' }, { ...env, REVIEW_ID: '0' }]) {
    assert.equal(await shouldBuild(context, () => assert.fail('must not request GitHub'), quiet), false);
  }
});
test('API errors, network failures and invalid JSON all skip', async () => {
  for (const request of [async () => ({ ok: false, status: 403 }), async () => ({ ok: false, status: 500 }), async () => { throw new Error('offline'); }, async () => ({ ok: true, json: async () => { throw new Error('invalid JSON'); } }), async () => ({ ok: true, json: async () => null })]) {
    assert.equal(await shouldBuild(env, request, quiet), false);
  }
});
test('verified request uses the fixed repository and review ID', async () => {
  assert.equal(await shouldBuild(env, async (url, options) => {
    assert.equal(url, 'https://api.github.com/repos/nickcaplan/websites-by-nick/pulls/137');
    assert.equal(options.headers.Accept, 'application/vnd.github+json');
    return { ok: true, json: async () => ({ labels: [{ name: 'preview' }] }) };
  }, quiet), true);
});
test('CLI exits zero to skip when PR context is absent', () => {
  const result = spawnSync(process.execPath, ['scripts/netlify-ignore.mjs'], { env: { ...process.env, PULL_REQUEST: '', REVIEW_ID: '' }, encoding: 'utf8' });
  assert.equal(result.status, 0);
  assert.match(result.stdout, /skipping/);
});
