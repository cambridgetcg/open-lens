import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const page = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
const agentDoor = readFileSync(new URL("../public/agent.txt", import.meta.url), "utf8");
const fieldGuide = readFileSync(new URL("../public/lexicon.html", import.meta.url), "utf8");

test("the reader describes cues and interpretations, not hidden truth or intent", () => {
  for (const forbidden of [
    "what someone actually means",
    "plain-truth version",
    "tells / 100 words",
    "Mark the spin",
    "who's dodging",
    "truth caption",
  ]) {
    assert.equal(page.includes(forbidden), false, `reader copy must not contain ${JSON.stringify(forbidden)}`);
  }

  assert.match(page, /a match is not a verdict/i);
  assert.match(page, /neither marks nor readings determine truth/i);
  assert.match(agentDoor, /a cue is not a verdict/i);
  assert.match(agentDoor, /does not determine truth/i);
});

test("local and remote processing are disclosed at the point of use", () => {
  assert.match(page, /scan runs on your device/i);
  assert.match(page, /optional AI sends text only when you ask/i);
  assert.match(page, /text sent to cloudflare workers ai only on request/i);
  assert.match(agentDoor, /sends the supplied statement to cloudflare workers ai/i);
  assert.match(page, /fetch\("\/v1\/readings"/);
  assert.doesNotMatch(page, /fetch\("\/api\/read"/);
  assert.match(page, /private deep link: #t=/);
  assert.doesNotMatch(page, /URLSearchParams\(location\.search\)/);
});

test("the reference reader consumes the generated core and pack modules", async () => {
  assert.match(page, /from "\/open-lens\.core\.gen\.js\?v=0\.1\.0"/);
  assert.match(page, /from "\/open-lens\.lexicon-en\.gen\.js\?v=0\.2\.0"/);
  assert.doesNotMatch(page, /<script src="\/lexicon\.gen\.js/);

  const core = await import(new URL("../public/open-lens.core.gen.js", import.meta.url));
  const { default: english } = await import(new URL("../public/open-lens.lexicon-en.gen.js", import.meta.url));
  const text = "🙂 Mistakes were made, probably.";
  const analysis = core.createLens({ packs: [english] }).analyze({
    text,
    language: "en",
  });

  assert.ok(analysis.annotations.length >= 2);
  assert.equal(analysis.annotations[0].selector.position.unit, "unicode-code-point");
  assert.ok(analysis.annotations.every(({ observation }) => /^(this span|this construction)/.test(observation)));
  assert.deepEqual(core.verifyAnalysisSelectors(text, analysis), { valid: true, issues: [] });

  for (const technique of english.techniques.filter(({ status }) => status === "live")) {
    assert.doesNotMatch(technique.output_phrasing, /hidden|not answered|denied later|never argues|evidence could support|quietly reduced/i);
  }
});

test("the optional reading exposes its basis, assumptions, and alternatives", () => {
  assert.match(page, /d\.analysis\?\.annotations/);
  assert.match(page, /d\.assumptions/);
  assert.match(page, /d\.alternatives/);
  assert.match(page, /Other plausible readings/);
});

test("editing invalidates visible analysis and stale model responses", () => {
  assert.match(page, /input\.addEventListener\("input", \(\) => \{ count\(\); invalidateAnalysis\(\); \}\)/);
  assert.match(page, /epoch !== readingEpoch \|\| input\.value !== text/);
  assert.match(page, />Dim matched cues</);
  assert.match(page, /"Restore matched cues"/);
  assert.doesNotMatch(page, /Show cues only/);
});

test("the public summary does not grade a speaker or statement", () => {
  const summary = page.match(/function summary\([\s\S]*?\n\}/)?.[0];
  assert.ok(summary, "reader summary function not found");
  for (const verdict of ["Heavily", "Noticeably", "Lightly", "evasive", "self-absolving"]) {
    assert.equal(summary.includes(verdict), false, `summary must not grade text as ${verdict}`);
  }
  assert.match(summary, /Inspect each in context/);
});

test("the field guide stays construction-focused and its fallback markup is valid", () => {
  assert.doesNotMatch(fieldGuide, /Every trick has/);
  assert.doesNotMatch(fieldGuide, /what the speaker gains/);
  assert.match(fieldGuide, /what the construction affords/);
  assert.match(fieldGuide, /href="\/lexicon\.gen\.js\?v=0\.2\.0"/);
  assert.doesNotMatch(fieldGuide, /lexicon\.gen\.js\?v=0\.2\.0"https:/);
});
