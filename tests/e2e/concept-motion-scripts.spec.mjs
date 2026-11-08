// The detailed animation suites run once in CI alongside the browser matrix.
import { test } from '@playwright/test';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const run = promisify(execFile);
for (const script of ['check-motion-homepage.mjs', 'check-homepage-feedback.mjs', 'check-homepage-reflow.mjs']) {
  test(`homepage detailed checks: ${script}`, async ({}, info) => {
    test.skip(info.project.name !== 'chromium', 'Chromium motion detail suite; cross-browser page UX is covered separately');
    test.setTimeout(240000);
    let stdout = '', stderr = '';
    try {
      ({stdout, stderr} = await run(process.execPath, [`scripts/${script}`], { timeout: 225000, maxBuffer: 1024 * 1024 }));
    } catch (error) {
      stdout = error.stdout || ''; stderr = error.stderr || '';
      throw error;
    } finally {
      await info.attach('detailed-check-output', { body: stdout + stderr, contentType: 'text/plain' });
    }
  });
}
