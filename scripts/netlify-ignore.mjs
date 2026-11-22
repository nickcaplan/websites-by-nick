/**
 * Netlify ignore command: exit 1 builds, exit 0 skips.
 * Build only a verified PR carrying the preview label. Missing context or a
 * failed label check skips the build, even if that PR was actually labelled.
 * Production hosting is Cloudflare Pages, unaffected by this Netlify gate.
 */
import { pathToFileURL } from 'node:url';

export async function shouldBuild(env = process.env, request = fetch, log = console.log) {
  const { PULL_REQUEST, REVIEW_ID } = env;
  if (PULL_REQUEST !== 'true' || !/^[1-9]\d*$/.test(REVIEW_ID || '')) {
    log('No valid PR context: skipping Netlify build.');
    return false;
  }
  try {
    const res = await request(`https://api.github.com/repos/nickcaplan/websites-by-nick/pulls/${REVIEW_ID}`, {
      headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'netlify-ignore' },
    });
    if (!res.ok) {
      log(`Could not verify PR labels (GitHub API HTTP ${res.status}): skipping Netlify build.`);
      return false;
    }
    const pr = await res.json();
    const allowed = Array.isArray(pr?.labels) && pr.labels.some(label => label?.name === 'preview');
    log(allowed ? 'Verified preview label: building Netlify preview.' : 'No preview label: skipping Netlify build.');
    return allowed;
  } catch {
    log('Could not verify PR labels: skipping Netlify build.');
    return false;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit((await shouldBuild()) ? 1 : 0);
}
