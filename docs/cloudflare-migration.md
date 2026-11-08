# Cloudflare migration: preparation, not cutover

No account, API token, live deployment, DNS, nameserver, registrar or email change is included in this PR. Existing GitHub Pages and Netlify workflows/configuration are untouched. CI green and Nick's explicit "Merge" remain release gates. Merging this preparation does not select Cloudflare as the live host.

## Build and output

- Framework: None.
- Build command: `node scripts/prepare-cloudflare-deploy.mjs`.
- Output directory: `.site-cloudflare`.
- Use a currently supported Node runtime compatible with the repository; the build has no external dependencies.
- The output is an explicit allowlist of current live public routes, shared assets Kumar's existing concept and the merged unlisted prospect index. It excludes tests, tooling, docs, configuration, experimental concept HTML and unapproved new prospect folders. When a new public route is merged, reconcile this inventory deliberately before cutover.
- Local safety marker prevents deleting an unowned output directory. Do not upload the whole repository root.
- The generated directory is not committed. Local output currently has 270 files and is about18MB; this is a preparation measurement, not a bandwidth estimate.

## Routing and headers

- `_redirects` handles exact retired homepage-concepts HTML routes with301redirects, without a directory-wide catch-all that would swallow CSS/JS. Current route queries/fragments must be tested on the real Cloudflare preview. Local tests prove file content, not Cloudflare's edge-rule implementation.
- Top-level404.html gives a real branded missing-page response and stops default SPA fallback. Verify actual response status404 at Cloudflare, not only a screenshot.
- `_headers` adds nosniff, Formspree-compatible `strict-origin-when-cross-origin`, mutable-file revalidation and explicit noindex for Kumar, the prospect index and provider hostnames. Do not set immutable caching on mutable motion.js/CSS filenames.
- No new CSP, HSTS, frame restriction or broad Permissions-Policy is introduced. Those could break existing integrations or make rollback harder and need separate work.
- Provider URLs must stay noindex. Confirm host-placeholder matching in actual Cloudflare responses; platform preview noindex also needs checking. Canonicals and live-domain pages must not accidentally inherit a global noindex.
- This does not convert Netlify's production catch-all to Cloudflare. Its current self-domain redirect remains untouched because Netlify still hosts previews. Do not point the live domain at that configuration.

## Ordered access and approval gates

Each item is a separate question when its turn comes, not one blanket permission request.

1. **Existing Cloudflare account/login:** "Do you already have a Cloudflare account? Which email/login method should I use?" Use an existing saved login via the vault, or collect its password with a secure vault request. Do not ask for passwords in chat. If there is no account, ask Nick to create it himself or explicitly choose the signup route. No password is generated. No token is needed for dashboard/Git-based deployment.
2. **Read-only DNS export:** "May I sign into Mythic Beasts read-only and download the complete DNS zone for websitesbynick.co.uk?" Use existing vault credentials. If Nick prefers, he can upload the full zone export himself. Public NS/MX/TXT queries are not a complete export; hidden DKIM selectors, verification records, wildcard records and other subdomains must be included. Do not assume a precise admin export button until inspected. No settings are saved.
3. **Cloudflare setup scope:** after read-only findings, ask permission to create the specific Free Pages project and, separately, to add the zone in Cloudflare without changing delegation. Adding/importing records is an account change and needs approval. Show the proposed zone/import before saving. Do not enable analytics, change mail routing or buy anything by default.
4. **GitHub integration scope:** ask for installation/authorization limited to `nickcaplan/websites-by-nick`, after inspecting the exact permissions requested. No all-repositories installation, broad API token or write scope is assumed. If scope exceeds the task, pause for Nick's choice. A deployment credential should only be requested if the chosen route truly needs one, with its exact scope first approved.
5. **Provider-only staging deploy:** request approval for the exact project/build settings and branch, deploy without a custom live domain and inspect the real pages.dev URL. No preview URL is known until Cloudflare returns it. Preserve current Netlify previews during comparison. Test all routes, assets, redirects, 404, headers, noindex, query/hash continuity, animations/reduced-motion, phone/desktop and consent. Contact rendering can be checked without sending; a real Formspree delivery test needs approval for its exact test message.
6. **Exact cutover approval, only after staging and DNS reconciliation:** present a record-by-record table with current and proposed values. Ask separately for the nameserver change and any other admin changes. The replacement Cloudflare nameservers are assigned to the actual zone and are UNKNOWN now. Never use invented/example nameservers as execution instructions. DNSSEC/DS changes, if required, need their own explicit approval after current state is read. Do not bundle disabling DNSSEC into migration permission.
7. Keep old GitHub Pages serving the same content during propagation; verify HTTPS at apex/www, mail DNS, redirects, form and noindex boundaries. Do not promise zero downtime. Final cleanup of GitHub custom-domain bindings, workflows or Netlify preview changes needs a separate approval after stability. Reverting delegation/records also changes an admin panel and needs approval; do not auto-rollback DNS under the general migration instruction.

## Values already observed, not a full execution plan

Public DNS at08:19GMT8November2026: current NS `ns1.mythic-beasts.com`, `ns2.mythic-beasts.com`; MX `10 mx1.mythic-beasts.com`, `10 mx2.mythic-beasts.com`; SPF `v=spf1 include:_spf.mythic-beasts.com -all`; apex A/AAAA point to GitHub Pages. Re-check at cutover. Preserve email and all full-zone records. Domain registration/renewal remains where it is; no registrar transfer is needed.

The full-zone export, DNSSEC/DS state, Cloudflare account, assigned nameservers, actual project ID/hostname and precise GitHub integration grant are unresolved. There is therefore no safe exact nameserver/record cutover request to approve today.

## Official references

- https://developers.cloudflare.com/pages/framework-guides/deploy-anything/
- https://developers.cloudflare.com/pages/configuration/custom-domains/
- https://developers.cloudflare.com/pages/configuration/redirects/
- https://developers.cloudflare.com/pages/configuration/headers/
- https://developers.cloudflare.com/pages/configuration/serving-pages/
- https://help.formspree.io/articles/form-and-project-settings/restrict-to-domain
