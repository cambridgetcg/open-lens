import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import english from "../../lexicon-en/src/index.js";
import {
  SCHEMA_VERSION as PUBLIC_SCHEMA_VERSION,
  assertAnalysis,
  validateLanguagePack,
} from "../../schema/src/index.js";
import {
  ENGINE_ID,
  ENGINE_VERSION,
  SCHEMA_VERSION as CORE_SCHEMA_VERSION,
  analyze,
  createLens,
  segmentText,
  selectNonOverlappingAnnotations,
  stableStringify,
  verifyAnalysisSelectors,
} from "../src/index.js";

test("core manifest, runtime, declarations, and schema dependency cannot drift", () => {
  const manifest = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  const declarations = readFileSync(new URL("../src/index.d.ts", import.meta.url), "utf8");
  const schemaManifest = JSON.parse(readFileSync(new URL("../../schema/package.json", import.meta.url), "utf8"));
  assert.equal(manifest.version, ENGINE_VERSION);
  assert.match(declarations, new RegExp(`export\\s+const\\s+ENGINE_VERSION\\s*:\\s*"${escapeRegex(ENGINE_VERSION)}"\\s*;`));
  assert.equal(CORE_SCHEMA_VERSION, PUBLIC_SCHEMA_VERSION);
  assert.equal(schemaManifest.version, PUBLIC_SCHEMA_VERSION);
  assert.equal(manifest.dependencies["@open-lens/schema"], PUBLIC_SCHEMA_VERSION);
  assert.match(declarations, new RegExp(`export\\s+const\\s+SCHEMA_VERSION\\s*:\\s*"${escapeRegex(PUBLIC_SCHEMA_VERSION)}"\\s*;`));
});

test("createLens exposes a synchronous zero-network capability contract", () => {
  const lens = createLens({ packs: [english] });
  assert.deepEqual(lens.capabilities.engine, { id: ENGINE_ID, version: ENGINE_VERSION });
  assert.equal(lens.capabilities.network, false);
  assert.equal(lens.capabilities.overlap_policy, "retain-all");
  assert.deepEqual(lens.capabilities.normalization, ["none"]);
  assert.ok(Object.isFrozen(lens.capabilities));
});

test("English package is machine-valid and carries separate data provenance", () => {
  assert.deepEqual(validateLanguagePack(english), []);
  assert.equal(english.id, "open-lens/en");
  assert.equal(english.version, "0.2.0");
  assert.equal(english.license, "CC-BY-SA-4.0");
  assert.equal(english.techniques.length, 7);
  assert.equal(english.rules.length, 173);
  assert.equal(new Set(english.rules.map(({ id }) => id)).size, english.rules.length);
  assert.ok(english.rules.every(({ id }) => /^OL\.[A-Z]+\.en\.(surface|regex)\.[a-f0-9]{12}$/.test(id)));
});

test("analysis anchors astral and decomposed Unicode to untouched caller text", () => {
  const text = "🌞 Cafe\u0301 maybe, perhaps.";
  const lens = createLens({ packs: [english], quoteContext: 3 });
  const result = lens.analyze({ text, language: "en-GB", normalization: "none" });
  assert.equal(result.input.normalization, "none");
  assert.deepEqual(result.input.length, { code_points: 23, utf16_code_units: 24 });
  assert.deepEqual(result.annotations.map(({ selector }) => selector), [
    {
      position: { start: 8, end: 13, unit: "unicode-code-point" },
      quote: { exact: "maybe", prefix: "e\u0301 ", suffix: ", p" },
    },
    {
      position: { start: 15, end: 22, unit: "unicode-code-point" },
      quote: { exact: "perhaps", prefix: "e, ", suffix: "." },
    },
  ]);
  assert.deepEqual(verifyAnalysisSelectors(text, result), { valid: true, issues: [] });
  assert.equal(assertAnalysis(result), result);
  assert.throws(() => lens.analyze({ text, normalization: "NFC" }), /never rewrites caller text/);
});

test("surface boundaries are Unicode-aware and whitespace remains flexible", () => {
  const lens = createLens({ packs: [fixturePack([
    surfaceRule("OL.TEST.en.surface.maybe", "maybe"),
    surfaceRule("OL.TEST.en.surface.real-question", "real question"),
  ])] });
  const text = "émaybe maybe界 _maybe maybe_ e\u0301maybe MAYBE; real\n\tquestion";
  const result = lens.analyze({ text, language: "en" });
  assert.deepEqual(result.annotations.map(({ selector: { quote } }) => quote.exact), ["MAYBE", "real\n\tquestion"]);
});

