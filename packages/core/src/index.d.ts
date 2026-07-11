import type { Analysis, Annotation, LanguagePack, ValidationIssue } from "@open-lens/schema";

export const ENGINE_ID: "@open-lens/core";
export const ENGINE_VERSION: "0.1.0";
export const SCHEMA_VERSION: "0.1.0";
export const POSITION_UNIT: "unicode-code-point";
export const INPUT_NORMALIZATION: "none";

export interface AnalyzeInput {
  text: string;
  language?: string;
  normalization?: "none";
}

export interface CreateLensOptions {
  packs: LanguagePack[];
  defaultLanguage?: string;
  quoteContext?: number;
}

export interface TextSegment {
  start: number;
  end: number;
  text: string;
  annotation_ids: string[];
}

export interface Lens {
  analyze(input: AnalyzeInput | string): Analysis;
  stringify(value: unknown, space?: string | number): string;
  segment(text: string, analysisOrAnnotations: Analysis | Annotation[]): TextSegment[];
  capabilities: Readonly<{
    engine: { id: string; version: string };
    schema_version: string;
    normalization: readonly string[];
    position_units: readonly string[];
    overlap_policy: "retain-all";
    network: false;
    packs: Array<{ id: string; version: string; updated: string; license: string; languages: string[] }>;
  }>;
}

export function createLens(options: CreateLensOptions): Lens;
export function analyze(input: AnalyzeInput | string, options: CreateLensOptions): Analysis;
export function segmentText(text: string, analysisOrAnnotations: Analysis | Annotation[]): TextSegment[];
export function selectNonOverlappingAnnotations(analysisOrAnnotations: Analysis | Annotation[]): Annotation[];
export function verifyAnalysisSelectors(text: string, analysisOrAnnotations: Analysis | Annotation[]): { valid: boolean; issues: Array<ValidationIssue & { annotation_id?: string }> };
export function stableStringify(value: unknown, space?: string | number): string;
