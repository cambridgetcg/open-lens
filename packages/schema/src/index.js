/**
 * Open Lens transport-neutral schema utilities.
 *
 * This module is deliberately dependency-free and performs no I/O. Offsets
 * are Unicode code-point offsets into the caller's original string; JavaScript
 * UTF-16 offsets are exposed only through explicit conversion helpers.
 */

export const SCHEMA_VERSION = "0.1.0";
export const POSITION_UNIT = "unicode-code-point";
export const INPUT_NORMALIZATION = "none";
export const TECHNIQUE_STATUSES = deepFreeze(["live", "reference", "candidate"]);

export const SCHEMA_IDS = deepFreeze({
  span_selector: "urn:open-lens:schema:span-selector:0.1.0",
  annotation: "urn:open-lens:schema:annotation:0.1.0",
  analysis: "urn:open-lens:schema:analysis:0.1.0",
  language_pack: "urn:open-lens:schema:language-pack:0.1.0",
});

export const NOTICE_CODES = deepFreeze({
  CANDIDATE_CUES_ONLY: "CANDIDATE_CUES_ONLY",
  UNMARKED_IS_UNCHECKED: "UNMARKED_IS_UNCHECKED",
});

export const STANDARD_NOTICES = deepFreeze([
  {
    code: NOTICE_CODES.CANDIDATE_CUES_ONLY,
    message: "Annotations identify visible linguistic cues, not intent, deception, or truth.",
  },
  {
    code: NOTICE_CODES.UNMARKED_IS_UNCHECKED,
    message: "Unmarked text is unchecked, not endorsed.",
  },
]);

export function codePointLength(text) {
  assertString(text, "text");
  let length = 0;
  for (const _codePoint of text) length += 1;
  return length;
}

export function codePointIndexToUtf16(text, codePointIndex) {
  assertString(text, "text");
  assertNonNegativeInteger(codePointIndex, "codePointIndex");

  let currentCodePoint = 0;
  let currentUtf16 = 0;
  if (codePointIndex === 0) return 0;

  for (const character of text) {
    currentCodePoint += 1;
    currentUtf16 += character.length;
    if (currentCodePoint === codePointIndex) return currentUtf16;
  }

  throw new RangeError(`codePointIndex ${codePointIndex} exceeds text length ${currentCodePoint}`);
}

export function utf16IndexToCodePoint(text, utf16Index) {
  assertString(text, "text");
  assertNonNegativeInteger(utf16Index, "utf16Index");
  if (utf16Index > text.length) {
    throw new RangeError(`utf16Index ${utf16Index} exceeds text length ${text.length}`);
  }

  let currentCodePoint = 0;
  let currentUtf16 = 0;
  if (utf16Index === 0) return 0;

  for (const character of text) {
    currentUtf16 += character.length;
    currentCodePoint += 1;
    if (currentUtf16 === utf16Index) return currentCodePoint;
    if (currentUtf16 > utf16Index) {
      throw new RangeError(`utf16Index ${utf16Index} splits a Unicode surrogate pair`);
    }
  }

  return currentCodePoint;
}

export function createTextSelector(text, start, end, options = {}) {
  assertString(text, "text");
  assertNonNegativeInteger(start, "start");
  assertNonNegativeInteger(end, "end");
  if (end <= start) throw new RangeError("end must be greater than start; visible spans cannot be empty");

  const textLength = codePointLength(text);
  if (end > textLength) throw new RangeError(`end ${end} exceeds text length ${textLength}`);

  const context = options.context === undefined ? 32 : options.context;
  assertNonNegativeInteger(context, "options.context");
  const points = Array.from(text);

  return {
    position: { start, end, unit: POSITION_UNIT },
    quote: {
      exact: points.slice(start, end).join(""),
      prefix: points.slice(Math.max(0, start - context), start).join(""),
      suffix: points.slice(end, Math.min(points.length, end + context)).join(""),
    },
  };
}

export function selectorToUtf16Range(text, selector, options = {}) {
  assertString(text, "text");
  const issues = validateTextSelector(selector);
  if (issues.length) throw validationError("Invalid text selector", issues);

  const start = codePointIndexToUtf16(text, selector.position.start);
  const end = codePointIndexToUtf16(text, selector.position.end);
  if (options.verify !== false) {
    const verification = verifyTextSelector(text, selector);
    if (!verification.valid) throw validationError("Text selector does not anchor to the supplied text", verification.issues);
  }
  return { start, end };
}

export function sliceTextSelector(text, selector) {
  const { start, end } = selectorToUtf16Range(text, selector);
  return text.slice(start, end);
}

