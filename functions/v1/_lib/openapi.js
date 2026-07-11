import {
  API_VERSION,
  DEFAULT_MODEL_VERSION,
  ENGINE_NAME,
  ENGINE_VERSION,
  MAX_TEXT_CODE_POINTS,
  POLICY_VERSION,
  PROMPT_VERSION,
  SCHEMA_VERSION,
} from "./versions.js";

const problemResponse = (description) => ({
  description,
  headers: {
    "X-Request-ID": { $ref: "#/components/headers/RequestId" },
    "Cache-Control": { $ref: "#/components/headers/NoStore" },
  },
  content: {
    "application/problem+json": { schema: { $ref: "#/components/schemas/Problem" } },
  },
});

const jsonResponse = (description, schema) => ({
  description,
  headers: {
    "X-Request-ID": { $ref: "#/components/headers/RequestId" },
    "Cache-Control": { $ref: "#/components/headers/NoStore" },
  },
  content: { "application/json": { schema } },
});

const publicGetResponses = (schema) => ({
  200: jsonResponse("Successful response.", schema),
  405: problemResponse("Method not allowed."),
  500: problemResponse("Unexpected server error."),
});

export function openApiDocument() {
  return {
    openapi: "3.1.2",
    info: {
      title: "Captioneer / Open Lens API",
      version: API_VERSION,
      description: "Deterministic, span-anchored rhetorical observations and a separate opt-in interpretation layer. Readings are constrained by a structured schema, prompt policy, and documented fail-closed lexical gate; that gate reduces known verdict language but is not proof of semantic compliance.",
      license: { name: "Apache-2.0", identifier: "Apache-2.0" },
    },
    servers: [{ url: "https://captioneer.io", description: "Hosted API" }],
    tags: [
      { name: "Discovery" },
      { name: "Observation" },
      { name: "Interpretation" },
    ],
    paths: {
      "/v1/capabilities": {
        get: {
          tags: ["Discovery"],
          operationId: "getCapabilities",
          summary: "Discover deployed capabilities and limits",
          responses: publicGetResponses({ $ref: "#/components/schemas/Capabilities" }),
        },
      },
      "/v1/packs": {
        get: {
          tags: ["Discovery"],
          operationId: "listPacks",
          summary: "List installed declarative language packs",
          responses: publicGetResponses({ $ref: "#/components/schemas/PackList" }),
        },
      },
      "/v1/techniques": {
        get: {
          tags: ["Discovery"],
          operationId: "listTechniques",
          summary: "List observable rhetorical techniques",
          responses: publicGetResponses({ $ref: "#/components/schemas/TechniqueList" }),
        },
      },
      "/v1/techniques/{id}": {
        get: {
          tags: ["Discovery"],
          operationId: "getTechnique",
          summary: "Get one technique by stable ID or key",
          parameters: [{
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          }],
          responses: {
            ...publicGetResponses({ $ref: "#/components/schemas/TechniqueResponse" }),
            404: problemResponse("Technique not found."),
          },
        },
      },
      "/v1/analyses": {
        post: {
          tags: ["Observation"],
          operationId: "createAnalysis",
          summary: "Run deterministic, local-to-the-service span marking",
          description: "Returns observations anchored to exact text spans. An unmarked span is unchecked, not certified true, safe, or direct.",
          requestBody: {
            required: true,
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/DocumentRequest" } },
            },
          },
          responses: {
            200: jsonResponse("Deterministic analysis.", { $ref: "#/components/schemas/Analysis" }),
            400: problemResponse("Malformed JSON or request object."),
            413: problemResponse("Text or JSON body exceeds the published limit; no truncation occurs."),
            415: problemResponse("Unsupported media type."),
            422: problemResponse("Invalid text or unsupported language."),
            500: problemResponse("Analysis failed."),
          },
        },
      },
      "/v1/readings": {
        post: {
          tags: ["Interpretation"],
          operationId: "createReading",
          summary: "Explicitly opt in to an evidence-linked model interpretation",
          description: "Runs deterministic analysis first, then asks the configured model for a defeasible interpretation. Every returned basis ID refers to an annotation included in the response. A documented fail-closed lexical gate rejects known truth, lie, belief, sincerity, motive, manipulation, and mental-state verdict vocabulary; it is a safety filter, not a semantic guarantee.",
          requestBody: {
            required: true,
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/DocumentRequest" } },
            },
          },
          responses: {
            200: jsonResponse("Evidence-linked interpretation.", { $ref: "#/components/schemas/Reading" }),
            400: problemResponse("Malformed JSON or request object."),
            413: problemResponse("Text or JSON body exceeds the published limit; no truncation occurs."),
            415: problemResponse("Unsupported media type."),
            422: problemResponse("Invalid text or unsupported language."),
            502: problemResponse("Model failure, invalid schema, invalid evidence link, or output-policy rejection."),
            503: problemResponse("No model binding is configured."),
          },
        },
      },
      "/v1/openapi.json": {
        get: {
          tags: ["Discovery"],
          operationId: "getOpenApiDocument",
          summary: "Fetch this OpenAPI document",
          responses: publicGetResponses({ type: "object" }),
        },
      },
    },
    components: {
      headers: {
        RequestId: {
          description: "Opaque correlation ID. A valid client-supplied X-Request-ID is echoed; otherwise one is generated.",
          schema: { type: "string" },
        },
        NoStore: {
          description: "API responses are never cacheable.",
          schema: { type: "string", const: "no-store, max-age=0" },
        },
      },
      schemas: {
        Problem: {
          type: "object",
          required: ["type", "title", "status", "detail", "code", "request_id"],
          properties: {
            type: { type: "string", format: "uri" },
            title: { type: "string" },
            status: { type: "integer", minimum: 400, maximum: 599 },
            detail: { type: "string" },
            code: { type: "string" },
            request_id: { type: "string" },
          },
          additionalProperties: true,
        },
        DocumentRequest: {
          type: "object",
          required: ["text"],
          properties: {
            text: { type: "string", minLength: 1, maxLength: MAX_TEXT_CODE_POINTS },
            language: { type: "string", default: "en", examples: ["en", "en-GB"] },
          },
          additionalProperties: false,
        },
        PositionSelector: {
          type: "object",
          required: ["start", "end", "unit"],
          properties: {
            start: { type: "integer", minimum: 0 },
            end: { type: "integer", minimum: 0 },
            unit: { type: "string", const: "unicode-code-point" },
          },
        },
        QuoteSelector: {
          type: "object",
          required: ["exact", "prefix", "suffix"],
          properties: {
            exact: { type: "string" },
            prefix: { type: "string" },
            suffix: { type: "string" },
          },
        },
        Annotation: {
          type: "object",
          required: ["id", "technique_id", "selector", "observation", "benign_reading", "detector"],
          properties: {
            id: { type: "string", pattern: "^ann_" },
            object: { type: "string", const: "annotation" },
            technique_id: { type: "string" },
            technique_key: { type: "string" },
            family: { type: "string" },
            selector: {
              type: "object",
              required: ["position", "quote"],
              properties: {
                position: { $ref: "#/components/schemas/PositionSelector" },
                quote: { $ref: "#/components/schemas/QuoteSelector" },
              },
            },
            observation: { type: "string" },
            benign_reading: { type: "string" },
            detector: { type: "object", additionalProperties: true },
            provenance: { type: "object", additionalProperties: true },
          },
        },
        Analysis: {
          type: "object",
          required: ["id", "object", "schema_version", "language", "input", "annotations", "metrics", "notices", "provenance", "request_id"],
          properties: {
            id: { type: "string", pattern: "^ana_" },
            object: { type: "string", const: "analysis" },
            schema_version: { type: "string", const: SCHEMA_VERSION },
            request_id: { type: "string" },
            language: { type: "string" },
            input: {
              type: "object",
              properties: {
                normalization: { type: "string", const: "none" },
                length: {
                  type: "object",
                  properties: {
                    code_points: { type: "integer", minimum: 0 },
                    utf16_code_units: { type: "integer", minimum: 0 },
                  },
                },
              },
            },
            annotations: { type: "array", items: { $ref: "#/components/schemas/Annotation" } },
            metrics: {
              type: "object",
              required: ["annotation_count", "token_count", "by_technique"],
              properties: {
                annotation_count: { type: "integer", minimum: 0 },
                token_count: { type: "integer", minimum: 0 },
                by_technique: {
                  type: "object",
                  additionalProperties: { type: "integer", minimum: 0 },
                },
              },
            },
            notices: { type: "array", items: { type: "object", additionalProperties: true } },
            provenance: { type: "object", additionalProperties: true },
          },
        },
        Alternative: {
          type: "object",
          required: ["text", "condition"],
          properties: {
            text: { type: "string", minLength: 1 },
            condition: { type: "string", minLength: 1 },
          },
          additionalProperties: false,
        },
        Reading: {
          type: "object",
          required: ["id", "object", "schema_version", "epistemic_status", "text", "register", "basis", "assumptions", "alternatives", "model_version", "prompt_version", "policy_version", "analysis", "request_id"],
          properties: {
            id: { type: "string", pattern: "^rdg_" },
            object: { type: "string", const: "reading" },
            schema_version: { type: "string", const: SCHEMA_VERSION },
            epistemic_status: { type: "string", const: "interpretation" },
            text: { type: "string", minLength: 1 },
            register: { type: "string", minLength: 1 },
            basis: { type: "array", uniqueItems: true, items: { type: "string", pattern: "^ann_" } },
            assumptions: { type: "array", minItems: 1, items: { type: "string", minLength: 1 } },
            alternatives: { type: "array", minItems: 1, items: { $ref: "#/components/schemas/Alternative" } },
            model_version: { type: "string", examples: [DEFAULT_MODEL_VERSION] },
            prompt_version: { type: "string", const: PROMPT_VERSION },
            policy_version: { type: "string", const: POLICY_VERSION },
            provenance: { type: "object", additionalProperties: true },
            analysis: { $ref: "#/components/schemas/Analysis" },
            request_id: { type: "string" },
          },
        },
        Technique: {
          type: "object",
          required: ["id", "key", "name", "mechanism", "benign_reading"],
          properties: {
            id: { type: "string" },
            key: { type: "string" },
            name: { type: "string" },
            family: { type: "string" },
            status: { type: "string" },
            mechanism: { type: "string" },
            benign_reading: { type: "string" },
            output_phrasing: { type: "string" },
            realizations: { type: "object", additionalProperties: true },
          },
        },
        TechniqueResponse: {
          allOf: [
            { $ref: "#/components/schemas/Technique" },
            {
              type: "object",
              required: ["object", "schema_version", "request_id"],
              properties: {
                object: { type: "string", const: "technique" },
                schema_version: { type: "string", const: SCHEMA_VERSION },
                request_id: { type: "string" },
              },
            },
          ],
        },
        Pack: {
          type: "object",
          required: ["id", "object", "schema_version", "version", "languages", "license", "permissions"],
          properties: {
            id: { type: "string" },
            object: { type: "string", const: "pack" },
            schema_version: { type: "string" },
            version: { type: "string" },
            languages: { type: "array", items: { type: "string" } },
            technique_count: { type: "integer", minimum: 0 },
            license: { type: "string" },
            source: { type: "string" },
            execution: { type: "string" },
            regex_engine: { type: "string" },
            trust: { type: "string" },
            permissions: { type: "object", additionalProperties: { type: "boolean" } },
          },
        },
        TechniqueList: {
          type: "object",
          required: ["object", "schema_version", "request_id", "data"],
          properties: {
            object: { type: "string", const: "list" },
            schema_version: { type: "string" },
            request_id: { type: "string" },
            data: { type: "array", items: { $ref: "#/components/schemas/Technique" } },
          },
        },
        PackList: {
          type: "object",
          required: ["object", "schema_version", "request_id", "data"],
          properties: {
            object: { type: "string", const: "list" },
            schema_version: { type: "string" },
            request_id: { type: "string" },
            data: { type: "array", items: { $ref: "#/components/schemas/Pack" } },
          },
        },
        Capabilities: {
          type: "object",
          required: ["object", "api_version", "schema_version", "request_id", "analysis", "readings", "limits", "languages", "packs", "routes"],
          properties: {
            object: { type: "string", const: "capabilities" },
            api_version: { type: "string", const: API_VERSION },
            schema_version: { type: "string", const: SCHEMA_VERSION },
            request_id: { type: "string" },
            analysis: {
              type: "object",
              properties: {
                available: { type: "boolean" },
                deterministic: { type: "boolean", const: true },
                engine: { type: "string", examples: [`${ENGINE_NAME}@${ENGINE_VERSION}`] },
                overlap_semantics: { type: "string", const: "retain-all" },
                speaker_or_intent_verdicts: { type: "boolean", const: false },
              },
            },
            readings: { type: "object", additionalProperties: true },
            limits: { type: "object", additionalProperties: true },
            languages: { type: "array", items: { type: "string" } },
            packs: { type: "array", items: { $ref: "#/components/schemas/Pack" } },
            routes: { type: "object", additionalProperties: { type: "string" } },
          },
        },
      },
    },
    "x-epistemic-boundary": {
      observations: "Visible, span-anchored language features",
      interpretations: "Defeasible model readings with assumptions and alternatives",
      excluded: ["truth verdict", "lie verdict", "belief verdict", "sincerity verdict", "intent verdict", "manipulation verdict", "mental-state verdict", "speaker score"],
      policy_scope: "Normative API boundary backed by schema, prompting, and a limited fail-closed lexical gate; not a semantic proof system.",
    },
    "x-production-readiness": {
      model_routes_require_deployment_abuse_controls: true,
      reference_repository_provides_auth_or_rate_limiting: false,
      discovery: "GET /v1/capabilities",
    },
  };
}
