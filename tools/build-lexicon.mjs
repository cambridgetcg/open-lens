// Build: lexicon/*.json → npm/browser packs (+ version-stamps browser imports so
// HTML, engine, and lexicon cannot cache-skew silently).
// The lexicon directory is the source of record; the site is a consumer. Run `npm run build`
// after any lexicon change, then deploy. Validation here is the first, tiny
// ancestor of the promotion gate described in CONTRIBUTING.md.
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { SCHEMA_VERSION as schemaRuntimeVersion } from "../packages/schema/src/index.js";
import {
  ENGINE_VERSION as coreRuntimeVersion,
  SCHEMA_VERSION as coreSchemaRuntimeVersion,
} from "../packages/core/src/index.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(readFileSync(join(root, "lexicon/lexicon.json"), "utf8"));
const schemaManifest = JSON.parse(readFileSync(join(root, "packages/schema/package.json"), "utf8"));
const coreManifest = JSON.parse(readFileSync(join(root, "packages/core/package.json"), "utf8"));

// Package versions are public protocol data. Keep npm manifests, runtime
// constants, and declaration literals in lockstep so a release cannot claim
// one version while executing or typing another.
const versionProblems = [];
checkVersion("@open-lens/schema package.json ↔ runtime", schemaManifest.version, schemaRuntimeVersion);
checkVersion("@open-lens/schema package.json ↔ declarations", schemaManifest.version, declarationVersion("packages/schema/src/index.d.ts", "SCHEMA_VERSION"));
checkVersion("@open-lens/core package.json ↔ runtime", coreManifest.version, coreRuntimeVersion);
checkVersion("@open-lens/core package.json ↔ declarations", coreManifest.version, declarationVersion("packages/core/src/index.d.ts", "ENGINE_VERSION"));
checkVersion("@open-lens/core schema runtime ↔ @open-lens/schema", coreSchemaRuntimeVersion, schemaManifest.version);
checkVersion("@open-lens/core schema declarations ↔ @open-lens/schema", declarationVersion("packages/core/src/index.d.ts", "SCHEMA_VERSION"), schemaManifest.version);
checkVersion("@open-lens/core dependency ↔ @open-lens/schema", coreManifest.dependencies?.["@open-lens/schema"], schemaManifest.version);
if (versionProblems.length) {
  console.error("package version validation failed:\n  " + versionProblems.join("\n  "));
  process.exit(1);
}

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
  for (const s of t.specimens || []) {
    for (const f of ["quote", "speaker", "date", "source"]) {
      if (!s[f]) problems.push(`${fname}: specimen missing "${f}"`);
    }
    if (s.quote && s.quote.length > 300) problems.push(`${fname}: specimen quote exceeds 300 chars — short fair-use quotes only`);
    if (s.source && !/^https?:\/\//.test(s.source)) problems.push(`${fname}: specimen source must be a URL`);
  }
  for (const h of t.honest_twins || []) {
    if (!h.text || !h.note) problems.push(`${fname}: honest_twin needs text + note`);
    if (h.text && h.text.length > 300) problems.push(`${fname}: honest_twin text exceeds 300 chars`);
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

const payload = {
  name: manifest.name,
  version: manifest.version,
  updated: manifest.updated,
  license: manifest.license,
  description: manifest.description,
  source: "https://github.com/cambridgetcg/open-lens",
  note: "An open taxonomy of rhetorical constructions. Matches are candidate cues, not verdicts; every entry includes a benign reading. Read language, never minds.",
  count: techniques.length,
  techniques,
};
const js = `/* GENERATED from lexicon/ v${manifest.version} — do not edit by hand; run \`npm run build\`.
 * Data license: ${manifest.license}. Every mark points at a visible phrase. */
window.CAPTIONEER_LEXICON = ${JSON.stringify(payload)};
`;
writeFileSync(join(root, "public/lexicon.gen.js"), js);
writeFileSync(join(root, "public/lexicon.json"), JSON.stringify(payload, null, 2) + "\n");

// Build the reusable English data pack separately from the Apache engine. Rule
// IDs are content-addressed so inserting another rule never renumbers existing
// provenance. A changed rule receives a changed ID, as it should.
const englishRules = [];
const ruleIds = new Set();
for (const technique of techniques) {
  const realization = technique.realizations && technique.realizations.en;
  if (!realization) continue;
  const provenance = realization.provenance || "Open Lens lexicon (provenance not supplied)";
  for (const source of realization.patterns || []) {
    const rule = makeRule({ techniqueId: technique.id, language: "en", kind: "surface", source, flags: "giu", provenance });
    if (ruleIds.has(rule.id)) problems.push(`${technique.id}: duplicate generated rule ID ${rule.id}`);
    ruleIds.add(rule.id);
    englishRules.push(rule);
  }
  for (const expression of realization.regex || []) {
    const rule = makeRule({ techniqueId: technique.id, language: "en", kind: "regex", source: expression.source, flags: expression.flags, provenance });
    if (ruleIds.has(rule.id)) problems.push(`${technique.id}: duplicate generated rule ID ${rule.id}`);
    ruleIds.add(rule.id);
    englishRules.push(rule);
  }
}

if (problems.length) {
  console.error("lexicon validation failed:\n  " + problems.join("\n  "));
  process.exit(1);
}

const packageManifestPath = join(root, "packages/lexicon-en/package.json");
const packageManifest = JSON.parse(readFileSync(packageManifestPath, "utf8"));
if (packageManifest.version !== manifest.version) {
  console.error(`packages/lexicon-en version ${packageManifest.version} must equal lexicon version ${manifest.version}`);
  process.exit(1);
}

const englishPack = {
  object: "language-pack",
  schema_version: "0.1.0",
  id: "open-lens/en",
  name: "Open Lens English",
  version: manifest.version,
  updated: manifest.updated,
  license: manifest.license,
  languages: ["en"],
  techniques,
  rules: englishRules,
};
const packJson = JSON.stringify(englishPack, null, 2) + "\n";
writeFileSync(join(root, "packages/lexicon-en/pack.json"), packJson);

const packModule = `/* GENERATED from lexicon/ v${manifest.version} — do not edit by hand; run \`npm run build\`.
 * Open Lens English data pack. License: ${manifest.license}. */
export const PACK_ID = "open-lens/en";
export const PACK_VERSION = ${JSON.stringify(manifest.version)};
export const english = ${JSON.stringify(englishPack)};
export default english;
`;
writeFileSync(join(root, "packages/lexicon-en/src/generated.js"), packModule);

// Dependency-free ESM artifacts for static hosts. They remain separate files
// because the engine is Apache-2.0 and the language data is CC-BY-SA-4.0.
const coreSource = readFileSync(join(root, "packages/core/src/index.js"), "utf8");
writeFileSync(join(root, "public/open-lens.core.gen.js"), `/* GENERATED from packages/core/src/index.js — Apache-2.0. */\n${coreSource}`);
writeFileSync(join(root, "public/open-lens.lexicon-en.gen.js"), packModule);

// npm publishes workspaces independently, so each tarball must carry its own
// correct license text rather than relying on the repository root.
const apacheLicense = readFileSync(join(root, "LICENSE"), "utf8");
const lexiconLicense = readFileSync(join(root, "lexicon/LICENSE"), "utf8");
writeFileSync(join(root, "packages/schema/LICENSE"), apacheLicense);
writeFileSync(join(root, "packages/core/LICENSE"), apacheLicense);
writeFileSync(join(root, "packages/lexicon-en/LICENSE"), lexiconLicense);

// The field guide still consumes the classic data artifact.
stampAsset("public/lexicon.html", /\/lexicon\.gen\.js(\?v=[^"']*)?/g, `/lexicon.gen.js?v=${manifest.version}`);

// The reader consumes separate engine and data ESM files so their licenses and
// release cadences remain explicit.
stampAsset("public/index.html", /\/open-lens\.core\.gen\.js(\?v=[^"']*)?/g, `/open-lens.core.gen.js?v=${coreManifest.version}`);
stampAsset("public/index.html", /\/open-lens\.lexicon-en\.gen\.js(\?v=[^"']*)?/g, `/open-lens.lexicon-en.gen.js?v=${manifest.version}`);

const live = techniques.filter(t => t.status === "live");
const n = live.reduce((a, t) => a + ((t.realizations.en && t.realizations.en.patterns) || []).length, 0);
console.log(`lexicon.gen.js + @open-lens/lexicon-en: v${manifest.version} — ${techniques.length} techniques (${live.length} live), ${n} en patterns, ${englishRules.length} rules`);

function makeRule({ techniqueId, language, kind, source, flags, provenance }) {
  const digest = createHash("sha256")
    .update(`${language}\0${kind}\0${source}\0${flags}`)
    .digest("hex")
    .slice(0, 12);
  return {
    id: `${techniqueId}.${language}.${kind}.${digest}`,
    technique_id: techniqueId,
    language,
    kind,
    source,
    flags,
    provenance,
  };
}

function stampAsset(page, pattern, expected) {
  const htmlPath = join(root, page);
  const html = readFileSync(htmlPath, "utf8");
  const stamped = html.replace(pattern, expected);
  if (!stamped.includes(expected)) {
    console.error(`failed to stamp ${expected} into ${page}`);
    process.exit(1);
  }
  if (stamped !== html) writeFileSync(htmlPath, stamped);
}

function declarationVersion(relativePath, exportName) {
  const source = readFileSync(join(root, relativePath), "utf8");
  const match = source.match(new RegExp(`export\\s+const\\s+${exportName}\\s*:\\s*["']([^"']+)["']\\s*;`));
  if (!match) {
    versionProblems.push(`${relativePath}: missing literal declaration for ${exportName}`);
    return undefined;
  }
  return match[1];
}

function checkVersion(label, actual, expected) {
  if (actual !== expected) versionProblems.push(`${label}: ${JSON.stringify(actual)} != ${JSON.stringify(expected)}`);
}