export function verifyTextSelector(text, selector) {
  const issues = validateTextSelector(selector);
  if (issues.length) return { valid: false, issues };

  let range;
  try {
    range = {
      start: codePointIndexToUtf16(text, selector.position.start),
      end: codePointIndexToUtf16(text, selector.position.end),
    };
  } catch (error) {
    return { valid: false, issues: [{ path: "selector.position", message: error.message }] };
  }

  const exact = text.slice(range.start, range.end);
  if (exact !== selector.quote.exact) {
    issues.push({ path: "selector.quote.exact", message: "does not equal the selected text" });
  }
  const prefixStart = Math.max(0, range.start - selector.quote.prefix.length);
  if (text.slice(prefixStart, range.start) !== selector.quote.prefix) {
    issues.push({ path: "selector.quote.prefix", message: "does not immediately precede the selected text" });
  }
  if (text.slice(range.end, range.end + selector.quote.suffix.length) !== selector.quote.suffix) {
    issues.push({ path: "selector.quote.suffix", message: "does not immediately follow the selected text" });
  }

  return { valid: issues.length === 0, issues };
}

export function validateTextSelector(selector) {
  const issues = [];
  if (!isRecord(selector)) return [{ path: "selector", message: "must be an object" }];
  const { position, quote } = selector;

  if (!isRecord(position)) {
    issues.push({ path: "selector.position", message: "must be an object" });
  } else {
    if (!isNonNegativeInteger(position.start)) issues.push({ path: "selector.position.start", message: "must be a non-negative integer" });
    if (!isNonNegativeInteger(position.end)) issues.push({ path: "selector.position.end", message: "must be a non-negative integer" });
    if (isNonNegativeInteger(position.start) && isNonNegativeInteger(position.end) && position.end <= position.start) {
      issues.push({ path: "selector.position.end", message: "must be greater than start" });
    }
    if (position.unit !== POSITION_UNIT) issues.push({ path: "selector.position.unit", message: `must equal ${POSITION_UNIT}` });
  }

  if (!isRecord(quote)) {
    issues.push({ path: "selector.quote", message: "must be an object" });
  } else {
    for (const key of ["exact", "prefix", "suffix"]) {
      if (typeof quote[key] !== "string") issues.push({ path: `selector.quote.${key}`, message: "must be a string" });
    }
    if (quote.exact === "") issues.push({ path: "selector.quote.exact", message: "must not be empty" });
    if (isRecord(position) && isNonNegativeInteger(position.start) && isNonNegativeInteger(position.end) && typeof quote.exact === "string") {
      if (codePointLength(quote.exact) !== position.end - position.start) {
        issues.push({ path: "selector.quote.exact", message: "code-point length must equal position end minus start" });
      }
    }
  }
  return issues;
}

