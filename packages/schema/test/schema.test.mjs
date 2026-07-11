import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  INPUT_NORMALIZATION,
  NOTICE_CODES,
  POSITION_UNIT,
  SCHEMA_IDS,
  SCHEMA_VERSION,
  TECHNIQUE_STATUSES,
  assertAnalysis,
  assertLanguagePack,
  codePointIndexToUtf16,
  codePointLength,
  createTextSelector,
  selectorToUtf16Range,
  sliceTextSelector,
  stableClone,
  stableStringify,
  utf16IndexToCodePoint,
  validateAnalysis,
  validateLanguagePack,
  validateTextSelector,
  verifyTextSelector,
} from "../src/index.js";

test("schema constants freeze the v0.1 selector contract", () => {
  assert.equal(SCHEMA_VERSION, "0.1.0");
  assert.equal(POSITION_UNIT, "unicode-code-point");
  assert.equal(INPUT_NORMALIZATION, "none");
  assert.equal(NOTICE_CODES.UNMARKED_IS_UNCHECKED, "UNMARKED_IS_UNCHECKED");
  assert.deepEqual(TECHNIQUE_STATUSES, ["live", "reference", "candidate"]);
  assert.ok(Object.isFrozen(TECHNIQUE_STATUSES));
});

test("schema manifest, runtime, and declaration versions cannot drift", () => {
  const manifest = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  const declarations = readFileSync(new URL("../src/index.d.ts", import.meta.url), "utf8");
  assert.equal(manifest.version, SCHEMA_VERSION);
  assert.match(declarations, new RegExp(`export\\s+const\\s+SCHEMA_VERSION\\s*:\\s*"${escapeRegex(SCHEMA_VERSION)}"\\s*;`));
});

test("Unicode helpers distinguish code points from JavaScript UTF-16 units", () => {
  const text = "A🌞e\u0301廣";
  assert.equal(text.length, 6);
  assert.equal(codePointLength(text), 5);
  assert.deepEqual(
    [0, 1, 2, 3, 4, 5].map((index) => codePointIndexToUtf16(text, index)),
    [0, 1, 3, 4, 5, 6],
  );
  assert.deepEqual(
    [0, 1, 3, 4, 5, 6].map((index) => utf16IndexToCodePoint(text, index)),
    [0, 1, 2, 3, 4, 5],
  );
  assert.throws(() => utf16IndexToCodePoint(text, 2), /surrogate pair/);
  assert.throws(() => codePointIndexToUtf16(text, 6), /exceeds text length/);
});

test("position plus quote/context selectors anchor to exact original text", () => {
  const text = "🌞 Cafe\u0301 maybe — 廣東話";
  const selector = createTextSelector(text, 8, 13, { context: 3 });
  assert.deepEqual(selector, {
    position: { start: 8, end: 13, unit: "unicode-code-point" },
    quote: { exact: "maybe", prefix: "e\u0301 ", suffix: " — " },
  });
  assert.deepEqual(selectorToUtf16Range(text, selector), { start: 9, end: 14 });
  assert.equal(sliceTextSelector(text, selector), "maybe");
  assert.deepEqual(verifyTextSelector(text, selector), { valid: true, issues: [] });

  const stale = stableClone(selector);
  stale.quote.exact = "MAYBE";
  assert.equal(verifyTextSelector(text, stale).valid, false);
  assert.throws(() => selectorToUtf16Range(text, stale), /does not anchor/);
});

test("empty and internally inconsistent selectors fail validation", () => {
  assert.throws(() => createTextSelector("abc", 1, 1), /cannot be empty/);
  assert.ok(validateTextSelector({
    position: { start: 1, end: 1, unit: POSITION_UNIT },
    quote: { exact: "", prefix: "a", suffix: "bc" },
  }).length >= 2);
  assert.match(validateTextSelector({
    position: { start: 0, end: 2, unit: POSITION_UNIT },
    quote: { exact: "x", prefix: "", suffix: "" },
  }).map((issue) => issue.message).join(" "), /code-point length/);
});

test("stable JSON recursively sorts keys and rejects non-JSON ambiguity", () => {
  const left = { z: 1, a: { y: 2, b: 3 }, list: [{ d: 4, c: 5 }] };
  const right = { list: [{ c: 5, d: 4 }], a: { b: 3, y: 2 }, z: 1 };
  const canonical = '{"a":{"b":3,"y":2},"list":[{"c":5,"d":4}],"z":1}';
  assert.equal(stableStringify(left), canonical);
  assert.equal(stableStringify(right), canonical);
  assert.deepEqual(stableClone(left), JSON.parse(canonical));
  assert.throws(() => stableStringify({ value: undefined }), /not valid JSON/);
  assert.throws(() => stableStringify({ value: Number.NaN }), /non-finite/);
  const circular = {};
  circular.self = circular;
  assert.throws(() => stableStringify(circular), /circular/);
});

