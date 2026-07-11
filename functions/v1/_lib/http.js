import { MAX_JSON_BYTES } from "./versions.js";

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,POST,OPTIONS",
  "access-control-allow-headers": "Content-Type,X-Request-ID",
  "access-control-expose-headers": "X-Request-ID",
};

const RESPONSE_HEADERS = {
  ...CORS,
  "cache-control": "no-store, max-age=0",
  pragma: "no-cache",
  "x-content-type-options": "nosniff",
};

export class ApiProblem extends Error {
  constructor(status, code, title, detail, extensions = {}) {
    super(detail || title);
    this.name = "ApiProblem";
    this.status = status;
    this.code = code;
    this.title = title;
    this.detail = detail || title;
    this.extensions = extensions;
  }
}

function randomId() {
  const uuid = globalThis.crypto?.randomUUID?.();
  if (uuid) return uuid.replaceAll("-", "");
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
}

export function requestIdFor(request) {
  const supplied = request?.headers?.get("x-request-id")?.trim();
  if (supplied && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(supplied)) {
    return supplied;
  }
  return `req_${randomId()}`;
}

export function artifactId(prefix) {
  return `${prefix}_${randomId()}`;
}

export function jsonResponse(body, { status = 200, requestId, headers = {} } = {}) {
  const responseHeaders = new Headers({
    ...RESPONSE_HEADERS,
    "content-type": "application/json; charset=utf-8",
    ...headers,
  });
  if (requestId) responseHeaders.set("x-request-id", requestId);
  return new Response(JSON.stringify(body), { status, headers: responseHeaders });
}

export function problemResponse(problem, requestId) {
  const known = problem instanceof ApiProblem;
  const status = known ? problem.status : 500;
  const code = known ? problem.code : "internal_error";
  const title = known ? problem.title : "Internal server error";
  const detail = known
    ? problem.detail
    : "The request could not be completed.";
  const extensions = known ? problem.extensions : {};

  return jsonResponse({
    type: `https://captioneer.io/problems/${code}`,
    title,
    status,
    detail,
    code,
    request_id: requestId,
    ...extensions,
  }, {
    status,
    requestId,
    headers: { "content-type": "application/problem+json; charset=utf-8" },
  });
}

export function optionsResponse(request) {
  const requestId = requestIdFor(request);
  return new Response(null, {
    status: 204,
    headers: { ...RESPONSE_HEADERS, "x-request-id": requestId },
  });
}

export function methodNotAllowed(context, allowed) {
  const requestId = requestIdFor(context.request);
  const response = problemResponse(new ApiProblem(
    405,
    "method_not_allowed",
    "Method not allowed",
    `Use ${allowed.join(" or ")} for this endpoint.`,
    { allowed_methods: allowed },
  ), requestId);
  response.headers.set("allow", allowed.join(", "));
  return response;
}

export async function handleApi(context, work) {
  const requestId = requestIdFor(context.request);
  try {
    const result = await work({ ...context, requestId });
    if (result instanceof Response) return result;
    // Only an explicit {body, status?} envelope controls transport status.
    // Domain objects (for example a technique with status: "live") remain data.
    const enveloped = result && typeof result === "object"
      && Object.prototype.hasOwnProperty.call(result, "body");
    const status = enveloped ? (result.status ?? 200) : 200;
    const body = enveloped ? result.body : result;
    return jsonResponse(body, { status, requestId });
  } catch (error) {
    return problemResponse(error, requestId);
  }
}

export async function readJson(request) {
  const contentType = request.headers.get("content-type");
  if (contentType && !contentType.toLowerCase().includes("application/json")) {
    throw new ApiProblem(
      415,
      "unsupported_media_type",
      "Unsupported media type",
      "Send the request body as application/json.",
    );
  }

  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_JSON_BYTES) {
    throw new ApiProblem(
      413,
      "request_body_too_large",
      "Request body too large",
      `JSON request bodies are limited to ${MAX_JSON_BYTES} bytes.`,
      { max_json_bytes: MAX_JSON_BYTES },
    );
  }

  const raw = await request.text();
  const actualLength = new TextEncoder().encode(raw).byteLength;
  if (actualLength > MAX_JSON_BYTES) {
    throw new ApiProblem(
      413,
      "request_body_too_large",
      "Request body too large",
      `JSON request bodies are limited to ${MAX_JSON_BYTES} bytes.`,
      { max_json_bytes: MAX_JSON_BYTES },
    );
  }

  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    throw new ApiProblem(
      400,
      "invalid_json",
      "Invalid JSON",
      "Send one valid JSON object.",
    );
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new ApiProblem(
      400,
      "invalid_request",
      "Invalid request",
      "The JSON body must be an object.",
    );
  }
  return body;
}
