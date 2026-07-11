/**
 * @open-lens/core — pure deterministic analysis, with no I/O or network path.
 * Apache-2.0. Language-pack data is distributed separately under its own license.
 */

export const ENGINE_ID = "@open-lens/core";
export const ENGINE_VERSION = "0.1.0";
export const SCHEMA_VERSION = "0.1.0";
export const POSITION_UNIT = "unicode-code-point";
export const INPUT_NORMALIZATION = "none";

const NOTICES = [
  {
    code: "CANDIDATE_CUES_ONLY",
    message: "Annotations identify visible linguistic cues, not intent, deception, or truth.",
  },
  {
    code: "UNMARKED_IS_UNCHECKED",
    message: "Unmarked text is unchecked, not endorsed.",
  },
];
const TECHNIQUE_STATUSES = ["live", "reference", "candidate"];

/**
 * Create an immutable, reusable analyzer from trusted declarative packs.
 * Regex rules execute as JavaScript RegExp and are not sandboxed against ReDoS.
 */
export function createLens(options = {}) {
  const packs = options.packs;
  if (!Array.isArray(packs) || packs.length === 0) {
    throw new TypeError("createLens requires a non-empty packs array");
  }
  const quoteContext = options.quoteContext === undefined ? 32 : options.quoteContext;
  if (!Number.isInteger(quoteContext) || quoteContext < 0) {
    throw new TypeError("quoteContext must be a non-negative integer");
  }
  const compiledPacks = packs.map((pack, packIndex) => compilePack(pack, packIndex));
  const defaultLanguage = options.defaultLanguage || compiledPacks[0].languages[0];

  return Object.freeze({
    analyze(input) {
      return analyzeWithCompiledPacks(input, compiledPacks, { defaultLanguage, quoteContext });
    },
    stringify(value, space = 0) {
      return stableStringify(value, space);
    },
    segment(text, analysisOrAnnotations) {
      return segmentText(text, analysisOrAnnotations);
    },
    capabilities: deepFreeze({
      engine: { id: ENGINE_ID, version: ENGINE_VERSION },
      schema_version: SCHEMA_VERSION,
      normalization: [INPUT_NORMALIZATION],
      position_units: [POSITION_UNIT],
      overlap_policy: "retain-all",
      network: false,
      packs: compiledPacks.map(packReceipt),
    }),
  });
}

/** One-shot convenience wrapper; `options.packs` is still required. */
export function analyze(input, options) {
  return createLens(options).analyze(input);
}

/**
 * Split original text at every annotation boundary. Each segment names every
 * active annotation, so nested and crossing overlaps remain renderable.
 */
export function segmentText(text, analysisOrAnnotations) {
  if (typeof text !== "string") throw new TypeError("text must be a string");
  const annotations = Array.isArray(analysisOrAnnotations)
    ? analysisOrAnnotations
    : analysisOrAnnotations?.annotations;
  if (!Array.isArray(annotations)) throw new TypeError("annotations must be an array or an analysis object");

  const points = Array.from(text);
  const boundaries = new Set([0, points.length]);
  for (const annotation of annotations) {
    const position = annotation?.selector?.position;
    assertPosition(position, points.length);
    boundaries.add(position.start);
    boundaries.add(position.end);
  }
  const ordered = [...boundaries].sort((a, b) => a - b);
  const segments = [];
  for (let index = 0; index < ordered.length - 1; index += 1) {
    const start = ordered[index];
    const end = ordered[index + 1];
    if (start === end) continue;
    const annotationIds = annotations
      .filter(({ selector }) => selector.position.start < end && selector.position.end > start)
      .map(({ id }) => id);
    segments.push({ start, end, text: points.slice(start, end).join(""), annotation_ids: annotationIds });
  }
  return segments;
}

/** Greedy compatibility helper for UIs that cannot display overlaps. */
export function selectNonOverlappingAnnotations(analysisOrAnnotations) {
  const annotations = Array.isArray(analysisOrAnnotations)
    ? analysisOrAnnotations
    : analysisOrAnnotations?.annotations;
  if (!Array.isArray(annotations)) throw new TypeError("annotations must be an array or an analysis object");
  const ordered = [...annotations].sort(compareAnnotations);
  const selected = [];
  let end = -1;
  for (const annotation of ordered) {
    if (annotation.selector.position.start >= end) {
      selected.push(annotation);
      end = annotation.selector.position.end;
    }
  }
  return selected;
}

