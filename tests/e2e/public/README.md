# Public design migration

The promotion replaces the old atelier root pages. Their screenshot chooser,
thumbnail tabs, touch swipe carousel and development-only fixed phone frame are
no longer public features, so those implementation-specific suites are retired.
They are not skipped. The approved concept remains tested separately.

Replacement public-route contracts cover the actual project imagery and load
behaviour, native linked cards, no-JS fallbacks, responsive device widths,
headline/bulb geometry, finite word/pull sequence, pulse and interaction stopping,
reduced-motion/hidden state, caption, CTA bounds, theme persistence, navigation,
career disclosure,200%text, metadata, canonical URLs, analytics inclusion, linked
assets and complete pricing offer. The existing provider-intercepted contact
validation/retry/failure suite and analytics consent/withdrawal suite continue
against root routes without being replaced.

The retained legacy experience page still exercises site.js; its unit tests for
legacy theme/mobile controls and phone-ring CSS remain in place.

Deployment checks still required: on a real Netlify draft deploy, verify exact
HTML-route redirects preserve query/hash and do not redirect shared assets;
verify the production-only catch-all points to the real custom-domain host
without a loop. Confirm robots, sitemap, canonical and consent behaviour on the
production host before final merge approval. No real form enquiries in tests.

## Deployment evidence checklist

Run the checked-in HTTP verifier against the exact draft URL returned by Netlify:

    node scripts/check-public-deployment.mjs EXACT_DRAFT_ORIGIN --netlify

It requires direct200public HTML, matching canonicals/consent inclusion, exact301
legacy HTML redirects with the query retained, and unredirected typed assets.
The verifier itself has negative unit tests for wrong pages, asset redirects and
lost queries. The generated Pages fallback HTML has a real-browser test across
all six retired routes, including query and fragment preservation.

On the actual draft, open each old HTML route with
`?promotion-check=1#arrival`, confirm the public destination retains both, then
check motion.js/pages.css remain assets rather than HTML. Reject analytics,
reload and navigate all public pages to confirm it remains off; intercept the
tag host when testing Allow so this review cannot add real analytics traffic.

After an approved production deploy, run the verifier against the custom domain
without --netlify (Pages fallback mode), adding
`--production-netlify=EXACT_EXISTING_PRODUCTION_NETLIFY_ORIGIN` to check the old
production host's302catch-all. Open that production host in a browser too,
following its path/query/hash to the custom domain and checking no loop. This
is a post-deploy verification gate, not permission to merge or deploy.
