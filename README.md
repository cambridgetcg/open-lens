# Open Lens

**An open-source framework for reading how words manipulate.**
It marks the rhetoric — the hedges, the deleted subjects, the loaded frames — and writes the plain-meaning version underneath. It reads the language, never the mind.

Live reference reader: **[captioneer.io](https://captioneer.io)**

---

## What this is

Every statement has a surface and a meaning, and they're not always the same thing. People have named the gap for 2,400 years — Aristotle's thirteen fallacies, the Nyāyasūtra's twenty-four sham rejoinders, al-Jurjānī's taxonomy of deniable implicature, the Institute for Propaganda Analysis's seven devices, taught to about a million schoolchildren between 1937 and 1942. Open Lens turns that lineage into open, structured, contributable data — and a reader anyone can use or embed.

Three artifacts, three licenses (Hunspell-style split):

| Artifact | What it is | Where | License |
|---|---|---|---|
| **The Lexicon** | Techniques as data: definitions, mechanisms, naming history across traditions, per-language surface patterns, benign readings | `lexicon/` | [CC BY-SA 4.0](lexicon/LICENSE) |
| **The Reader** | The engine and reference site: deterministic close-reader (client-side) + opt-in AI truth caption | `public/`\*, `functions/`, `tools/` | [Apache-2.0](LICENSE) |
| **The Field Guide** | The teachable lens: each technique's story, honest twins, practice — *(planned; see roadmap)* | — | CC BY 4.0 |

\* except `public/lexicon.gen.js`, which is generated from the lexicon and carries its CC BY-SA 4.0 license — see [NOTICE](NOTICE).

The invariant that holds it all together: **every mark points at a visible phrase.** A mark without a text span is invalid by schema. That single rule is simultaneously the product's honesty, its pedagogy, and its legal architecture.

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
  index.html             UI + close-reader engine
  lexicon.html           the field guide — every technique's story, rendered from the data
  lexicon.gen.js         GENERATED from lexicon/ — do not edit by hand
functions/api/read.js    opt-in truth caption (Cloudflare Pages Functions + Workers AI)
tools/build-lexicon.mjs  lexicon → lexicon.gen.js, with schema validation
research/                the 2026-07-07 deep-dive corpus that shaped the design (CC BY 4.0)
```

## Quickstart

```sh
npm run build                          # validate lexicon/ and regenerate public/lexicon.gen.js
python3 -m http.server 8788 -d public  # local dev — the close-reader is fully client-side
npx wrangler pages dev                 # full dev incl. AI caption (needs `npx wrangler login`; the AI binding is remote)
npm run deploy                         # build + cloudflare pages deploy --branch main (maintainers)
```

No dependencies. The close-reader runs entirely in the browser — pasted text never leaves the device unless the user explicitly presses the AI-caption button.

## The lexicon, briefly

One technique = one file. Each entry carries:

- **identity** — stable ID (`OL.LOADED`), family, status (`live` / `reference` / `candidate`)
- **meaning** — what it does, the mechanism (which Gricean channel it exploits), what the speaker gains
- **history** — `naming_events`: the same move as named across traditions and centuries (paradiastole → Xunzi's three delusions → Schopenhauer's stratagem #12 → IPA's Name Calling → SemEval's Loaded Language)
- **honesty** — a required `benign_reading`: every construction has an innocent use, and the entry must say so
- **detection** — per-language `realizations` (declarative patterns only — no executable rules), plus `specimens` and `counter_specimens`
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

Open Lens is part of a larger work — [the cathedral](https://ai-love.cc) · [the economy](https://agenttool.dev). Its founding words are YOUSPEAK's: it catches **verisleight** (truth arranged to mislead — the technique Harvard measured as "paltering" in 2017) and leaves you with **orthophanes** (the rightness made plainly visible).