/** Verify every position+quote selector against the exact original string. */
export function verifyAnalysisSelectors(text, analysisOrAnnotations) {
  if (typeof text !== "string") throw new TypeError("text must be a string");
  const annotations = Array.isArray(analysisOrAnnotations)
    ? analysisOrAnnotations
    : analysisOrAnnotations?.annotations;
  if (!Array.isArray(annotations)) throw new TypeError("annotations must be an array or an analysis object");
  const map = codePointMap(text);
  const issues = [];
  for (const [index, annotation] of annotations.entries()) {
    try {
      const position = annotation.selector.position;
      assertPosition(position, map.length - 1);
      const exact = text.slice(map[position.start], map[position.end]);
      if (exact !== annotation.selector.quote.exact) {
        issues.push({ annotation_id: annotation.id, path: `annotations[${index}].selector.quote.exact`, message: "does not equal selected original text" });
      }
      const prefix = annotation.selector.quote.prefix;
      const suffix = annotation.selector.quote.suffix;
      const start = map[position.start];
      const end = map[position.end];
      if (text.slice(Math.max(0, start - prefix.length), start) !== prefix) {
        issues.push({ annotation_id: annotation.id, path: `annotations[${index}].selector.quote.prefix`, message: "does not immediately precede selection" });
      }
      if (text.slice(end, end + suffix.length) !== suffix) {
        issues.push({ annotation_id: annotation.id, path: `annotations[${index}].selector.quote.suffix`, message: "does not immediately follow selection" });
      }
    } catch (error) {
      issues.push({ annotation_id: annotation?.id, path: `annotations[${index}].selector`, message: error.message });
    }
  }
  return { valid: issues.length === 0, issues };
}

/** Canonical JSON: object keys sorted recursively, array order preserved. */
export function stableStringify(value, space = 0) {
  return JSON.stringify(normalizeJson(value, new Set(), "$"), null, space);
}

function analyzeWithCompiledPacks(input, packs, defaults) {
  const request = typeof input === "string" ? { text: input } : input;
  if (!isRecord(request)) throw new TypeError("analyze input must be a string or an object");
  if (typeof request.text !== "string") throw new TypeError("analyze input.text must be a string");
  if (request.normalization !== undefined && request.normalization !== INPUT_NORMALIZATION) {
    throw new TypeError(`normalization must be ${INPUT_NORMALIZATION}; v0.1 never rewrites caller text`);
  }
  const text = request.text;
  const language = request.language || defaults.defaultLanguage;
  if (typeof language !== "string" || !language) throw new TypeError("language must be a non-empty string");

  const map = codePointMap(text);
  const applicablePacks = packs.filter((pack) => pack.languages.some((tag) => languageMatches(tag, language)));
  const hits = [];
  for (const pack of applicablePacks) {
    for (const rule of pack.rules) {
      if (!languageMatches(rule.language, language)) continue;
      const expression = new RegExp(rule.expression.source, rule.expression.flags);
      let match;
      while ((match = expression.exec(text)) !== null) {
        if (match[0].length === 0) {
          throw new TypeError(`rule ${rule.id} emitted an empty match; visible spans must be non-empty`);
        }
        const endUtf16 = match.index + match[0].length;
        const start = map.utf16ToCodePoint.get(match.index);
        const end = map.utf16ToCodePoint.get(endUtf16);
        if (start === undefined || end === undefined) {
          throw new TypeError(`rule ${rule.id} split a Unicode surrogate pair`);
        }
        hits.push({
          start,
          end,
          exact: match[0],
          technique: rule.technique,
          rule,
          pack,
        });
        if (expression.lastIndex === match.index) expression.lastIndex += 1;
      }
    }
  }

  hits.sort((left, right) =>
    left.start - right.start ||
    right.end - left.end ||
    left.pack.index - right.pack.index ||
    left.rule.index - right.rule.index ||
    left.rule.id.localeCompare(right.rule.id)
  );

  const annotations = hits.map((hit, index) => annotationFromHit(hit, index, text, map, defaults.quoteContext));
  const byTechnique = {};
  for (const pack of applicablePacks) {
    for (const technique of pack.techniques) {
      if (technique.status === "live" && byTechnique[technique.id] === undefined) byTechnique[technique.id] = 0;
    }
  }
  for (const annotation of annotations) byTechnique[annotation.technique_id] = (byTechnique[annotation.technique_id] || 0) + 1;
  const tokenCount = (text.trim().match(/\S+/g) || []).length;

  return deepFreeze({
    object: "analysis",
    schema_version: SCHEMA_VERSION,
    language,
    input: {
      normalization: INPUT_NORMALIZATION,
      length: { code_points: map.length - 1, utf16_code_units: text.length },
    },
    annotations,
    metrics: {
      annotation_count: annotations.length,
      token_count: tokenCount,
      by_technique: byTechnique,
    },
    notices: NOTICES.map((notice) => ({ ...notice })),
    provenance: {
      engine: { id: ENGINE_ID, version: ENGINE_VERSION },
      packs: applicablePacks.map(packReceipt),
    },
  });
}