export function validateAnalysis(analysis) {
  const issues = [];
  if (!isRecord(analysis)) return [{ path: "$", message: "analysis must be an object" }];
  requiredEqual(issues, analysis, "object", "analysis", "object");
  requiredEqual(issues, analysis, "schema_version", SCHEMA_VERSION, "schema_version");
  requiredString(issues, analysis, "language", "language");

  if (!isRecord(analysis.input)) {
    issues.push({ path: "input", message: "must be an object" });
  } else {
    requiredEqual(issues, analysis.input, "normalization", INPUT_NORMALIZATION, "input.normalization");
    if (!isRecord(analysis.input.length)) {
      issues.push({ path: "input.length", message: "must be an object" });
    } else {
      for (const key of ["code_points", "utf16_code_units"]) {
        if (!isNonNegativeInteger(analysis.input.length[key])) issues.push({ path: `input.length.${key}`, message: "must be a non-negative integer" });
      }
    }
  }

  const annotationIds = new Set();
  if (!Array.isArray(analysis.annotations)) {
    issues.push({ path: "annotations", message: "must be an array" });
  } else {
    analysis.annotations.forEach((annotation, index) => {
      const path = `annotations[${index}]`;
      if (!isRecord(annotation)) {
        issues.push({ path, message: "must be an object" });
        return;
      }
      for (const key of ["id", "technique_id", "technique_key", "family", "observation", "benign_reading"]) {
        requiredString(issues, annotation, key, `${path}.${key}`);
      }
      if (typeof annotation.id === "string") {
        if (annotationIds.has(annotation.id)) issues.push({ path: `${path}.id`, message: "must be unique within the analysis" });
        annotationIds.add(annotation.id);
      }
      for (const issue of validateTextSelector(annotation.selector)) {
        issues.push({ path: `${path}.${issue.path}`, message: issue.message });
      }
      if (!isRecord(annotation.detector)) {
        issues.push({ path: `${path}.detector`, message: "must be an object" });
      } else {
        for (const key of ["kind", "rule_id", "language", "source", "provenance"]) requiredString(issues, annotation.detector, key, `${path}.detector.${key}`);
        if (!["surface", "regex"].includes(annotation.detector.kind)) issues.push({ path: `${path}.detector.kind`, message: "must be surface or regex" });
      }
      if (!isRecord(annotation.provenance)) issues.push({ path: `${path}.provenance`, message: "must be an object" });
    });
  }

  if (!isRecord(analysis.metrics)) {
    issues.push({ path: "metrics", message: "must be an object" });
  } else {
    for (const key of Object.keys(analysis.metrics)) {
      if (!["annotation_count", "token_count", "by_technique"].includes(key)) {
        issues.push({ path: `metrics.${key}`, message: "is not a supported metrics field" });
      }
    }
    for (const key of ["annotation_count", "token_count"]) {
      if (!isNonNegativeInteger(analysis.metrics[key])) {
        issues.push({ path: `metrics.${key}`, message: "must be a non-negative integer" });
      }
    }
    if (!isRecord(analysis.metrics.by_technique)) {
      issues.push({ path: "metrics.by_technique", message: "must be an object" });
    } else {
      for (const [techniqueId, count] of Object.entries(analysis.metrics.by_technique)) {
        if (!techniqueId) issues.push({ path: "metrics.by_technique", message: "technique IDs must not be empty" });
        if (!isNonNegativeInteger(count)) {
          issues.push({ path: `metrics.by_technique.${techniqueId}`, message: "must be a non-negative integer" });
        }
      }
    }
    if (Array.isArray(analysis.annotations) && isNonNegativeInteger(analysis.metrics.annotation_count) && analysis.metrics.annotation_count !== analysis.annotations.length) {
      issues.push({ path: "metrics.annotation_count", message: "must equal annotations.length" });
    }
    if (isRecord(analysis.metrics.by_technique) && isNonNegativeInteger(analysis.metrics.annotation_count)) {
      const total = Object.values(analysis.metrics.by_technique)
        .filter(isNonNegativeInteger)
        .reduce((sum, count) => sum + count, 0);
      if (total !== analysis.metrics.annotation_count) {
        issues.push({ path: "metrics.by_technique", message: "counts must sum to annotation_count" });
      }
      if (Array.isArray(analysis.annotations)) {
        const observed = {};
        for (const annotation of analysis.annotations) {
          if (typeof annotation?.technique_id === "string" && annotation.technique_id) {
            observed[annotation.technique_id] = (observed[annotation.technique_id] || 0) + 1;
          }
        }
        for (const [techniqueId, count] of Object.entries(observed)) {
          if (analysis.metrics.by_technique[techniqueId] !== count) {
            issues.push({ path: `metrics.by_technique.${techniqueId}`, message: `must equal observed annotation count ${count}` });
          }
        }
        for (const [techniqueId, count] of Object.entries(analysis.metrics.by_technique)) {
          if (isNonNegativeInteger(count) && count > 0 && observed[techniqueId] === undefined) {
            issues.push({ path: `metrics.by_technique.${techniqueId}`, message: "has no corresponding annotation" });
          }
        }
      }
    }
  }

  if (!Array.isArray(analysis.notices) || analysis.notices.length < 1) {
    issues.push({ path: "notices", message: "must contain at least one notice" });
  } else {
    for (const [index, notice] of analysis.notices.entries()) {
      if (!isRecord(notice) || typeof notice.code !== "string" || typeof notice.message !== "string") {
        issues.push({ path: `notices[${index}]`, message: "must contain string code and message" });
      }
    }
  }
  if (!isRecord(analysis.provenance)) issues.push({ path: "provenance", message: "must be an object" });
  return issues;
}

export function assertAnalysis(analysis) {
  const issues = validateAnalysis(analysis);
  if (issues.length) throw validationError("Invalid Open Lens analysis", issues);
  return analysis;
}

