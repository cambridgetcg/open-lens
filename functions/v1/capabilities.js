import { listPacks } from "./_lib/core-adapter.js";
import { handleApi, methodNotAllowed, optionsResponse } from "./_lib/http.js";
import {
  API_VERSION,
  DEFAULT_MODEL,
  DEFAULT_MODEL_VERSION,
  ENGINE_NAME,
  ENGINE_VERSION,
  MAX_JSON_BYTES,
  MAX_TEXT_CODE_POINTS,
  POLICY_VERSION,
  PROMPT_VERSION,
  SCHEMA_VERSION,
} from "./_lib/versions.js";

export function onRequestOptions({ request }) {
  return optionsResponse(request);
}

export function onRequestGet(context) {
  return handleApi(context, ({ env, requestId }) => ({
    object: "capabilities",
    api_version: API_VERSION,
    schema_version: SCHEMA_VERSION,
    request_id: requestId,
    analysis: {
      available: true,
      deterministic: true,
      engine: `${ENGINE_NAME}@${ENGINE_VERSION}`,
      overlap_semantics: "retain-all",
      speaker_or_intent_verdicts: false,
    },
    readings: {
      available: Boolean(env?.AI),
      opt_in: true,
      invocation: "explicit-post-only",
      epistemic_status: "interpretation",
      model: env?.CAPTIONEER_MODEL || DEFAULT_MODEL,
      model_version: env?.CAPTIONEER_MODEL_VERSION || env?.CAPTIONEER_MODEL || DEFAULT_MODEL_VERSION,
      prompt_version: PROMPT_VERSION,
      policy_version: POLICY_VERSION,
      output_policy: "structured-schema-plus-fail-closed-lexical-gate",
      semantic_guarantee: false,
      application_storage: "none",
      provider: "cloudflare-workers-ai",
      provider_retention: env?.CAPTIONEER_PROVIDER_RETENTION_POLICY_URL || "see deployment privacy policy",
      abuse_control: env?.CAPTIONEER_ABUSE_CONTROL || "not-declared-by-deployment",
      production_ready: Boolean(env?.AI && env?.CAPTIONEER_ABUSE_CONTROL && env?.CAPTIONEER_PROVIDER_RETENTION_POLICY_URL),
    },
    limits: {
      max_text_code_points: MAX_TEXT_CODE_POINTS,
      max_json_bytes: MAX_JSON_BYTES,
      overflow: "reject-413-never-truncate",
    },
    languages: ["en"],
    packs: listPacks(),
    routes: {
      analyses: "POST /v1/analyses",
      readings: "POST /v1/readings",
      techniques: "GET /v1/techniques",
      packs: "GET /v1/packs",
      openapi: "GET /v1/openapi.json",
    },
  }));
}

export function onRequestPost(context) {
  return methodNotAllowed(context, ["GET"]);
}