function annotationFromHit(hit, index, text, map, quoteContext) {
  const startUtf16 = map[hit.start];
  const endUtf16 = map[hit.end];
  const prefixStart = Math.max(0, hit.start - quoteContext);
  const suffixEnd = Math.min(map.length - 1, hit.end + quoteContext);
  return {
    id: `ann_${String(index + 1).padStart(6, "0")}`,
    technique_id: hit.technique.id,
    technique_key: hit.technique.key,
    family: hit.technique.family,
    selector: {
      position: { start: hit.start, end: hit.end, unit: POSITION_UNIT },
      quote: {
        exact: text.slice(startUtf16, endUtf16),
        prefix: text.slice(map[prefixStart], startUtf16),
        suffix: text.slice(endUtf16, map[suffixEnd]),
      },
    },
    observation: hit.technique.output_phrasing,
    benign_reading: hit.technique.benign_reading,
    detector: {
      kind: hit.rule.kind,
      rule_id: hit.rule.id,
      language: hit.rule.language,
      source: hit.rule.source,
      flags: hit.rule.flags,
      provenance: hit.rule.provenance,
    },
    provenance: {
      pack_id: hit.pack.id,
      pack_version: hit.pack.version,
      technique_id: hit.technique.id,
      rule_id: hit.rule.id,
    },
  };
}

function compilePack(pack, packIndex) {
  if (!isRecord(pack)) throw new TypeError(`packs[${packIndex}] must be an object`);
  assertPlainJson(pack, `packs[${packIndex}]`, new Set());
  for (const key of ["id", "name", "version", "updated", "license"]) {
    if (typeof pack[key] !== "string" || !pack[key]) throw new TypeError(`packs[${packIndex}].${key} must be a non-empty string`);
  }
  if (pack.object !== "language-pack") throw new TypeError(`packs[${packIndex}].object must equal language-pack`);
  if (pack.schema_version !== SCHEMA_VERSION) throw new TypeError(`pack ${pack.id} schema_version must equal ${SCHEMA_VERSION}`);
  if (!Array.isArray(pack.languages) || pack.languages.length === 0) throw new TypeError(`pack ${pack.id} needs languages`);
  if (!Array.isArray(pack.techniques) || !Array.isArray(pack.rules)) throw new TypeError(`pack ${pack.id} needs techniques and rules arrays`);

  const techniqueMap = new Map();
  const techniques = [];
  for (const technique of pack.techniques) {
    for (const key of ["id", "key", "name", "family", "status", "what", "mechanism", "benign_reading", "output_phrasing"]) {
      if (typeof technique?.[key] !== "string" || !technique[key]) throw new TypeError(`pack ${pack.id} technique.${key} must be a non-empty string`);
    }
    if (!TECHNIQUE_STATUSES.includes(technique.status)) {
      throw new TypeError(`pack ${pack.id} technique ${technique.id} status must be live, reference, or candidate`);
    }
    if (techniqueMap.has(technique.id)) throw new TypeError(`pack ${pack.id} repeats technique ${technique.id}`);
    const snapshot = { ...technique };
    techniqueMap.set(snapshot.id, snapshot);
    techniques.push(snapshot);
  }

  const ruleIds = new Set();
  const rules = pack.rules.map((rule, ruleIndex) => {
    for (const key of ["id", "technique_id", "language", "kind", "source", "flags", "provenance"]) {
      if (typeof rule?.[key] !== "string" || !rule[key]) throw new TypeError(`pack ${pack.id} rule.${key} must be a non-empty string`);
    }
    if (ruleIds.has(rule.id)) throw new TypeError(`pack ${pack.id} repeats rule ${rule.id}`);
    ruleIds.add(rule.id);
    const technique = techniqueMap.get(rule.technique_id);
    if (!technique) throw new TypeError(`rule ${rule.id} references unknown technique ${rule.technique_id}`);
    if (technique.status !== "live") throw new TypeError(`rule ${rule.id} references non-live technique ${technique.id}`);
    let expression;
    if (rule.kind === "surface") {
      if (rule.source.trim() === "") throw new TypeError(`surface rule ${rule.id} source must contain a non-whitespace cue`);
      if (rule.flags !== "giu") throw new TypeError(`surface rule ${rule.id} flags must be exactly giu`);
      const chunks = rule.source.split(/\s+/).map(escapeRegex);
      const first = Array.from(rule.source)[0];
      const last = Array.from(rule.source).at(-1);
      const wordish = "[\\p{L}\\p{M}\\p{N}_]";
      const before = first && /[\p{L}\p{M}\p{N}_]/u.test(first) ? `(?<!${wordish})` : "";
      const after = last && /[\p{L}\p{M}\p{N}_]/u.test(last) ? `(?!${wordish})` : "";
      expression = { source: `${before}${chunks.join("\\s+")}${after}`, flags: "giu" };
    } else if (rule.kind === "regex") {
      if (!rule.flags.includes("g") || rule.flags.includes("y")) throw new TypeError(`rule ${rule.id} needs global, non-sticky regex flags`);
      expression = { source: rule.source, flags: rule.flags };
    } else {
      throw new TypeError(`rule ${rule.id} kind must be surface or regex`);
    }
    try {
      const probe = new RegExp(expression.source, expression.flags);
      if (probe.exec("")?.[0] === "") throw new TypeError("matches empty text");
    } catch (error) {
      throw new TypeError(`rule ${rule.id} has invalid regex: ${error.message}`);
    }
    return { ...rule, expression, technique, index: ruleIndex };
  });

  return {
    index: packIndex,
    id: pack.id,
    name: pack.name,
    version: pack.version,
    updated: pack.updated,
    license: pack.license,
    languages: [...pack.languages],
    techniques,
    rules,
  };
}