test("stable JSON preserves an own __proto__ data key without prototype mutation", () => {
  const value = JSON.parse('{"z":1,"__proto__":{"polluted":true}}');
  assert.ok(Object.hasOwn(value, "__proto__"));
  const canonical = stableStringify(value);
  assert.equal(canonical, '{"__proto__":{"polluted":true},"z":1}');

  const clone = stableClone(value);
  assert.ok(Object.hasOwn(clone, "__proto__"));
  assert.deepEqual(clone["__proto__"], { polluted: true });
  assert.equal(Object.getPrototypeOf(clone), Object.prototype);
  assert.equal({}.polluted, undefined);
});

test("analysis validator accepts the public contract and catches drift", () => {
  const analysis = makeAnalysis();
  assert.deepEqual(validateAnalysis(analysis), []);
  assert.equal(assertAnalysis(analysis), analysis);

  const broken = stableClone(analysis);
  broken.schema_version = "9";
  broken.annotations[0].selector.quote.exact = "wrong!";
  broken.annotations.push(stableClone(broken.annotations[0]));
  const paths = validateAnalysis(broken).map(({ path }) => path);
  assert.ok(paths.includes("schema_version"));
  assert.ok(paths.includes("annotations[0].selector.quote.exact"));
  assert.ok(paths.includes("annotations[1].id"));
  assert.throws(() => assertAnalysis(broken), /Invalid Open Lens analysis/);
});

test("analysis metrics are required, typed, and internally consistent", () => {
  const missing = makeAnalysis();
  delete missing.metrics;
  assert.deepEqual(validateAnalysis(missing).filter(({ path }) => path === "metrics"), [
    { path: "metrics", message: "must be an object" },
  ]);
  assert.throws(() => assertAnalysis(missing), /metrics must be an object/);

  const malformed = makeAnalysis();
  malformed.metrics = {
    annotation_count: 2,
    token_count: -1,
    by_technique: { "OL.TEST": 0.5 },
  };
  const paths = validateAnalysis(malformed).map(({ path }) => path);
  assert.ok(paths.includes("metrics.annotation_count"));
  assert.ok(paths.includes("metrics.token_count"));
  assert.ok(paths.includes("metrics.by_technique.OL.TEST"));
  assert.ok(paths.includes("metrics.by_technique"));

  const inconsistent = makeAnalysis();
  inconsistent.metrics.by_technique["OL.TEST"] = 0;
  assert.match(
    validateAnalysis(inconsistent).map(({ message }) => message).join(" "),
    /counts must sum to annotation_count/,
  );

  const misattributed = makeAnalysis();
  misattributed.metrics.by_technique = { "OL.OTHER": 1 };
  const attributionMessages = validateAnalysis(misattributed).map(({ message }) => message).join(" ");
  assert.match(attributionMessages, /observed annotation count/);
  assert.match(attributionMessages, /no corresponding annotation/);

  const extra = makeAnalysis();
  extra.metrics.score = 0.9;
  assert.ok(validateAnalysis(extra).some(({ path }) => path === "metrics.score"));
});

test("language-pack validator preserves declarative rules and referential provenance", () => {
  const pack = makePack();
  assert.deepEqual(validateLanguagePack(pack), []);
  assert.equal(assertLanguagePack(pack), pack);

  const broken = stableClone(pack);
  broken.rules[0].technique_id = "OL.MISSING";
  broken.rules[0].flags = "iy";
  const messages = validateLanguagePack(broken).map(({ message }) => message).join(" ");
  assert.match(messages, /reference a technique/);
  assert.match(messages, /must include g/);
  assert.match(messages, /sticky/);
});

test("language-pack validation rejects whitespace-only surface cues", () => {
  for (const source of ["", " ", "\n\t", "\u2003\u00a0"]) {
    const pack = makePack();
    pack.rules[0] = {
      ...pack.rules[0],
      kind: "surface",
      source,
      flags: "giu",
    };
    const sourceIssues = validateLanguagePack(pack).filter(({ path }) => path === "rules[0].source");
    assert.ok(sourceIssues.length >= 1, `${JSON.stringify(source)} should be rejected`);
    assert.match(sourceIssues.map(({ message }) => message).join(" "), /non-empty|string|non-whitespace/);
  }
});

