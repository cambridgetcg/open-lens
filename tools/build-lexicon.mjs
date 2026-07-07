// Build: lexicon/*.json → public/lexicon.gen.js (+ version-stamps the script URL
// in public/index.html so HTML and lexicon can't cache-skew silently).
// The lexicon is the ground truth; the site is a consumer. Run `npm run build`
// after any lexicon change, then deploy. Validation here is the first, tiny
// ancestor of the promotion gate described in CONTRIBUTING.md.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(readFileSync(join(root, "lexicon/lexicon.json"), "utf8"));

const REQUIRED = ["id", "key", "name", "family", "status", "what", "affordance", "mechanism", "benign_reading", "output_phrasing", "naming_events", "citations"];
// Fields that reach the page's DOM (title attributes, innerHTML) — no markup
// allowed. The page escapes too; defense in depth, because merged lexicon JSON
// is a supply chain (see CONTRIBUTING: declarative data only).
const DOM_FIELDS = ["name", "what", "affordance", "benign_reading", "output_phrasing"];
const CANONICAL_ORDER = ["hedge", "deflect", "passive", "loaded", "overclaim", "minimize"];

const techniques = [];
const problems = [];
for (const fname of manifest.entries) {
  const t = JSON.parse(readFileSync(join(root, "lexicon/techniques", fname), "utf8"));

  for (const field of REQUIRED) {
    if (t[field] === undefined) problems.push(`${fname}: missing required field "${field}"`);
  }
  if (!Array.isArray(t.citations) || t.citations.length < 1) {
    problems.push(`${fname}: at least one primary-source citation is required (the anti-SCAN rule)`);
  }
  if (t.key && !/^[a-z][a-z0-9_-]{1,31}$/.test(t.key)) {
    problems.push(`${fname}: key "${t.key}" must match /^[a-z][a-z0-9_-]{1,31}$/ (it flows into DOM attributes)`);
  }
  for (const f of DOM_FIELDS) {
    if (typeof t[f] === "string" && /[<>"&]/.test(t[f])) {
      problems.push(`${fname}: field "${f}" contains markup characters (<>"&) — these reach the DOM; plain text only`);
    }
  }
  if (t.ledger_line != null) {
    const stripped = String(t.ledger_line).replace(/<\/?[bi]>/g, "");
    if (/[<>"]/.test(stripped)) problems.push(`${fname}: ledger_line may contain only <b>/<i> markup (no attributes) — found other markup`);
    for (const tok of String(t.ledger_line).match(/\{[^}]*\}/g) || []) {
      if (tok !== "{n}" && tok !== "{s}") problems.push(`${fname}: ledger_line placeholder ${tok} unknown — only {n} and {s} exist`);
    }
  }
  if (t.status === "live") {
    const en = t.realizations && t.realizations.en;
    if (!en || (!(en.patterns || []).length && !(en.regex || []).length)) {
      problems.push(`${fname}: status "live" but no en realization patterns`);
    }
    if (!t.ledger_line) problems.push(`${fname}: status "live" but no ledger_line`);
  }
  for (const r of (t.realizations && t.realizations.en && t.realizations.en.regex) || []) {
    try { new RegExp(r.source, r.flags); } catch (e) { problems.push(`${fname}: bad regex — ${e.message}`); }
    if (!String(r.flags || "").includes("g")) problems.push(`${fname}: regex flags "${r.flags}" must include "g" — a non-global regex never advances and hangs the reader`);
    if (String(r.flags || "").includes("y")) problems.push(`${fname}: sticky "y" flag not allowed in lexicon regexes`);
  }
  const banned = /\b(liar|lying|deceptive person|gaslighter|manipulator)\b/i;
  if (banned.test(t.output_phrasing || "")) problems.push(`${fname}: output_phrasing contains a verdict word — describe the language, never the speaker`);

  techniques.push(t);
}

// display order is load-bearing: the reader's frequency panel and ledger follow it
const liveKeys = techniques.filter(t => t.status === "live").map(t => t.key);
const coreInOrder = liveKeys.filter(k => CANONICAL_ORDER.includes(k));
if (JSON.stringify(coreInOrder) !== JSON.stringify(CANONICAL_ORDER)) {
  problems.push(`lexicon.json: the six core families must appear in canonical display order ${CANONICAL_ORDER.join(",")} — got ${coreInOrder.join(",")}`);
}

if (problems.length) {
  console.error("lexicon validation failed:\n  " + problems.join("\n  "));
  process.exit(1);
}

const payload = { version: manifest.version, updated: manifest.updated, license: manifest.license, techniques };
const js = `/* GENERATED from lexicon/ v${manifest.version} — do not edit by hand; run \`npm run build\`.
 * Data license: ${manifest.license}. Every mark points at a visible phrase. */
window.CAPTIONEER_LEXICON = ${JSON.stringify(payload)};
`;
writeFileSync(join(root, "public/lexicon.gen.js"), js);

// stamp the versioned URL into index.html so HTML/lexicon cache skew is impossible
const htmlPath = join(root, "public/index.html");
const html = readFileSync(htmlPath, "utf8");
const stamped = html.replace(/\/lexicon\.gen\.js(\?v=[^"']*)?/, `/lexicon.gen.js?v=${manifest.version}`);
if (!stamped.includes(`/lexicon.gen.js?v=${manifest.version}`)) {
  console.error("failed to stamp lexicon version into public/index.html");
  process.exit(1);
}
if (stamped !== html) writeFileSync(htmlPath, stamped);

const live = techniques.filter(t => t.status === "live");
const n = live.reduce((a, t) => a + ((t.realizations.en && t.realizations.en.patterns) || []).length, 0);
console.log(`lexicon.gen.js: v${manifest.version} — ${techniques.length} techniques (${live.length} live), ${n} en patterns`);
