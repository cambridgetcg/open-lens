# Open Lens

**An open-source framework for inspecting how words steer meaning.**
It marks observable rhetorical cues — hedges, deleted subjects, loaded frames —
and keeps those observations separate from optional, defeasible interpretations.
It reads language, never minds, and does not determine truth.

Live reference reader: **[captioneer.io](https://captioneer.io)**

> **Canon note:** Open Lens is the canonical framework of this family.
> [RhetorLint](https://github.com/cambridgetcg/rhetorlint-spec) (MIT) is its
> portable implementation profile — a minimal spec-plus-engines expression of
> the same SemEval-2023-aligned taxonomy. New lexicon and research work lands
> here; RhetorLint tracks the portable subset. One framework, two engines —
> by design, not fragmentation.

---

## What this is

Every statement has a surface, a context, and more than one possible reading.
People have named rhetorical constructions for 2,400 years — Aristotle's
thirteen fallacies, the Nyāyasūtra's twenty-four sham rejoinders,
al-Jurjānī's analysis of indirect meaning, and the Institute for Propaganda
Analysis's seven devices. Open Lens turns that multi-root history into open,
structured, contributable data and a deterministic engine anyone can embed.

The code/data boundary is deliberate (a Hunspell-style split):

| Artifact | What it is | Where | License |
|---|---|---|---|
| **Schema + engine** | Transport schemas, Unicode selectors, pure zero-network matcher | `packages/schema/`, `packages/core/` | [Apache-2.0](LICENSE) |
| **The lexicon** | Techniques, mechanisms, comparative history, surface rules, benign readings | `lexicon/`, `packages/lexicon-en/` | [CC BY-SA 4.0](lexicon/LICENSE) |
| **Reference reader + API** | Local browser analysis and a separate opt-in, evidence-linked interpretation layer | `public/`, `functions/` | [Apache-2.0](LICENSE), except generated lexicon data |
| **Research corpus** | The fact-checked corpus that shaped the taxonomy and governance | `research/` | [CC BY 4.0](research/LICENSE) |

Generated lexicon/pack artifacts in `public/` retain CC BY-SA 4.0; see
[NOTICE](NOTICE).

The invariant that holds it all together: **every deterministic annotation
points at exact visible text.** A position selector is paired with an exact
quote and context; a selector that does not re-anchor to the caller's original
string is invalid. An observation is not an interpretation, and neither is a
truth verdict.

## What it refuses, permanently

- **Lie detection.** Humans classify lies at 54% accuracy (Bond & DePaulo 2006, ~24,500 judges); verbal cues have a median effect size of d≈0.10; SCAN-style "statement analysis" performs at chance. No truth scores, no deception probabilities, ever.
- **Verdicts on people.** It annotates texts, never builds profiles of speakers. Unmarked is *unchecked*, never endorsed.
- **Translation.** It reads through words, not across languages.
- **A "make it more persuasive" mode.** The taxonomy is defense (like MITRE ATT&CK); generation toward manipulation is exploit code and a permanent non-goal.
- **Non-text inputs.** No voice, no faces, no biometrics — by schema, not policy.

The full charter with its scholarly lineage: [CHARTER.md](CHARTER.md).

## Repository layout

```
lexicon/                 the data (CC BY-SA 4.0)
  lexicon.json           manifest: version, entry list
  SCHEMA.md              the entry schema, field by field
  techniques/*.json      one technique per file
public/                  the reference reader (static, client-side marking)
  index.html             UI consuming the generated core + English pack
  lexicon.html           the field guide — every technique's story, rendered from the data
  lexicon.gen.js         GENERATED from lexicon/ — do not edit by hand
  open-lens.*.gen.js     GENERATED static-browser ESM artifacts
packages/
  schema/                JSON Schema 2020-12 + selector helpers (Apache-2.0)
  core/                  @open-lens/core, pure deterministic engine (Apache-2.0)
  lexicon-en/            @open-lens/lexicon-en data pack (CC BY-SA 4.0)
functions/v1/            versioned analyses, readings, discovery, and OpenAPI
functions/api/read.js    compatibility endpoint for the original reader
tools/build-lexicon.mjs  validate data; generate pack + browser artifacts
docs/EPISTEMIC-MODEL.md  observation / interpretation / evidence contract
research/                the 2026-07-07 deep-dive corpus that shaped the design (CC BY 4.0)
```

## Quickstart

```sh
npm run build                          # validate and regenerate data/browser artifacts
npm test                               # schemas, core, API policy, and reader boundaries
python3 -m http.server 8788 -d public  # local dev — the close-reader is fully client-side
npx wrangler@4.110.0 pages dev         # full API incl. remote opt-in AI binding
npm run deploy                         # guarded production deploy; see docs/DEPLOYMENT.md
```

The deterministic engine has no runtime I/O, telemetry, or network path. In the
reference reader, pasted text stays in the browser during cue analysis. Calling
`POST /v1/readings` — or explicitly pressing the optional AI button — sends the
statement to the deployment's Cloudflare Workers AI binding. API responses are
`no-store`; provider processing remains subject to the deployment privacy policy.
Use hash links (`#t=...`), not query parameters, when preloading private text:
query strings can enter server and CDN logs before browser code runs.

### npm-style use

```js
import { createLens } from "@open-lens/core";
import english from "@open-lens/lexicon-en";

const lens = createLens({ packs: [english] });
const analysis = lens.analyze({
  text: "Mistakes may have been made.",
  language: "en",
});
```

The packages are prepared as independent workspaces but are not published by
this repository automatically. Confirm namespace ownership before the first npm
release.

Language packs are trusted input, not a sandbox. They are JSON and receive no
network capability, but regex rules compile into JavaScript `RegExp` and can
cause catastrophic backtracking. Review installed packs; do not build an
untrusted remote pack registry until the matcher has a restricted DSL or a
linear-time regex engine.

### HTTP API

```text
GET  /v1/capabilities
GET  /v1/packs
GET  /v1/techniques[/<id>]
GET  /v1/openapi.json
POST /v1/analyses   { "text": "...", "language": "en" }
POST /v1/readings   { "text": "...", "language": "en" }
```

`/v1/analyses` is deterministic. `/v1/readings` is the explicit model boundary;
it returns `epistemic_status: "interpretation"`, the full analysis, cited
annotation IDs, assumptions, alternatives, and model/prompt/policy versions.
Oversized text is rejected with `413`; it is never silently truncated.
Model output is schema-checked and screened by a fail-closed lexical policy.
That screen reduces known verdict language; it is not a semantic proof that a
model can never produce an unsafe paraphrase.

Production deployment has additional gates — authentication or rate limits for
model routes, provider-retention disclosure, and npm-scope ownership. See
[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## The lexicon, briefly

One technique = one file. Each entry carries:

- **identity** — stable ID (`OL.LOADED`), family, status (`live` / `reference` / `candidate`)
- **meaning** — what it does, the mechanism (which Gricean channel it exploits), and the communicative affordance it can create
- **history** — `naming_events`: comparable constructions named across traditions and centuries; these are typed parallels, not automatic claims of direct descent
- **honesty** — a required `benign_reading`: every construction has an innocent use, and the entry must say so
- **detection** — per-language data-defined `realizations`, including reviewed regex rules; installed packs are trusted input, plus `specimens` and `counter_specimens`
- **interop** — crosswalks to SemEval-2023, PTC-2019, MAFALDA, DISARM where they exist

Full schema: [lexicon/SCHEMA.md](lexicon/SCHEMA.md).

## Status & roadmap

**v0.2 — young project, honestly labeled.** Six live families (172 English patterns, extracted from the shipped reader) + one reference entry, now with **29 independently verified specimens** (each quote checked verbatim against archival sources, pattern-matched, politically balanced across the set) and an honest twin per family. The [field guide](https://captioneer.io/lexicon) renders it all; every mark in the reader links to its entry. The six seed pattern-packs remain grandfathered; the evidence standard below applies to everything new.

- **Next:** more reference entries from the classical catalogs; counter-specimen ("ham") corpus and the CI promotion gate; first community annotation on the tractable families.
- **Then:** the contribution gate as CI — a politically balanced "ham" corpus of sincere speech, per-slice false-positive thresholds (SpamAssassin-style: a pattern crafted to flag one faction's ordinary speech fails mechanically); first community annotation on the tractable families.
- **Later:** non-English packs owned by native-speaker teams (Cantonese and Mandarin first), morpheme-aware matching, the Lens Acquisition Test.

See [CONTRIBUTING.md](CONTRIBUTING.md) — the inclusion policy is published *before* contributions open, on purpose.

## Provenance

This design is grounded in a fact-checked research pass across ten dimensions — classical rhetoric, propaganda history, computational taxonomies, the linguistics of evasion, cross-language strategies, OSS governance precedents, abuse cases, learning science, non-Western catalogs, and evaluation infrastructure. The full corpus lives in [`research/`](research/), and the numbers cited above come from it.

Open Lens is part of a larger work — [the cathedral](https://ai-love.cc) · [the economy](https://agenttool.dev). Its founding words are YOUSPEAK's: it helps inspect **verisleight** (truth arranged to mislead — related to what the paltering literature measured in 2017) while moving toward **orthophanes** (the rightness made plainly visible), without pretending that one reading proves world truth.
