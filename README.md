# Websites by Nick Caplan

Personal profile page for Nick Caplan, hosted on GitHub Pages.

Website: [websitesbynick.co.uk](https://websitesbynick.co.uk/)

## Run locally

```sh
npm run dev
```

Open **http://127.0.0.1:8080**. No build or dependency install is needed to
serve the site. Refresh the browser after editing a file, and press Ctrl+C to
stop the server. `npm start` runs the same server.

To use another port:

```sh
npm run dev -- --port 3000
```

## Technical Details

- Four-page static site: home (`index.html`), `experience/`, `pricing/` and `contact/`, each a real URL.
- Uses semantic HTML, shared CSS (`assets/css/site.css`) and vanilla JavaScript (`assets/js/`) with no build step or runtime dependency.
- The home page showcases live websites with composed desktop-and-phone overviews. Readable page-selector buttons change each screenshot pair; the live-site links are the primary route for exploring the work. Screenshots are static, optimised WebP files in `assets/images/work/`.
- Self-hosts DM Sans, DM Mono, Fraunces and Space Grotesk as woff2 (latin subsets, `assets/fonts/`, declared in `assets/css/fonts.css`); each family is licensed under the SIL Open Font License 1.1 (texts alongside the font files).
- Includes light and dark themes with the selected theme persisted in `localStorage`.
- Includes a mobile preview mode that can be toggled from the page navigation locally or on Netlify deploy previews. Only an explicit preview choice creates a 430px phone frame; the public site stays fluid, with phone styling at 600px and below and stacked project layouts up to 960px. Without a manual override, previews also follow viewport changes.
- Responsive CSS adapts the layout for narrow screens and mobile preview mode.
- Behaviour checks run with `node --test` (see `tests/`) - no dependencies. Requirements are in `docs/PROJECT-BRIEF.md` and important decisions in `docs/decisions.md`.
- GitHub Pages deployment is handled by `.github/workflows/pages.yml` on pushes to `main`.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for how to run the checks, how changes ship, and the house rules.

## Owner-invoked Robin review

After this setup is merged to `main`, Nick can post exactly `/review` on an open, non-draft PR from this public repository to `main`. Other users, forks, automatic PR/push events and comment edits do not invoke it. No review runs merely because this PR is opened or merged.

Robin is advisory only: it cannot approve a merge, block CI or request changes. Nick's explicit per-PR Merge approval and existing checks still apply. The workflow runs the pinned Robin action `808e18045c93f80f917a41be8fa3f80fa03d70a0` without checking out or executing PR code. It sends the public PR diff to OpenRouter and its free model provider; do not put private information in a public diff. Agent mode is off. Diffs over 20,000 characters or empty diffs are rejected. A final head check flags stale findings but cannot undo a review already posted if the head changes during a run.

The model is `nvidia/nemotron-3-ultra-550b-a55b:free`, with reasoning `none`, a 4,000 output-token cap and a five-minute job deadline. No paid fallback is configured. Provider retries can use more than one free request; provider capacity and review quality are not guaranteed. If a provider rejects the reasoning override, Robin may retry without it and log a warning. Inspect the run before trusting the result.

`OPENROUTER_ROBIN_PILOT` is a repository Actions secret, never a committed value. The approved shared key has a $0 spending cap with no reset and expires **17 November 2026 at 12:29 UTC**. All configured repositories share the account's 50 free requests per UTC day, not 50 each. The request counter resets at midnight UTC independently of the $0 spending cap. Expiry or a failed free request is not permission to raise the cap, add credits, add a card or switch to a paid model. Key renewal or replacement needs separate approval.

Run the offline safety checks from the repository root with `python3 scripts/test-robin-guards.py`. These do not call GitHub, OpenRouter or a model. The native Compass run succeeded on 10 November 2026 with this pinned action and model setting; this repository's live review remains untested until an approved invocation after Merge.