test("technique status and detector flags are identical across runtime, schema, and types", () => {
  const invalidStatus = makePack();
  invalidStatus.techniques[0].status = "experimental";
  assert.ok(validateLanguagePack(invalidStatus).some(({ path }) => path === "techniques[0].status"));

  const permutedSurfaceFlags = makePack();
  permutedSurfaceFlags.rules[0] = {
    ...permutedSurfaceFlags.rules[0],
    kind: "surface",
    source: "maybe",
    flags: "uig",
  };
  assert.ok(validateLanguagePack(permutedSurfaceFlags).some(({ path, message }) => path === "rules[0].flags" && /exactly giu/.test(message)));

  const languagePackSchema = loadSchemaDocuments().get(SCHEMA_IDS.language_pack);
  const ruleConditions = languagePackSchema.properties.rules.items.allOf;
  const surface = ruleConditions.find((condition) => condition.if.properties.kind.const === "surface");
  const regex = ruleConditions.find((condition) => condition.if.properties.kind.const === "regex");
  assert.equal(surface.then.properties.flags.const, "giu");
  assert.equal(regex.then.properties.flags.allOf[0].pattern, "g");
  assert.equal(regex.then.properties.flags.allOf[1].not.pattern, "y");
  assert.deepEqual(languagePackSchema.properties.techniques.items.properties.status.enum, [...TECHNIQUE_STATUSES]);

  const declarations = readFileSync(new URL("../src/index.d.ts", import.meta.url), "utf8");
  assert.match(declarations, /status:\s*"live"\s*\|\s*"reference"\s*\|\s*"candidate"\s*;/);
  assert.doesNotMatch(declarations, /status:[^;]*\|\s*string/);
  assert.match(declarations, /kind:\s*"surface";\s*flags:\s*"giu";/s);
});

test("published schemas pass local structural checks and every ref resolves through the registry", () => {
  const registry = loadSchemaDocuments();
  assert.equal(registry.size, Object.keys(SCHEMA_IDS).length);

  for (const [key, id] of Object.entries(SCHEMA_IDS)) {
    const schema = registry.get(id);
    assert.ok(schema, `missing ${key} schema`);
    assert.equal(schema.$schema, "https://json-schema.org/draft/2020-12/schema");
    assert.equal(schema.$id, id);
    assertSchemaNode(schema, `$registry[${JSON.stringify(id)}]`);
    for (const reference of collectReferences(schema)) {
      const resolved = resolveReference(reference, schema.$id, registry);
      assert.ok(resolved, `${reference} from ${schema.$id} did not resolve`);
    }
  }

  const graph = resolveReferenceGraph(SCHEMA_IDS.analysis, registry);
  assert.deepEqual(graph, new Set([
    SCHEMA_IDS.analysis,
    SCHEMA_IDS.annotation,
    SCHEMA_IDS.span_selector,
  ]));
});

function makeAnalysis() {
  return {
    object: "analysis",
    schema_version: "0.1.0",
    language: "en",
    input: { normalization: "none", length: { code_points: 5, utf16_code_units: 5 } },
    annotations: [{
      id: "ann_000001",
      technique_id: "OL.TEST",
      technique_key: "test",
      family: "test",
      selector: {
        position: { start: 0, end: 5, unit: "unicode-code-point" },
        quote: { exact: "maybe", prefix: "", suffix: "" },
      },
      observation: "this language lowers commitment",
      benign_reading: "it may express warranted uncertainty",
      detector: {
        kind: "surface",
        rule_id: "OL.TEST.en.surface.1",
        language: "en",
        source: "maybe",
        flags: "giu",
        provenance: "test fixture",
      },
      provenance: {
        pack_id: "test/en",
        pack_version: "1.0.0",
        technique_id: "OL.TEST",
        rule_id: "OL.TEST.en.surface.1",
      },
    }],
    metrics: { annotation_count: 1, token_count: 1, by_technique: { "OL.TEST": 1 } },
    notices: [{ code: "UNMARKED_IS_UNCHECKED", message: "Unmarked is unchecked." }],
    provenance: {
      engine: { id: "@open-lens/core", version: "0.1.0" },
      packs: [{ id: "test/en", version: "1.0.0", updated: "2026-07-11", license: "CC0-1.0", languages: ["en"] }],
    },
  };
}

