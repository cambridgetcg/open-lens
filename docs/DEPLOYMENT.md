# Deployment gates

The repository is an implementation-ready alpha, not an authorization to expose
unmetered model inference or publish packages under an unverified namespace.
Complete these gates before a production release.

## Hosted API

- Put `POST /v1/readings` and legacy `POST /api/read` behind an API key, a
  Cloudflare rate-limiting rule, or both. Limit by tenant as well as IP, set a
  daily spend ceiling, and alert on rejection/model-error rates.
- Keep deterministic `POST /v1/analyses` independently available so users do not
  have to invoke a model to inspect cues.
- Verify the Workers AI retention/training terms for the deployed account and
  replace the capability response's generic provider-retention text with the
  deployment's actual policy.
- Do not log request bodies. Treat query strings as loggable infrastructure
  metadata; the reference reader therefore supports private preload text only in
  the URL fragment (`#t=`).
- Exercise the OpenAPI contract, overflow rejection, CORS, request IDs, and
  `no-store` headers against the deployed worker—not only the local handlers.
- Add a Content Security Policy and review browser error reporting before
  accepting sensitive pasted text.

`npm run deploy` is deliberately blocked until the maintainer supplies
`CAPTIONEER_PRODUCTION_GATES_ACKNOWLEDGED=yes`, a description in
`CAPTIONEER_ABUSE_CONTROL`, and an HTTPS
`CAPTIONEER_PROVIDER_RETENTION_POLICY_URL`. Configure the corresponding abuse
control and metadata in Cloudflare too; these local variables are an
acknowledgement guard, not the control itself.

## npm release

- Create and verify ownership of the `@open-lens` npm organization. A registry
  `404` means no public package is visible; it does not reserve the scope.
- Publish `@open-lens/schema`, then `@open-lens/core`, then
  `@open-lens/lexicon-en`; install each packed artifact in a clean consumer
  project before promoting a tag.
- Use npm trusted publishing/OIDC and provenance. Review every tarball's
  `LICENSE` and `NOTICE`: schema/core are Apache-2.0, while the English pack is
  CC-BY-SA-4.0.
- Keep third-party regex packs trusted and manually reviewed. JSON is not a CPU
  sandbox; JavaScript regex can cause catastrophic backtracking.

## Release evidence

Record the git commit, generated-artifact diff, `npm test` result, package
dry-runs, Wrangler bundle result, deployed smoke tests, model/prompt/policy
versions, and the person approving the release. Provenance proves origin and
transformation history; it does not prove truth or harmlessness.

## captioneer.io production, 2026-10-20

From this release, `wrangler.jsonc` declares no Workers AI binding, so a
deployment made from it runs with model readings **off**: `POST /v1/readings`
answers `503 model_unavailable`, `POST /api/read` answers `503`, and
`GET /v1/capabilities` reports `readings.available: false`. The reader asks
`/v1/capabilities` first and keeps "Explore a reading" disabled, so it never
posts. Deterministic analysis (`POST /v1/analyses`, the in-browser scan) stays
available. captioneer.io (Pages project `captioneer-read`) runs this way once
such a deployment is live and the checks under "After deploying" pass.

Gates met, and how:

- **Content Security Policy.** `functions/_middleware.js` sets one policy on
  every `text/html` response: scripts from `'self'` plus the sha256 of each
  inline script, no `unsafe-inline` or `unsafe-eval` for scripts,
  `object-src`/`base-uri`/`frame-ancestors 'none'`. `tests/csp.test.mjs`
  recomputes the hashes from `public/*.html` and fails if one is missing, or
  if a page uses an inline event handler or a `javascript:` URL.
- **Browser error reporting.** The pages report nothing themselves (no
  `onerror`, `unhandledrejection` or `sendBeacon`), and the CSP names no
  `report-uri` or `report-to`. Cloudflare adds zone-level Network Error Logging
  headers (`cf-nel`, seen on captioneer.io 2026-10-20); NEL clears the URL
  fragment before reporting (W3C NEL §5.5), so `#t=` text never reaches them.
