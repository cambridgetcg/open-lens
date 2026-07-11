# Open Lens epistemic model

Status: experimental design contract for the `0.x` framework.

Open Lens makes rhetoric inspectable. It does not infer private mental states and
does not determine whether a claim is true. This document turns that boundary
into an object model rather than leaving it as a disclaimer.

## The essential split

Open Lens keeps three epistemic layers separate:

1. **Observation** — a visible construction anchored to exact input text.
2. **Interpretation** — a defeasible account of what that construction may
   communicate in context.
3. **World truth** — whether an atomic claim is supported by external evidence.

The deterministic engine owns observations. An optional interpreter may offer
interpretations if it exposes their textual basis, assumptions, and alternatives.
World-truth assessment belongs to evidence systems and human judgment, not to a
rhetorical cue matcher.

```text
text -> observations -> interpretations -> claims -> evidence -> revision
                            != speaker's mind
```

The public API therefore has no `truth_score`, `lie_probability`,
`honesty_score`, or speaker profile. A reading carries
`epistemic_status: "interpretation"`. Belief, motive, emotion, and intent default
to `unknown`.

## The truth stack

| Layer | Question | Appropriate output |
|---|---|---|
| R1 · Referent | What event, actor, time, or source is at issue? | Identifiers and provenance |
| R2 · Representation | What is asserted, presupposed, implicated, or performed? | Atomic claims, scope, modality, genre |
| R3 · Rhetorical structure | How does wording allocate agency, certainty, salience, and response? | Span-anchored cue annotations |
| R4 · Interpretation | What might a reasonable audience infer? | Defeasible readings, assumptions, alternatives |
| R5 · Evidence | What supports or contradicts each truth-apt claim? | Claim-evidence links and uncertainty |
| R6 · Revision | Does the account answer challenge and incorporate correction? | Version and correction history |

Captioneer/Open Lens directly implements R3 and an optional R4. Technique
metadata can inform R2, but this alpha does not yet parse a statement into
atomic asserted, presupposed, and implicated claims. Open Press and other
provenance systems can implement R1, R5, and R6. Keeping the seam explicit
prevents a linguistic observation from laundering itself into a factual verdict.

Not every utterance is truth-apt in the same way. Empirical reports, predictions,
normative judgments, promises, legal declarations, metaphors, satire, fiction,
and sacred or doctrinal claims require different tests. A promise can be broken;
it is not false in the same way as an incorrect date. A metaphor is not failed
reportage.

## Error, lying, and other failures of communication

| Kind | Relation to truth | Framework treatment |
|---|---|---|
| Error | False or unsupported content produced without established deceptive intent | Assess claim/evidence; do not infer dishonesty |
| Lie | At minimum, an assertion the speaker believes false; definitions differ on whether intent to deceive is required | Never infer from wording alone |
| Omission | Relevant content is absent | Name the missing question or actor, not a motive |
| Paltering / verisleight | Literally true statements actively arranged to produce a misleading picture | Inspect selection, framing, implicature, and completeness |
| Bullshit | Speech produced without adequate concern for truth | Mark visible certainty cues; leave evidence assessment external and do not diagnose indifference |
| Propaganda | Coordinated, sustained influence serving an institutional objective; it may mix truth and falsehood | Requires campaign/network context, not a sentence label |
| Self-deception | Motivated distortion of reality from oneself | Psychological hypothesis; outside text-only scope |
| Legitimate indirect speech | Politeness, irony, satire, parable, ritual, metaphor, fiction, or coded safety speech | Establish genre and include the benign reading |

A true sentence can mislead, and a false sentence can be an honest mistake. A
malicious use of a fact does not make the fact false; a benevolent intention does
not make a false proposition true.

## The rhetorical survival loop

Rhetoric is symbolic action addressed to an audience while interpretation or
choice remains open. A useful cross-domain loop is:

```text
situation -> attention -> naming -> framing -> authorisation
          -> identification -> coordination -> consequence -> correction
```

- **Religion** connects naming and action to sacred authority, ritual, ethical
  transformation, collective memory, and ultimate purpose. Rhetoric mediates
  religion but does not explain religion away. Myth is not a synonym for lie.