function makePack() {
  return {
    object: "language-pack",
    schema_version: "0.1.0",
    id: "test/en",
    name: "Test English",
    version: "1.0.0",
    updated: "2026-07-11",
    license: "CC0-1.0",
    languages: ["en"],
    techniques: [{
      id: "OL.TEST",
      key: "test",
      name: "Test",
      family: "test",
      status: "live",
      what: "marks a test phrase",
      mechanism: "test mechanism",
      benign_reading: "test benign reading",
      output_phrasing: "this is a test phrase",
    }],
    rules: [{
      id: "OL.TEST.en.regex.1",
      technique_id: "OL.TEST",
      language: "en",
      kind: "regex",
      source: "\\bmaybe\\b",
      flags: "giu",
      provenance: "test fixture",
    }],
  };
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function loadSchemaDocuments() {
  const files = {
    span_selector: "span-selector.schema.json",
    annotation: "annotation.schema.json",
    analysis: "analysis.schema.json",
    language_pack: "language-pack.schema.json",
  };
  const registry = new Map();
  for (const [key, file] of Object.entries(files)) {
    const schema = JSON.parse(readFileSync(new URL(`../schemas/${file}`, import.meta.url), "utf8"));
    assert.equal(schema.$id, SCHEMA_IDS[key]);
    assert.doesNotThrow(() => new URL(schema.$id), `${schema.$id} must be absolute`);
    assert.equal(registry.has(schema.$id), false, `duplicate schema ID ${schema.$id}`);
    registry.set(schema.$id, schema);
  }
  return registry;
}

function collectReferences(value, references = []) {
  if (Array.isArray(value)) {
    for (const item of value) collectReferences(item, references);
  } else if (value && typeof value === "object") {
    if (typeof value.$ref === "string") references.push(value.$ref);
    for (const nested of Object.values(value)) collectReferences(nested, references);
  }
  return references;
}

function resolveReference(reference, baseId, registry) {
  let absolute;
  try {
    absolute = new URL(reference, baseId).href;
  } catch (error) {
    assert.fail(`unresolvable $ref ${JSON.stringify(reference)} from ${baseId}: ${error.message}`);
  }
  const hash = absolute.indexOf("#");
  const documentId = hash === -1 ? absolute : absolute.slice(0, hash);
  const document = registry.get(documentId);
  assert.ok(document, `$ref ${absolute} is absent from the local registry`);
  if (hash === -1 || absolute.slice(hash) === "#") return document;
  const pointer = absolute.slice(hash + 1);
  assert.match(pointer, /^\//, `only JSON Pointer fragments are supported in test resolver: ${absolute}`);
  return pointer.slice(1).split("/").reduce((value, token) => {
    const key = decodeURIComponent(token).replace(/~1/g, "/").replace(/~0/g, "~");
    assert.ok(value && Object.hasOwn(value, key), `missing pointer segment ${key} in ${absolute}`);
    return value[key];
  }, document);
}

function resolveReferenceGraph(rootId, registry) {
  const visited = new Set();
  const visit = (id) => {
    if (visited.has(id)) return;
    visited.add(id);
    const schema = registry.get(id);
    assert.ok(schema, `missing root schema ${id}`);
    for (const reference of collectReferences(schema)) {
      const resolved = resolveReference(reference, id, registry);
      visit(resolved.$id || new URL(reference, id).href.split("#")[0]);
    }
  };
  visit(rootId);
  return visited;
}

function assertSchemaNode(schema, path) {
  assert.ok(schema === true || schema === false || (schema && typeof schema === "object" && !Array.isArray(schema)), `${path} must be a schema object or boolean`);
  if (typeof schema === "boolean") return;
  const allowedTypes = new Set(["null", "boolean", "object", "array", "number", "integer", "string"]);
  if (schema.type !== undefined) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    assert.ok(types.length > 0 && types.every((type) => allowedTypes.has(type)), `${path}.type is invalid`);
  }
  if (schema.$id !== undefined) assert.doesNotThrow(() => new URL(schema.$id), `${path}.$id must be absolute`);
  if (schema.$ref !== undefined) assert.equal(typeof schema.$ref, "string", `${path}.$ref must be a string`);
  if (schema.required !== undefined) {
    assert.ok(Array.isArray(schema.required) && schema.required.every((key) => typeof key === "string"), `${path}.required must be a string array`);
    assert.equal(new Set(schema.required).size, schema.required.length, `${path}.required must be unique`);
  }
  if (schema.enum !== undefined) assert.ok(Array.isArray(schema.enum) && schema.enum.length > 0, `${path}.enum must be non-empty`);
  if (schema.pattern !== undefined) assert.doesNotThrow(() => new RegExp(schema.pattern, "u"), `${path}.pattern must compile`);
  for (const key of ["minimum", "minLength", "minItems"]) {
    if (schema[key] !== undefined) assert.ok(typeof schema[key] === "number" && schema[key] >= 0, `${path}.${key} must be non-negative`);
  }
  if (schema.properties !== undefined) {
    assert.ok(schema.properties && typeof schema.properties === "object" && !Array.isArray(schema.properties), `${path}.properties must be an object`);
    for (const [key, nested] of Object.entries(schema.properties)) assertSchemaNode(nested, `${path}.properties.${key}`);
  }
  for (const key of ["items", "additionalProperties", "propertyNames", "not", "if", "then", "else"]) {
    if (schema[key] !== undefined) assertSchemaNode(schema[key], `${path}.${key}`);
  }
  for (const key of ["allOf", "anyOf", "oneOf"]) {
    if (schema[key] !== undefined) {
      assert.ok(Array.isArray(schema[key]) && schema[key].length > 0, `${path}.${key} must be a non-empty schema array`);
      schema[key].forEach((nested, index) => assertSchemaNode(nested, `${path}.${key}[${index}]`));
    }
  }
}
