# @open-lens/schema

Transport-neutral Open Lens JSON Schemas, TypeScript types, canonical JSON,
and Unicode code-point span helpers. This package is pure ESM, has no runtime
dependencies, performs no I/O, and makes no network requests.

Selectors always anchor to the caller's original text. Version 0.1 supports
only `normalization: "none"`; position offsets are end-exclusive Unicode code
points and are paired with exact quote, prefix, and suffix context.

Licensed under Apache-2.0. Lexicon data is distributed separately.

Pack validation checks data shape and schema invariants; it is not a security
sandbox or a proof of regex complexity. Third-party packs containing JavaScript
regex rules must be treated as trusted input and reviewed for ReDoS before use.
