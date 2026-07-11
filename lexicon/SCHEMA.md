# Lexicon Schema — v0.1

One technique = one JSON file in `techniques/`, listed in `lexicon.json`. **The `entries` array order is display order** in the reader (frequency panel, ledger); the build asserts the six core families stay in canonical order. The schema is young; fields may grow, but the **invariants** at the bottom do not.

## Fields

| Field | Req | Meaning |
|---|---|---|
| `id` | ✓ | Stable ID, DISARM-style (`OL.LOADED`). Never reused, never renamed. |
| `key` | ✓ | Short runtime key (`loaded`) — used by the reader for CSS/family wiring. |
| `name` | ✓ | Display name ("Loaded framing"). |
| `family` | ✓ | Family slug; currently one technique per family at the six-family core. |
| `status` | ✓ | `live` (shipped detector) · `reference` (documented, no detector) · `candidate` (proposed). |
| `what` | ✓ | One line: what the construction does, reader-facing. |
| `affordance` | ✓ | What the construction can make communicatively available; phrase this as a possibility, never an inferred speaker motive. |
| `mechanism` | ✓ | Why it works — the pragmatics (which Gricean maxim / commitment channel it exploits), with citations where they exist. |
| `channel` | — | Where the smuggled content travels: `asserted` · `presupposed` · `implicated` · `insinuated`. Each step down buys deniability. |
| `tests` | — | Operational linguistics: `cancellable` (implicatures cancel), `projects_under_negation` (presuppositions survive negation). These make "smuggled claim" a reproducible test, not a vibe. |
| `benign_reading` | ✓ | **Required.** The innocent use of the same construction, and what distinguishes the tell. The anti-cynicism field. |
| `ledger_line` | live | Reader's ledger template. `{n}` → count, `{s}` → plural "s". Only `<b>`/`<i>` markup (no attributes) and only those two placeholders — the build rejects anything else. |
| `output_phrasing` | ✓ | Canonical mark phrasing. Describes the language, never the speaker. Verdict words fail the build. |
| `naming_events` | ✓ | Comparative attestations: `{term, lang, source, when}`. Similarity is not proof of descent; use typed relations and evidence notes when the schema grows beyond this provisional field. |
| `universality` | — | How many *independent* classical lineages named it (loaded framing: 4+; agent deletion: 1, language-bound). |
| `language_bound` | — | `true` if the tell's logic is language-specific (e.g. deleted subject: a marked choice in English, unmarked grammar in pro-drop languages). |
| `crosswalk` | — | Mappings to SemEval-2023, PTC-2019, MAFALDA, DISARM where they exist; `null` + note where the family is framework-native. |
| `realizations` | live | Per-language detection packs, keyed by BCP-47-ish tag. Each: `match` (`surface` for now; `lemma`/`morpheme` reserved for non-isolating languages), `patterns` (plain strings; matched case-insensitively with word boundaries), `regex` (`{source, flags}`; flags **must** include `g`, may not include `y`), `provenance`. Regex data is compiled by JavaScript and must be treated as trusted input. |
| `specimens` | gate | ≥3 independent, dated, sourced real-world uses (see CONTRIBUTING). Shape: `{quote (≤300 chars, fair use), speaker, date, source (URL), note?}`. Empty allowed at `candidate`, or at `live` only for entries whose realization `provenance` begins `seed —` (grandfathered; backfill tracked in CONTRIBUTING). |
| `honest_twins` | — | Sincere uses of the *same construction* where `benign_reading` applies — `{text (≤300 chars), note, attribution?}` (constructed examples allowed, labeled). The teaching layer's anti-cynicism data: every family ships with its honest twin. |
| `counter_specimens` | gate | Sincere text the patterns must NOT flag at all (pattern-level ham; distinct from `honest_twins`, which the patterns *do* match). |
| `citations` | ✓ | Scholarly anchors. At least one primary source per entry — the anti-SCAN rule: no criteria list spreads without validation attached. |

## Invariants (do not bend)

1. **Span-anchoring.** Anything a detector emits must reference a visible span of the input text. A mark without a span is invalid.
2. **Benign reading required.** No entry ships without one.
3. **No verdict vocabulary.** `output_phrasing` may not assert intent, honesty, or mental state. The build enforces a banned-word list; reviewers enforce the spirit.
4. **Trusted declarative packs.** Packs contain JSON rather than functions and receive no network capability, but regex rules execute in JavaScript's backtracking engine and can consume unbounded CPU. Install third-party packs only after review; a restricted DSL or RE2-compatible engine is required before any untrusted registry.
5. **Valence lives in the use, not the technique.** The same device serves honest and manipulative ends (Quintilian called hyperbole a virtue; Puttenham said no one persuades without "false semblant"). Technique records stay descriptive.
6. **IDs are forever.** Reclassification is a versioned overlay (`crosswalk`, `family`), never an ID change — forks and merges are recorded as lineage, the way every taxonomy since Aristotle has actually evolved.