function packReceipt(pack) {
  return {
    id: pack.id,
    version: pack.version,
    updated: pack.updated,
    license: pack.license,
    languages: [...pack.languages],
  };
}

function languageMatches(packLanguage, requestedLanguage) {
  const pack = packLanguage.toLowerCase();
  const requested = requestedLanguage.toLowerCase();
  return requested === pack || requested.startsWith(`${pack}-`);
}

function codePointMap(text) {
  const offsets = [0];
  const utf16ToCodePoint = new Map([[0, 0]]);
  let utf16 = 0;
  let codePoint = 0;
  for (const character of text) {
    utf16 += character.length;
    codePoint += 1;
    offsets.push(utf16);
    utf16ToCodePoint.set(utf16, codePoint);
  }
  offsets.utf16ToCodePoint = utf16ToCodePoint;
  return offsets;
}

function compareAnnotations(left, right) {
  return left.selector.position.start - right.selector.position.start ||
    right.selector.position.end - left.selector.position.end ||
    left.id.localeCompare(right.id);
}

function assertPosition(position, textLength) {
  if (!isRecord(position) || position.unit !== POSITION_UNIT || !Number.isInteger(position.start) || !Number.isInteger(position.end) || position.start < 0 || position.end <= position.start || position.end > textLength) {
    throw new TypeError(`position must be an in-range, end-exclusive ${POSITION_UNIT} selector`);
  }
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeJson(value, ancestors, path) {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TypeError(`${path} contains a non-finite number`);
    return Object.is(value, -0) ? 0 : value;
  }
  if (["undefined", "function", "symbol", "bigint"].includes(typeof value)) throw new TypeError(`${path} is not valid JSON`);
  if (ancestors.has(value)) throw new TypeError(`${path} contains a circular reference`);
  ancestors.add(value);
  let result;
  if (Array.isArray(value)) {
    result = value.map((item, index) => normalizeJson(item, ancestors, `${path}[${index}]`));
  } else {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) throw new TypeError(`${path} must be a plain JSON object`);
    // Preserve an own "__proto__" data key instead of invoking Object's
    // legacy prototype setter while constructing the sorted representation.
    result = Object.create(null);
    for (const key of Object.keys(value).sort()) result[key] = normalizeJson(value[key], ancestors, `${path}.${key}`);
  }
  ancestors.delete(value);
  return result;
}

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const nested of Object.values(value)) deepFreeze(nested);
  }
  return value;
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function assertPlainJson(value, path, ancestors) {
  if (value === null || typeof value === "string" || typeof value === "boolean") return;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TypeError(`${path} contains a non-finite number`);
    return;
  }
  if (typeof value !== "object") throw new TypeError(`${path} contains non-JSON ${typeof value} data`);
  if (ancestors.has(value)) throw new TypeError(`${path} contains a circular reference`);
  ancestors.add(value);
  if (!Array.isArray(value)) {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) throw new TypeError(`${path} must contain only plain JSON objects`);
  }
  for (const [key, nested] of Object.entries(value)) assertPlainJson(nested, `${path}.${key}`, ancestors);
  ancestors.delete(value);
}
