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
| `affordance` | ✓ | What the *speaker gains* (deniability, blame diffusion, frame import). |
| `mechanism` | ✓ | Why it works — the pragmatics (which Gricean maxim / commitment channel it exploits), with citations where they exist. |
| `channel` | — | Where the smuggled content travels: `asserted` · `presupposed` · `implicated` · `insinuated`. Each step down buys deniability. |
| `tests` | — | Operational linguistics: `cancellable` (implicatures cancel), `projects_under_negation` (presuppositions survive negation). These make "smuggled claim" a reproducible test, not a vibe. |
| `benign_reading` | ✓ | **Required.** The innocent use of the same construction, and what distinguishes the tell. The anti-cynicism field. |
| `ledger_line` | live | Reader's ledger template. `{n}` → count, `{s}` → plural "s". Only `<b>`/`<i>` markup (no attributes) and only those two placeholders — the build rejects anything else. |
| `output_phrasing` | ✓ | Canonical mark phrasing. Describes the language, never the speaker. Verdict words fail the build. |
| `naming_events` | ✓ | The origins-and-evolution record: `{term, lang, source, when}` — the same move as named across traditions and centuries. Dates may be intervals; oral traditions separate practice-origin from documentation-event. |
| `universality` | — | How many *independent* classical lineages named it (loaded framing: 4+; agent deletion: 1, language-bound). |
| `language_bound` | — | `true` if the tell's logic is language-specific (e.g. deleted subject: a marked choice in English, unmarked grammar in pro-drop languages). |
| `crosswalk` | — | Mappings to SemEval-2023, PTC-2019, MAFALDA, DISARM where they exist; `null` + note where the family is framework-native. |
| `realizations` | live | Per-language detection packs, keyed by BCP-47-ish tag. Each: `match` (`surface` for now; `lemma`/`morpheme` reserved for non-isolating languages), `patterns` (plain strings; matched case-insensitively with word boundaries), `regex` (`{source, flags}` — declarative only; flags **must** include `g`, may not include `y`), `provenance`. |
| `specimens` | gate | ≥3 independent, dated, sourced real-world uses (see CONTRIBUTING). Empty allowed at `candidate`, or at `live` only for entries whose realization `provenance` begins `seed —` (grandfathered; backfill tracked in CONTRIBUTING). |
| `counter_specimens` | gate | Sincere text the patterns must NOT flag. |
| `citations` | ✓ | Scholarly anchors. At least one primary source per entry — the anti-SCAN rule: no criteria list spreads without validation attached. |

## Invariants (do not bend)

1. **Span-anchoring.** Anything a detector emits must reference a visible span of the input text. A mark without a span is invalid.
2. **Benign reading required.** No entry ships without one.
3. **No verdict vocabulary.** `output_phrasing` may not assert intent, honesty, or mental state. The build enforces a banned-word list; reviewers enforce the spirit.
4. **Declarative patterns only.** No executable content in data files, ever.
5. **Valence lives in the use, not the technique.** The same device serves honest and manipulative ends (Quintilian called hyperbole a virtue; Puttenham said no one persuades without "false semblant"). Technique records stay descriptive.
6. **IDs are forever.** Reclassification is a versioned overlay (`crosswalk`, `family`), never an ID change — forks and merges are recorded as lineage, the way every taxonomy since Aristotle has actually evolved.