export function validateLanguagePack(pack) {
  const issues = [];
  if (!isRecord(pack)) return [{ path: "$", message: "language pack must be an object" }];
  requiredEqual(issues, pack, "object", "language-pack", "object");
  requiredEqual(issues, pack, "schema_version", SCHEMA_VERSION, "schema_version");
  for (const key of ["id", "name", "version", "updated", "license"]) requiredString(issues, pack, key, key);
  if (!Array.isArray(pack.languages) || pack.languages.length < 1 || pack.languages.some((language) => typeof language !== "string" || !language)) {
    issues.push({ path: "languages", message: "must be a non-empty array of language tags" });
  }

  const techniqueIds = new Set();
  if (!Array.isArray(pack.techniques)) {
    issues.push({ path: "techniques", message: "must be an array" });
  } else {
    pack.techniques.forEach((technique, index) => {
      const path = `techniques[${index}]`;
      if (!isRecord(technique)) {
        issues.push({ path, message: "must be an object" });
        return;
      }
      for (const key of ["id", "key", "name", "family", "status", "what", "mechanism", "benign_reading", "output_phrasing"]) {
        requiredString(issues, technique, key, `${path}.${key}`);
      }
      if (typeof technique.status === "string" && !TECHNIQUE_STATUSES.includes(technique.status)) {
        issues.push({ path: `${path}.status`, message: `must be one of ${TECHNIQUE_STATUSES.join(", ")}` });
      }
      if (typeof technique.id === "string") {
        if (techniqueIds.has(technique.id)) issues.push({ path: `${path}.id`, message: "must be unique" });
        techniqueIds.add(technique.id);
      }
    });
  }

  const ruleIds = new Set();
  if (!Array.isArray(pack.rules)) {
    issues.push({ path: "rules", message: "must be an array" });
  } else {
    pack.rules.forEach((rule, index) => {
      const path = `rules[${index}]`;
      if (!isRecord(rule)) {
        issues.push({ path, message: "must be an object" });
        return;
      }
      for (const key of ["id", "technique_id", "language", "kind", "source", "flags", "provenance"]) requiredString(issues, rule, key, `${path}.${key}`);
      if (typeof rule.id === "string") {
        if (ruleIds.has(rule.id)) issues.push({ path: `${path}.id`, message: "must be unique" });
        ruleIds.add(rule.id);
      }
      if (typeof rule.technique_id === "string" && techniqueIds.size && !techniqueIds.has(rule.technique_id)) {
        issues.push({ path: `${path}.technique_id`, message: "must reference a technique in this pack" });
      }
      if (!["surface", "regex"].includes(rule.kind)) issues.push({ path: `${path}.kind`, message: "must be surface or regex" });
      if (rule.kind === "surface" && typeof rule.source === "string" && rule.source.trim() === "") {
        issues.push({ path: `${path}.source`, message: "surface source must contain a non-whitespace cue" });
      }
      if (rule.kind === "surface" && rule.flags !== "giu") {
        issues.push({ path: `${path}.flags`, message: "surface flags must be exactly giu" });
      }
      if (rule.kind === "regex" && typeof rule.flags === "string") {
        if (!rule.flags.includes("g")) issues.push({ path: `${path}.flags`, message: "regex flags must include g" });
        if (rule.flags.includes("y")) issues.push({ path: `${path}.flags`, message: "sticky regex rules are not allowed" });
        try {
          new RegExp(rule.source, rule.flags);
        } catch (error) {
          issues.push({ path: `${path}.source`, message: `invalid regular expression: ${error.message}` });
        }
      }
    });
  }
  return issues;
}

export function assertLanguagePack(pack) {
  const issues = validateLanguagePack(pack);
  if (issues.length) throw validationError("Invalid Open Lens language pack", issues);
  return pack;
}

export function stableStringify(value, space = 0) {
  const normalized = normalizeJson(value, new Set(), "$", true);
  return JSON.stringify(normalized, null, space);
}

export function stableClone(value) {
  return JSON.parse(stableStringify(value));
}

function normalizeJson(value, ancestors, path, isRoot = false) {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TypeError(`${path} contains a non-finite number`);
    return Object.is(value, -0) ? 0 : value;
  }
  if (["undefined", "function", "symbol", "bigint"].includes(typeof value)) {
    throw new TypeError(`${path} is not valid JSON${isRoot ? "" : ` (${typeof value})`}`);
  }
  if (ancestors.has(value)) throw new TypeError(`${path} contains a circular reference`);
  ancestors.add(value);

  let result;
  if (Array.isArray(value)) {
    result = value.map((item, index) => normalizeJson(item, ancestors, `${path}[${index}]`));
  } else {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) throw new TypeError(`${path} must be a plain JSON object`);
    // A normal object would route an own "__proto__" key through Object's
    // legacy prototype setter and silently drop it from canonical JSON.
    result = Object.create(null);
    for (const key of Object.keys(value).sort()) {
      result[key] = normalizeJson(value[key], ancestors, `${path}.${key}`);
    }
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

function assertString(value, name) {
  if (typeof value !== "string") throw new TypeError(`${name} must be a string`);
}

function assertNonNegativeInteger(value, name) {
  if (!isNonNegativeInteger(value)) throw new TypeError(`${name} must be a non-negative integer`);
}

function isNonNegativeInteger(value) {
  return Number.isInteger(value) && value >= 0;
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function requiredString(issues, object, key, path) {
  if (typeof object[key] !== "string" || !object[key]) issues.push({ path, message: "must be a non-empty string" });
}

function requiredEqual(issues, object, key, expected, path) {
  if (object[key] !== expected) issues.push({ path, message: `must equal ${expected}` });
}

function validationError(message, issues) {
  const error = new TypeError(`${message}: ${issues.map((issue) => `${issue.path} ${issue.message}`).join("; ")}`);
  error.issues = issues;
  return error;
}