- **Provider retention.** `CAPTIONEER_PROVIDER_RETENTION_POLICY_URL` (a `vars`
  entry in `wrangler.jsonc`) points at Cloudflare's Workers AI data-usage
  terms (read 2026-10-20): customer content is not used to train models, and
  standard-inference inputs and outputs are not retained once the request is
  served, subject to the page's safety, security, and legal exceptions.
- **No body logging.** No function logs anything; private preload text travels
  only in the URL fragment (`#t=`), which browsers do not send.
- **Deterministic route limits.** JSON bodies are capped at 64 KiB and text at
  12,000 code points, rejected with `413` and never truncated.
  `CAPTIONEER_ABUSE_CONTROL` says so, and that this deployment's model routes
  answer `503` without running a model.

Deferred with readings: an API key or rate limit on both model routes (per
tenant and IP), a daily spend ceiling, and alerting on rejection and
model-error rates. Until they exist, the missing binding is the control, and
it covers only deployments made from this config.
`production_ready` in `/v1/capabilities` stays `false` while readings are off.

**Earlier deployments are retired.** Pages attaches bindings per deployment.
Every `wrangler.jsonc` in this repository up to `c926d88` declares the AI
binding, so each production deployment made before this release carried it at
its own `<id>.captioneer-read.pages.dev` address and was a rollback target that
would put unmetered readings back on captioneer.io. All 16 were deleted on
2026-10-20 (see the release record), so the project has no rollback target
older than the readings-off deploy. To go back to an older build, deploy its
commit with this repository's current `wrangler.jsonc`, not a rollback.

**Deploying this release.** `npm run deploy` deploys with `--branch main`, the
project's production branch (project settings, read 2026-10-20).
`tools/check-deploy.mjs` reads only the shell, while `/v1/capabilities` serves
the `vars` in `wrangler.jsonc`, so set `CAPTIONEER_ABUSE_CONTROL` and
`CAPTIONEER_PROVIDER_RETENTION_POLICY_URL` to those exact `vars` values, and
`CAPTIONEER_PRODUCTION_GATES_ACKNOWLEDGED=yes` for the readings-off gates
above.

**After deploying**, check https://captioneer.io with requests that run no
model, and record the results, the deployed commit and the approver here.
This is the gate "exercise … against the deployed worker":

- `GET /v1/capabilities`: `readings.available: false`,
  `production_ready: false`, and both `vars` values.
- `GET /v1/openapi.json`: `200`.
- `POST /v1/analyses`: annotations for a short `{text}`; `413` for a body over
  64 KiB.
- An `OPTIONS` preflight to `/v1/analyses` returns the CORS headers; a sent
  `X-Request-ID` comes back; API responses carry `cache-control: no-store`.
- `/`, `/lexicon` and an unknown path (the HTML 404) carry
  `Content-Security-Policy`, and the reader's button reads "Readings off on
  this deployment".

To re-enable readings: meet those three gates, restore
`"ai": { "binding": "AI" }` in `wrangler.jsonc`, update
`CAPTIONEER_ABUSE_CONTROL` to name the new controls, and run `npm run deploy`
with the same three variables set for `tools/check-deploy.mjs`. A deploy from
`wrangler.jsonc` makes that file the source of truth for bindings, so a binding
added only in the dashboard does not survive the next deploy.

### Release record, 2026-10-20

- **Approver:** Yu, who chose "latest, model off" in a Claude Code session on
  2026-10-20. Claude Code (an agent) ran the deploy and the checks below.
- **Deployed:** commit `1ae0177` (`origin/main` at the time), via
  `npm run deploy` with the three variables set to the `wrangler.jsonc` values.
  The result is deployment `198080d0` (production, branch `main`), replacing
  `717afa3c` (`c0c8031`, 2026-07-11).
- **Before deploying:**
  - `npm test`: 72/72.
  - `npm run build`: leaves the tree clean, with the lexicon and engine
    byte-identical to `c926d88`.
  - Functions: "Compiled Worker successfully" (wrangler 4.110.0).
  - `tools/check-deploy.mjs`: unchanged, and refuses with no environment.