test("all overlapping and duplicate-rule evidence is retained deterministically", () => {
  const lens = createLens({ packs: [fixturePack([
    surfaceRule("OL.TEST.en.surface.short", "a little"),
    surfaceRule("OL.TEST.en.surface.long", "a little bit"),
    regexRule("OL.TEST.en.regex.duplicate", "a\\s+little", "giu"),
    surfaceRule("OL.TEST.en.surface.tail", "little bit"),
  ])] });
  const text = "a little bit";
  const first = lens.analyze({ text, language: "en" });
  const second = lens.analyze({ text, language: "en" });

  assert.deepEqual(first.annotations.map(({ detector, selector }) => ({
    id: detector.rule_id,
    start: selector.position.start,
    end: selector.position.end,
    exact: selector.quote.exact,
  })), [
    { id: "OL.TEST.en.surface.long", start: 0, end: 12, exact: "a little bit" },
    { id: "OL.TEST.en.surface.short", start: 0, end: 8, exact: "a little" },
    { id: "OL.TEST.en.regex.duplicate", start: 0, end: 8, exact: "a little" },
    { id: "OL.TEST.en.surface.tail", start: 2, end: 12, exact: "little bit" },
  ]);
  assert.equal(first.metrics.annotation_count, 4);
  assert.equal(stableStringify(first), stableStringify(second));
  assert.equal(lens.stringify(first), stableStringify(first));
  assert.deepEqual(verifyAnalysisSelectors(text, first), { valid: true, issues: [] });
});

test("core stable JSON preserves own __proto__ data without prototype mutation", () => {
  const value = JSON.parse('{"z":1,"__proto__":{"polluted":true}}');
  const canonical = stableStringify(value);
  assert.equal(canonical, '{"__proto__":{"polluted":true},"z":1}');
  const parsed = JSON.parse(canonical);
  assert.ok(Object.hasOwn(parsed, "__proto__"));
  assert.deepEqual(parsed["__proto__"], { polluted: true });
  assert.equal({}.polluted, undefined);
});

test("overlap-aware segments expose every active annotation to browser renderers", () => {
  const lens = createLens({ packs: [fixturePack([
    surfaceRule("OL.TEST.en.surface.short", "a little"),
    surfaceRule("OL.TEST.en.surface.long", "a little bit"),
    surfaceRule("OL.TEST.en.surface.tail", "little bit"),
  ])] });
  const analysis = lens.analyze("a little bit!");
  assert.deepEqual(segmentText("a little bit!", analysis), [
    { start: 0, end: 2, text: "a ", annotation_ids: ["ann_000001", "ann_000002"] },
    { start: 2, end: 8, text: "little", annotation_ids: ["ann_000001", "ann_000002", "ann_000003"] },
    { start: 8, end: 12, text: " bit", annotation_ids: ["ann_000001", "ann_000003"] },
    { start: 12, end: 13, text: "!", annotation_ids: [] },
  ]);
  assert.deepEqual(selectNonOverlappingAnnotations(analysis).map(({ detector }) => detector.rule_id), ["OL.TEST.en.surface.long"]);
});

test("annotations include technique, rule, pack, engine, and version provenance", () => {
  const result = createLens({ packs: [english] }).analyze("Mistakes were made.");
  const exact = result.annotations.find(({ selector }) => selector.quote.exact.toLowerCase() === "mistakes were made");
  const regex = result.annotations.find(({ detector }) => detector.kind === "regex");
  assert.ok(exact);
  assert.ok(regex);
  assert.equal(exact.technique_id, "OL.AGENTDEL");
  assert.equal(exact.provenance.pack_id, "open-lens/en");
  assert.equal(exact.provenance.pack_version, "0.2.0");
  assert.equal(exact.provenance.rule_id, exact.detector.rule_id);
  assert.match(exact.detector.provenance, /^seed/);
  assert.deepEqual(result.provenance.engine, { id: "@open-lens/core", version: "0.1.0" });
  assert.equal(result.provenance.packs[0].license, "CC-BY-SA-4.0");
});

