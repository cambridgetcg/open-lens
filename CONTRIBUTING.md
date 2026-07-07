# Contributing

Open Lens publishes its inclusion policy **before** opening the gates — that order is deliberate (it's what kept EasyList defensible when the lawyers came). Right now the project is v0.1: issues, specimens, and discussion are welcome; **pattern PRs are reviewed but held to the standard below from day one.**

## What qualifies as a lexicon entry

A technique entry documents a *named, attested, describable* way language creates a gap between what is said and what a hearer comes to believe. Entries must:

1. **Describe the language, never the speaker.** `output_phrasing` says what the construction does ("the actor is deleted here"), never what the speaker is ("lying," "manipulative person"). The build rejects verdict words.
2. **Carry a benign reading.** Every construction has an innocent use — hedges are often epistemic honesty, passives are often just information structure. An entry without a documented benign reading is not accepted. This is the anti-cynicism rule.
3. **Anchor to visible text.** Patterns must mark a specific phrase a reader can see. No vibes, no whole-document "tones."

## The evidence standard (Wiktionary-grade)

Every **pattern** must eventually carry:

- **≥ 3 independent real-world specimens** — actual uses (not mentions), by different speakers, not quoting each other, spanning **at least one year**, from durably archived sources, each with URL and date. Short quotes only (fair use), always cited.
- **Counter-specimens** — sincere text the pattern must *not* flag. Submissions without counter-specimens are incomplete.
- **A provenance link** — the issue that motivated the pattern (uBlock-style: this documents why it exists and how to re-verify it later).

Patterns whose specimens involve identifiable private individuals are not accepted. Patterns targeting named public figures or groups get a *stricter* review track, not a looser one.

> **Grandfathering, honestly labeled:** the six seed families were extracted verbatim from the shipped v2 reader; each carries a `provenance` note beginning `seed —` on its `en` realization. Backfilling their specimens is tracked work, not a hidden exemption.

## The promotion gate (where this is going)

The end state is SpamAssassin-style empirical gating in CI: a pattern ships only if it (a) hits attested manipulative specimens, (b) stays under a published false-positive threshold on a **politically balanced corpus of ordinary sincere speech** — evaluated per register, per dialect, and per political side separately — and (c) passes lint. A pattern crafted to flag one faction's ordinary speech fails the ham test mechanically; no editor debate required. Until that CI exists, maintainers apply the same test by hand and say so in the PR.

## Standing rules

- **Declarative patterns only.** Plain strings and bounded regex. No executable rules, no callbacks, no URL fetches — an auto-updating pattern list is a supply chain, and expressive filter DSLs have become code-injection vectors elsewhere (Adblock Plus, CVE-2019-11593).
- **Entries are never removed in exchange for promises or payment.** Removal requests must argue the evidence. Disputed entries are frozen and visibly marked, then deleted if attestation isn't reproduced in a fixed window.
- **Taxonomy changes are versioned, with lineage.** Techniques get merged and split as understanding improves (the 18→14→23 history of the SemEval taxonomies is normal science); we record those edges rather than erase them.
- **Language packs belong to their speakers.** A new language starts with a named native-speaker maintainer team and its own false-positive notes. English logic does not port by default — in pro-drop languages, deleted subjects are the unmarked case and the detector logic *inverts*.
- **No entry may claim to detect lies.** See [CHARTER.md](CHARTER.md). This is not negotiable and not a style rule — it is where the science draws the line.

## Practical notes

- Build & validate: `npm run build` (validates schema invariants, regenerates `public/lexicon.gen.js`).
- Schema reference: [lexicon/SCHEMA.md](lexicon/SCHEMA.md).
- Licensing: code contributions are Apache-2.0; lexicon contributions are CC BY-SA 4.0 (ShareAlike is deliberate — it prevents the LIWC/Receptiviti-style commercial enclosure of community work). By contributing you license your contribution accordingly.