- **After deploying**, checked on https://captioneer.io with no model run:
  - `GET /v1/capabilities`: `readings.available: false` and
    `production_ready: false`, with both `vars`.
  - `GET /v1/openapi.json`: 200.
  - `POST /v1/analyses`: 4 annotations for a short text, and 413 for an
    80 KB body.
  - `OPTIONS` preflight: 204 with the CORS headers. `X-Request-ID` is echoed,
    and API responses carry `cache-control: no-store, max-age=0`.
  - `POST /v1/readings` and `POST /api/read`: 503.
  - `/`, `/lexicon` and an unknown path (404) all carry the CSP.
  - www., read. and captioneer-read.pages.dev all report readings off.
- **Headless Chrome 155 on the live site:**
  - Nowhere did a page show a CSP violation, a console message or an
    exception.
  - The reader renders its 5 marks, and its button reads "Readings off on this
    deployment" with no POST sent.
  - The `#t=` deep link preloads its text.
  - `/lexicon` renders 7 entries.
  - With capabilities unreachable, the button reads "Readings unavailable" and
    sends no POST.
  - With readings mocked on, a click sends exactly one POST.
- **Older deployments retired, 2026-10-20.** Yu asked for the older captioneer
  deployments to be removed and retired. Claude Code (an agent) deleted all 16
  of them through the Pages API (`DELETE …/deployments/<id>?force=true`), using
  wrangler's login. `198080d0` was the canonical deployment at that point and
  was kept. The 16 ran from 2026-07-06 to 2026-07-11:
  - `717afa3c` (`c0c8031`), `1ff9b624` and `fed84ff8` (`c98626b`),
    `73f0a6b0` (`1bca159`), `52498fca` (`7c8a8b6`), `238375a5` (`b63646d`)
    and `8b9ca662` (`d5dffea`);
  - nine direct uploads with no commit recorded: `8af45040`, `fb78580c`,
    `1f295d63`, `b91a04b7`, `b72703bc`, `666757bb`, `e1a145a7`, `c63882fd`
    and `1f13ac43`.

  Before deleting, each served an older Captioneer reader. Afterwards:
  - the API answered "does not exist" for them and listed only `198080d0`;
  - their hostnames kept serving from Cloudflare's edge for at least 35 minutes;
  - by 2026-10-22 all 16 answered 404 "Deployment Not Found";
  - the four production hostnames still report readings off.

### Release record, 2026-10-26: robots.txt

- **Approver:** Yu, numbered yes item 10 of the Quiet Doors design. Claude Code (an agent) ran the deploy and the checks below.
- **Deployed:** commit `bf22bbc` via `npm run deploy` with the three variables set to the `wrangler.jsonc` values. The change adds `public/robots.txt` (`User-agent: *`, `Allow: /`) and its test; no binding changed.
- **Before deploying:** `npm test`: 74/74. `npm run build`: leaves the tree clean.
- **After deploying**, checked on https://captioneer.io with no model run:
  - `/robots.txt`: 200 text/plain with exactly those two lines.
  - `GET /v1/capabilities`: `readings.available: false`, `readings.production_ready: false`, with both `vars` values.
  - `GET /v1/openapi.json`: 200.
  - `POST /v1/analyses`: 3 annotations for a short text, and 413 for an 80 KB body.
  - `OPTIONS` preflight: 204 with the CORS headers. `X-Request-ID` is echoed, and API responses carry `cache-control: no-store, max-age=0`.
  - `POST /v1/readings`: 503. `POST /api/read` with `{"text":"hi"}`: 400 ("Give me a sentence to read."), because the route checks its input before its binding; the previous deployment `198080d0` answers the same. With a full sentence it answers 503.
  - `/`, `/lexicon` and an unknown path (404) all carry the CSP.
  - The served page contains "Readings off on this deployment". It was not rendered in a headless browser for this release, because the change is one static file.
