# Working in this repo

Guidance for anyone contributing changes, including automated contributors. The requirements are in `docs/PROJECT-BRIEF.md` and important decisions are logged in `docs/decisions.md`; this file covers how to work here.

## What the site is

Multi-page static site (Home, About, Charity, Pricing, Contact and Privacy, with retained Experience routing) with shared CSS (`assets/css/site.css`) and vanilla JS (`assets/js/`). No build step and no runtime dependencies - edit files directly and keep it that way unless Nick decides otherwise.

## Running the checks locally

For local development, run `npm run dev` and open http://127.0.0.1:8080.
There is no build step; refresh the browser after editing. `npm start` is an alias.

```
npm ci                 # one-time setup (Playwright only; the unit checks need no dependencies)
npm run test:unit      # fast DOM and content checks: node --test tests/*.test.mjs
npm run test:e2e       # browser checks: npx playwright test
```

- The unit checks are dependency-free; `node --test tests/*.test.mjs` works without `npm ci`.
- Locally the Chromium and mobile-Chrome projects drive the system-installed Chrome, so no browser download is needed for those. Firefox and WebKit need `npx playwright install firefox webkit` first; the full four-browser matrix always runs in CI.
- The Playwright config starts a local static server itself (`scripts/serve-static.mjs`) on a free port; just run the tests.

## How changes ship

1. Work happens on a branch and a pull request. Every push and PR runs `.github/workflows/test.yml`: the unit checks plus the full Playwright matrix (Chromium, Firefox, WebKit, mobile Chrome) in the official Playwright container. All checks must be green before a change is presented as ready.
   `.github/workflows/android-chrome.yml` is a proof of concept that boots an Android emulator and runs checks in real Chrome for Android (`tests/android/`). It only runs when its own files change, so it adds no time to ordinary pull requests.
2. Each PR gets a Netlify deploy preview. Verify the change on the preview - real pages, phone and desktop widths - before calling it ready.
3. Only `main` deploys the live site (`.github/workflows/pages.yml` -> GitHub Pages). After any merge to `main`, check the live site once to confirm the deploy landed as intended.

## Documentation

- `docs/PROJECT-BRIEF.md` describes what the site must do. Update it only when the project's direction or requirements change, not for each change.
- `docs/decisions.md` records important decisions and the reason for each, newest first. Add an entry only when a choice would otherwise be questioned or reversed later. Small fixes and implementation details belong in the pull request.

## House rules

- Never remove, skip, or weaken a check to make the suite green. When the DOM or design changes intentionally, update the expectations to assert the new intended state with the same rigour.
- When a check fails, explain the cause and the planned fix before changing code.
- Never merge a pull request without Nick's explicit approval.

## Batch changes for merge throughput

Keep only two or three PRs in flight at once. Sync or push a PR only when it is next to merge, merge it after green checks and review, then start the next. Never start checks across all open PRs together. Cancel redundant runs on superseded commits when safe, not useful checks on current heads. Add each prospect to `/prospects/` as its page is deployed and verified live; never publish a dead listing.

## Final design and performance review

Before calling a visible change ready, inspect the hosted phone and desktop experience in light/dark mode and with enlarged text. Make separate whole-journey and whole-page passes: try controls, repeated actions, loading and error states, then judge the complete page's hierarchy, spacing, readability and consistency. Passing tests or finding no overlap is not a design verdict (confirmed 5 November 2026).

Check performance after changes (confirmed 2 November 2026). For loading or animation changes, compare like-for-like phone and desktop cold/warm measurements before and after, flag measured slowdowns before merge and check production after deployment. State when a baseline or live check is missing rather than claiming zero impact.
