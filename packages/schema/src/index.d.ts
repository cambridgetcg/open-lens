export const SCHEMA_VERSION: "0.1.0";
export const POSITION_UNIT: "unicode-code-point";
export const INPUT_NORMALIZATION: "none";
export const TECHNIQUE_STATUSES: readonly ["live", "reference", "candidate"];

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export interface ValidationIssue {
  path: string;
  message: string;
}

export interface TextPositionSelector {
  start: number;
  end: number;
  unit: typeof POSITION_UNIT;
}

export interface TextQuoteSelector {
  exact: string;
  prefix: string;
  suffix: string;
}

export interface TextSelector {
  position: TextPositionSelector;
  quote: TextQuoteSelector;
}

export type RuleKind = "surface" | "regex";

export interface Technique {
  id: string;
  key: string;
  name: string;
  family: string;
  status: "live" | "reference" | "candidate";
  what: string;
  mechanism: string;
  benign_reading: string;
  output_phrasing: string;
  [key: string]: JsonValue | undefined;
}

export interface DetectionRuleBase {
  id: string;
  technique_id: string;
  language: string;
  source: string;
  provenance: string;
}

export interface SurfaceDetectionRule extends DetectionRuleBase {
  kind: "surface";
  flags: "giu";
}

export interface RegexDetectionRule extends DetectionRuleBase {
  kind: "regex";
  flags: string;
}

export type DetectionRule = SurfaceDetectionRule | RegexDetectionRule;

export interface LanguagePack {
  object: "language-pack";
  schema_version: typeof SCHEMA_VERSION;
  id: string;
  name: string;
  version: string;
  updated: string;
  license: string;
  languages: string[];
  techniques: Technique[];
  rules: DetectionRule[];
}

export interface Annotation {
  id: string;
  technique_id: string;
  technique_key: string;
  family: string;
  selector: TextSelector;
  observation: string;
  benign_reading: string;
  detector: {
    kind: RuleKind;
    rule_id: string;
    language: string;
    source: string;
    flags: string;
    provenance: string;
  };
  provenance: {
    pack_id: string;
    pack_version: string;
    technique_id: string;
    rule_id: string;
  };
}

export interface AnalysisNotice {
  code: string;
  message: string;
}

export interface Analysis {
  object: "analysis";
  schema_version: typeof SCHEMA_VERSION;
  language: string;
  input: {
    normalization: typeof INPUT_NORMALIZATION;
    length: {
      code_points: number;
      utf16_code_units: number;
    };
  };
  annotations: Annotation[];
  metrics: {
    annotation_count: number;
    token_count: number;
    by_technique: Record<string, number>;
  };
  notices: AnalysisNotice[];
  provenance: {
    engine: { id: string; version: string };
    packs: Array<{ id: string; version: string; updated: string; license: string; languages: string[] }>;
  };
}

export const SCHEMA_IDS: Readonly<{
  span_selector: string;
  annotation: string;
  analysis: string;
  language_pack: string;
}>;

export const NOTICE_CODES: Readonly<{
  CANDIDATE_CUES_ONLY: "CANDIDATE_CUES_ONLY";
  UNMARKED_IS_UNCHECKED: "UNMARKED_IS_UNCHECKED";
}>;

export const STANDARD_NOTICES: ReadonlyArray<Readonly<AnalysisNotice>>;

export function codePointLength(text: string): number;
export function codePointIndexToUtf16(text: string, codePointIndex: number): number;
export function utf16IndexToCodePoint(text: string, utf16Index: number): number;
export function createTextSelector(text: string, start: number, end: number, options?: { context?: number }): TextSelector;
export function selectorToUtf16Range(text: string, selector: TextSelector, options?: { verify?: boolean }): { start: number; end: number };
export function sliceTextSelector(text: string, selector: TextSelector): string;
export function verifyTextSelector(text: string, selector: TextSelector): { valid: boolean; issues: ValidationIssue[] };
export function validateTextSelector(selector: unknown): ValidationIssue[];
export function validateAnalysis(analysis: unknown): ValidationIssue[];
export function assertAnalysis<T extends Analysis>(analysis: T): T;
export function validateLanguagePack(pack: unknown): ValidationIssue[];
export function assertLanguagePack<T extends LanguagePack>(pack: T): T;
export function stableStringify(value: unknown, space?: string | number): string;
export function stableClone<T>(value: T): T;
