import {
  ENGINE_ID,
  ENGINE_VERSION as CORE_ENGINE_VERSION,
  SCHEMA_VERSION as CORE_SCHEMA_VERSION,
} from "../../../packages/core/src/index.js";

export const API_VERSION = "v1";
export const SCHEMA_VERSION = CORE_SCHEMA_VERSION;
export const ENGINE_NAME = ENGINE_ID;
export const ENGINE_VERSION = CORE_ENGINE_VERSION;

export const DEFAULT_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
export const DEFAULT_MODEL_VERSION = DEFAULT_MODEL;
export const PROMPT_VERSION = "captioneer-reading-2026-07-11.2";
export const POLICY_VERSION = "open-lens-output-policy-2026-07-11.2";

export const MAX_TEXT_CODE_POINTS = 12_000;
export const MAX_JSON_BYTES = 64 * 1024;
export const LEGACY_MAX_TEXT_CODE_POINTS = 2_400;