- **Civilisation** stabilises names, offices, promises, laws, archives, and
  verification practices across strangers and generations. Material resources,
  ecology, coercion, and institutions remain irreducible to discourse.
- **War** adversarially attacks attention, framing, credibility, coordination,
  and feedback while protecting its own. War is not merely narrative: bodies,
  territory, logistics, and weapons remain real.
- **Survival** rewards enough shared accuracy for warning, planning, trade,
  teaching, and cooperation, while sometimes rewarding secrecy, camouflage,
  bluff, or deception locally. Evolutionary adaptiveness is not moral
  justification.
- **Truth practice** keeps the consequence-to-correction channel open through
  evidence, challenge, provenance, and revision.

Deception exploits a background of ordinary reliability. If every signal were
worthless, deception would lose its target and coordination would collapse. A
civilisation therefore develops rhetoric about rhetoric: courts, testimony
rules, archives, councils, commentary, journalism, peer review, and correction.

## Output invariants

1. **Visible basis.** Every deterministic annotation points to exact source text.
2. **Observation before interpretation.** APIs never serialize the two as the
   same field or epistemic status.
3. **Alternatives remain possible.** Interpretations expose assumptions and at
   least one benign alternative when context could change the reading.
4. **No mind reading.** Outputs do not assert belief, motive, sincerity, emotion,
   character, or intent.
5. **No cleanliness certificate.** Unmarked means unchecked, never honest.
6. **No person aggregation.** The unit of analysis is a supplied text, never a
   longitudinal speaker score.
7. **No offensive generation.** The framework does not rewrite text to make it
   more manipulative, coercive, or evasive.
8. **Corrigibility.** Engine, schema, pack, rule, model, and policy versions are
   returned so an analysis can be reproduced, challenged, or superseded.

## Model-output enforcement is bounded

The interpretation endpoint requires structured output, verifies every cited
annotation ID, requires explicit assumptions and alternatives, and applies a
fail-closed lexical screen for documented verdict language. This is defense in
depth, not a semantic proof system. A keyword screen cannot establish that every
possible paraphrase respects the language-not-mind boundary.

The normative contract remains stronger than the current automated guard. New
model, prompt, and policy versions require adversarial evaluation; a detected
violation must be rejected and added as a regression. Consumers making sensitive
decisions must use the span-anchored observation layer and human review, not
treat a model reading as adjudication.

## Comparative history without false genealogy

Similar rhetorical moves were named in multiple traditions. Similarity does not
by itself prove historical influence. A future replacement for the current
`naming_events` list should model attestations as a multi-root graph with typed
relations:

```text
historical_influence | translation | independent_analogue |
same_mechanism | family_resemblance | contested
```

Each attestation should preserve the source term, language, tradition, date,
primary citation, translation note, relation type, and evidence note. This lets
the commons compare Aristotle, Nyaya, Xunzi, al-Jurjani, Buddhist upaya,
rabbinic argument, and modern computational taxonomies without presenting one
tradition as the hidden origin of all the others.

## Research anchors

- Aristotle, *Rhetoric*: rhetoric as a dual-use faculty of discovering means of
  persuasion — <https://classics.mit.edu/Aristotle/rhetoric.1.i.html>
- H. P. Grice, “Logic and Conversation”: asserted content and conversational
  implicature can come apart —
  <https://lawandlogic.org/wp-content/uploads/2018/07/grice1975logic-and-conversation.pdf>
- Sperber et al., “Epistemic Vigilance”: communication creates both dependence
  and exposure to misinformation —
  <https://doi.org/10.1111/j.1468-0017.2010.01394.x>
- Rogers et al., “Artful Paltering”: truthful statements can actively create a
  misleading impression — <https://scholar.harvard.edu/files/todd_rogers/files/paltering.pdf>
- Bond and DePaulo, “Accuracy of Deception Judgments”: wording and behaviour do
  not support confident lie verdicts — <https://doi.org/10.1207/s15327957pspr1003_2>