test("unmarked output remains explicitly unchecked and contains no score", () => {
  const result = createLens({ packs: [english] }).analyze("Zebras nap beneath acacia trees.");
  assert.equal(result.annotations.length, 0);
  assert.equal(result.metrics.annotation_count, 0);
  assert.equal("annotations_per_100_tokens" in result.metrics, false);
  assert.ok(result.notices.some(({ code }) => code === "UNMARKED_IS_UNCHECKED"));
  assert.ok(result.notices.some(({ code }) => code === "CANDIDATE_CUES_ONLY"));
});

test("language fallback is one-way and unsupported languages remain unmarked", () => {
  const lens = createLens({ packs: [english] });
  assert.equal(lens.analyze({ text: "maybe", language: "en-US" }).annotations.length, 1);
  const unsupported = lens.analyze({ text: "maybe", language: "yue-Hant-HK" });
  assert.equal(unsupported.annotations.length, 0);
  assert.deepEqual(unsupported.provenance.packs, []);
});

test("one-shot analyze uses the same deterministic interface", () => {
  const result = analyze({ text: "maybe", language: "en" }, { packs: [english] });
  assert.equal(result.annotations[0].selector.quote.exact, "maybe");
});

test("pack compiler rejects executable, ambiguous, and empty-span rule shapes", () => {
  assert.throws(() => createLens({ packs: [] }), /non-empty packs/);
  assert.throws(() => createLens({ packs: [fixturePack([regexRule("bad", "maybe", "i")])] }), /global, non-sticky/);
  assert.throws(() => createLens({ packs: [fixturePack([regexRule("bad", "^", "gu")])] }), /matches empty text/);
  assert.throws(() => createLens({ packs: [fixturePack([{ ...surfaceRule("bad", "maybe"), callback() {} }])] }).analyze("maybe"), /plain JSON|callback|function/);
});

test("pack compiler enforces the public status and flag contract", () => {
  const invalidStatus = fixturePack([surfaceRule("status", "maybe")]);
  invalidStatus.techniques[0].status = "experimental";
  assert.throws(() => createLens({ packs: [invalidStatus] }), /status must be live, reference, or candidate/);

  const permutedFlags = fixturePack([{ ...surfaceRule("flags", "maybe"), flags: "uig" }]);
  assert.throws(() => createLens({ packs: [permutedFlags] }), /flags must be exactly giu/);
  assert.throws(() => createLens({ packs: [fixturePack([regexRule("no-global", "maybe", "iu")])] }), /global, non-sticky/);
  assert.throws(() => createLens({ packs: [fixturePack([regexRule("sticky", "maybe", "giy")])] }), /global, non-sticky/);
});

test("pack compiler rejects empty and whitespace-only surface cues", () => {
  for (const source of ["", " ", "\n\t", "\u2003\u00a0"]) {
    assert.throws(
      () => createLens({ packs: [fixturePack([surfaceRule("bad-whitespace", source)])] }),
      /non-empty string|non-whitespace cue/,
      JSON.stringify(source),
    );
  }
});

test("every shipped surface rule matches its own visible source and keeps its stable ID", () => {
  const lens = createLens({ packs: [english] });
  for (const rule of english.rules.filter(({ kind }) => kind === "surface")) {
    const result = lens.analyze({ text: rule.source, language: rule.language });
    assert.ok(
      result.annotations.some((annotation) => annotation.detector.rule_id === rule.id && annotation.selector.quote.exact === rule.source),
      `${rule.id} did not anchor its source`,
    );
  }
});

function fixturePack(rules) {
  return {
    object: "language-pack",
    schema_version: "0.1.0",
    id: "fixture/en",
    name: "Fixture English",
    version: "1.0.0",
    updated: "2026-07-11",
    license: "CC0-1.0",
    languages: ["en"],
    techniques: [{
      id: "OL.TEST",
      key: "test",
      name: "Test technique",
      family: "test",
      status: "live",
      what: "marks a fixture phrase",
      mechanism: "used to exercise deterministic matching",
      benign_reading: "the same phrase may be harmless",
      output_phrasing: "this is a fixture observation",
    }],
    rules,
  };
}

function surfaceRule(id, source) {
  return {
    id,
    technique_id: "OL.TEST",
    language: "en",
    kind: "surface",
    source,
    flags: "giu",
    provenance: "core test fixture",
  };
}

function regexRule(id, source, flags) {
  return {
    id,
    technique_id: "OL.TEST",
    language: "en",
    kind: "regex",
    source,
    flags,
    provenance: "core test fixture",
  };
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
