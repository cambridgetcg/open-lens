import assert from "node:assert/strict";
import test from "node:test";

import { onRequestGet as getAnalysisWithWrongMethod, onRequestPost as createAnalysis } from "../functions/v1/analyses.js";
import { onRequestGet as getCapabilities } from "../functions/v1/capabilities.js";
import { onRequestGet as getOpenApi } from "../functions/v1/openapi.json.js";
import { onRequestPost as createReading } from "../functions/v1/readings.js";
import { onRequestGet as listTechniques } from "../functions/v1/techniques.js";
import { onRequestGet as getTechnique } from "../functions/v1/techniques/[id].js";
import { onRequestPost as legacyRead } from "../functions/api/read.js";
import { onRequest as v1Fallback } from "../functions/v1/[[path]].js";
import { MAX_TEXT_CODE_POINTS } from "../functions/v1/_lib/versions.js";

function request(path, body, headers = {}) {
  return new Request(`https://captioneer.test${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

async function body(response) {
  return JSON.parse(await response.text());
}

function safeModelResponse(overrides = {}) {
  return {
    response: {
      text: "We acknowledge mistakes while leaving the actor unstated.",
      register: "formal acknowledgement with agency absent",
      basis: ["ann_000001"],
      assumptions: ["The passive wording is relevant to how responsibility is presented."],
      alternatives: [{
        text: "The actor may not yet be established.",
        condition: "If the available evidence does not identify one.",
      }],
      ...overrides,
    },
  };
}

test("POST /v1/analyses returns exact span evidence, versions, and no score-like density", async () => {
  const response = await createAnalysis({
    request: request("/v1/analyses", { text: "🙂 Mistakes were made, probably.", language: "en-GB" }, {
      "x-request-id": "client-correlation-1",
    }),
    env: {},
  });
  const result = await body(response);

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store, max-age=0");
  assert.equal(response.headers.get("x-request-id"), "client-correlation-1");
  assert.equal(result.request_id, "client-correlation-1");
  assert.equal(result.object, "analysis");
  assert.equal(result.schema_version, "0.1.0");
  assert.equal(result.input.normalization, "none");
  assert.equal(result.annotations.length, 3, "overlapping surface and regex evidence is retained");
  assert.deepEqual(result.annotations.map((item) => item.selector.quote.exact), [
    "Mistakes were made",
    "were made",
    "probably",
  ]);
  assert.equal(result.annotations[0].selector.position.start, 2, "offsets use Unicode code points");
  assert.ok(result.annotations.every((item) => item.benign_reading));
  assert.ok(result.notices.some((notice) => notice.code === "UNMARKED_IS_UNCHECKED"));
  assert.ok(result.notices.some((notice) => notice.code === "CANDIDATE_CUES_ONLY"));
  assert.equal("match_density_per_100_tokens" in result.metrics, false);
  assert.equal("annotations_per_100_tokens" in result.metrics, false);
  assert.equal(result.metrics.by_technique["OL.AGENTDEL"], 2);
  assert.equal(result.metrics.by_technique["OL.HEDGE"], 1);
});

test("oversized v1 input is rejected with 413 and is never truncated", async () => {
  const response = await createAnalysis({
    request: request("/v1/analyses", { text: "x".repeat(MAX_TEXT_CODE_POINTS + 1) }),
    env: {},
  });
  const result = await body(response);

  assert.equal(response.status, 413);
  assert.equal(response.headers.get("content-type"), "application/problem+json; charset=utf-8");
  assert.equal(result.code, "text_too_large");
  assert.equal(result.max_code_points, MAX_TEXT_CODE_POINTS);
  assert.match(result.detail, /no input was analyzed or truncated/i);
  assert.match(result.request_id, /^req_/);
});

test("malformed JSON uses a structured problem response", async () => {
  const response = await createAnalysis({
    request: request("/v1/analyses", "{not-json"),
    env: {},
  });
  const result = await body(response);

  assert.equal(response.status, 400);
  assert.equal(result.status, 400);
  assert.equal(result.code, "invalid_json");
  assert.match(result.type, /\/problems\/invalid_json$/);
  assert.equal(result.request_id, response.headers.get("x-request-id"));
});

test("POST /v1/readings returns an evidence-linked interpretation and model/prompt versions", async () => {
  let modelCall;
  const env = {
    CAPTIONEER_MODEL_VERSION: "mock-model-7",
    AI: {
      async run(model, input) {
        modelCall = { model, input };
        return safeModelResponse();
      },
    },
  };
  const response = await createReading({
    request: request("/v1/readings", { text: "Mistakes were made." }),
    env,
  });
  const result = await body(response);

  assert.equal(response.status, 200);
  assert.equal(result.object, "reading");
  assert.equal(result.epistemic_status, "interpretation");
  assert.equal(result.model_version, "mock-model-7");
  assert.match(result.prompt_version, /^captioneer-reading-/);
  assert.match(result.policy_version, /^open-lens-output-policy-/);
  assert.deepEqual(result.basis, ["ann_000001"]);
  assert.ok(result.analysis.annotations.some((item) => item.id === result.basis[0]));
  assert.equal(result.analysis.request_id, result.request_id);
  assert.equal(response.headers.get("cache-control"), "no-store, max-age=0");
  assert.match(modelCall.input.messages[1].content, /"ann_000001"/);
  assert.equal(modelCall.input.response_format.type, "json_schema");
});

test("readings reject invented evidence IDs", async () => {
  const response = await createReading({
    request: request("/v1/readings", { text: "Mistakes were made." }),
    env: { AI: { run: async () => safeModelResponse({ basis: ["ann_invented"] }) } },
  });
  const result = await body(response);

  assert.equal(response.status, 502);
  assert.equal(result.code, "invalid_model_output");
  assert.equal("text" in result, false);
});

test("readings reject documented high-risk verdict vocabulary", async (t) => {
  for (const [name, text, expectedRule] of [
    ["lie", "The speaker is lying.", "lie_verdict"],
    ["sincerity", "This sounds insincere.", "sincerity_verdict"],
    ["intent", "They intentionally avoided responsibility.", "intent_verdict"],
    ["want-hide", "The speaker wanted to hide responsibility.", "intent_verdict"],
    ["knowledge", "They knew what happened.", "belief_verdict"],
    ["known-falsehood", "They knew the statement was false.", "truth_verdict"],
    ["fabrication", "The account is fabricated.", "truth_verdict"],
    ["telling-truth", "The speaker is not telling the truth.", "truth_verdict"],
    ["manipulation", "This is manipulative.", "manipulation_verdict"],
    ["mental-state", "The speaker is remorseful.", "mental_state_verdict"],
  ]) {
    await t.test(name, async () => {
      const response = await createReading({
        request: request("/v1/readings", { text: "Mistakes were made." }),
        env: { AI: { run: async () => safeModelResponse({ text }) } },
      });
      const result = await body(response);

      assert.equal(response.status, 502);
      assert.equal(result.code, "model_output_rejected");
      assert.equal(result.policy_rule, expectedRule);
      assert.equal("text" in result, false, "rejected model text must not be reflected");
    });
  }
});

test("readings require explicit assumptions and at least one alternative", async (t) => {
  for (const field of ["assumptions", "alternatives"]) {
    await t.test(field, async () => {
      const response = await createReading({
        request: request("/v1/readings", { text: "Mistakes were made." }),
        env: { AI: { run: async () => safeModelResponse({ [field]: [] }) } },
      });
      assert.equal(response.status, 502);
      assert.equal((await body(response)).code, "invalid_model_output");
    });
  }
});

test("readings report a structured 503 when the opt-in model is unavailable", async () => {
  const response = await createReading({
    request: request("/v1/readings", { text: "Mistakes were made." }),
    env: {},
  });
  const result = await body(response);

  assert.equal(response.status, 503);
  assert.equal(result.code, "model_unavailable");
  assert.equal(result.request_id, response.headers.get("x-request-id"));
});

test("discovery endpoints expose deployment truth and OpenAPI paths", async () => {
  const capabilitiesResponse = await getCapabilities({
    request: new Request("https://captioneer.test/v1/capabilities"),
    env: {},
  });
  const capabilities = await body(capabilitiesResponse);
  assert.equal(capabilities.analysis.deterministic, true);
  assert.equal(capabilities.readings.available, false);
  assert.equal(capabilities.readings.application_storage, "none");
  assert.equal(capabilities.readings.provider_retention, "see deployment privacy policy");
  assert.equal(capabilities.readings.abuse_control, "not-declared-by-deployment");
  assert.equal(capabilities.readings.production_ready, false);
  assert.equal(capabilities.readings.semantic_guarantee, false);
  assert.equal(capabilities.limits.overflow, "reject-413-never-truncate");

  const techniquesResponse = await listTechniques({
    request: new Request("https://captioneer.test/v1/techniques"),
    env: {},
  });
  const techniques = await body(techniquesResponse);
  assert.ok(techniques.data.length >= 7);
  assert.ok(techniques.data.every((item) => item.benign_reading));

  const techniqueResponse = await getTechnique({
    request: new Request("https://captioneer.test/v1/techniques/OL.HEDGE"),
    params: { id: "OL.HEDGE" },
    env: {},
  });
  const technique = await body(techniqueResponse);
  assert.equal(technique.id, "OL.HEDGE");

  const openApiResponse = await getOpenApi({
    request: new Request("https://captioneer.test/v1/openapi.json"),
    env: {},
  });
  const openapi = await body(openApiResponse);
  assert.equal(openapi.openapi, "3.1.2");
  for (const path of [
    "/v1/analyses",
    "/v1/readings",
    "/v1/techniques",
    "/v1/packs",
    "/v1/capabilities",
    "/v1/openapi.json",
  ]) assert.ok(openapi.paths[path], `${path} missing from OpenAPI`);
  assert.deepEqual(openapi["x-epistemic-boundary"].excluded, [
    "truth verdict",
    "lie verdict",
    "belief verdict",
    "sincerity verdict",
    "intent verdict",
    "manipulation verdict",
    "mental-state verdict",
    "speaker score",
  ]);
  assert.match(openapi["x-epistemic-boundary"].policy_scope, /not a semantic proof/i);
  assert.equal(openapi["x-production-readiness"].reference_repository_provides_auth_or_rate_limiting, false);

  const refs = [];
  const visit = (value) => {
    if (!value || typeof value !== "object") return;
    if (typeof value.$ref === "string") refs.push(value.$ref);
    for (const child of Object.values(value)) visit(child);
  };
  visit(openapi);
  for (const ref of refs) {
    assert.match(ref, /^#\//, `OpenAPI ref must be local: ${ref}`);
    const target = ref.slice(2).split("/").reduce((value, key) => value?.[key], openapi);
    assert.ok(target, `OpenAPI ref does not resolve: ${ref}`);
  }
  assert.equal(openapi.components.schemas.DocumentRequest.properties.text.maxLength, MAX_TEXT_CODE_POINTS);
  assert.equal(openapi.components.schemas.Reading.properties.assumptions.minItems, 1);
  assert.equal(openapi.components.schemas.Reading.properties.alternatives.minItems, 1);
  assert.equal("match_density_per_100_tokens" in openapi.components.schemas.Analysis.properties.metrics.properties, false);
});

test("legacy /api/read preserves the exact success payload and rejects overflow before inference", async () => {
  const env = {
    AI: {
      calls: 0,
      async run() {
        this.calls += 1;
        return { response: { caption: "We made mistakes.", register: "formal acknowledgement" } };
      },
    },
  };
  const response = await legacyRead({
    request: request("/api/read", { text: "Mistakes were made." }),
    env,
  });
  assert.deepEqual(await body(response), {
    caption: "We made mistakes.",
    register: "formal acknowledgement",
  });
  assert.equal(response.headers.get("cache-control"), "no-store, max-age=0");

  const overflow = await legacyRead({
    request: request("/api/read", { text: "x".repeat(2401) }),
    env,
  });
  assert.equal(overflow.status, 413);
  assert.match((await body(overflow)).error, /nothing was truncated or sent/i);
  assert.equal(env.AI.calls, 1);
});

test("the v1 fallback keeps unknown routes and unsupported methods structured", async () => {
  const directWrongMethod = await getAnalysisWithWrongMethod({
    request: new Request("https://captioneer.test/v1/analyses"),
    env: {},
  });
  assert.equal(directWrongMethod.status, 405);
  assert.equal(directWrongMethod.headers.get("allow"), "POST");

  const wrongMethod = await v1Fallback({
    request: new Request("https://captioneer.test/v1/analyses", { method: "PUT" }),
    env: {},
  });
  assert.equal(wrongMethod.status, 405);
  assert.equal(wrongMethod.headers.get("allow"), "POST");
  assert.equal((await body(wrongMethod)).code, "method_not_allowed");

  const unknown = await v1Fallback({
    request: new Request("https://captioneer.test/v1/does-not-exist"),
    env: {},
  });
  const problem = await body(unknown);
  assert.equal(unknown.status, 404);
  assert.equal(problem.code, "endpoint_not_found");
  assert.equal(problem.openapi, "GET /v1/openapi.json");
  assert.equal(unknown.headers.get("cache-control"), "no-store, max-age=0");
});
