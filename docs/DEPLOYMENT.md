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
