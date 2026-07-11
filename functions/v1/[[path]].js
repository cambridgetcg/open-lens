import { ApiProblem, methodNotAllowed, optionsResponse, problemResponse, requestIdFor } from "./_lib/http.js";

const KNOWN_METHODS = new Map([
  ["/v1/analyses", ["POST"]],
  ["/v1/readings", ["POST"]],
  ["/v1/capabilities", ["GET"]],
  ["/v1/packs", ["GET"]],
  ["/v1/techniques", ["GET"]],
  ["/v1/openapi.json", ["GET"]],
]);

export function onRequest(context) {
  const { request } = context;
  if (request.method === "OPTIONS") return optionsResponse(request);

  const url = new URL(request.url);
  const isTechniqueDetail = /^\/v1\/techniques\/[^/]+$/.test(url.pathname);
  const allowed = KNOWN_METHODS.get(url.pathname) || (isTechniqueDetail ? ["GET"] : null);
  const requestId = requestIdFor(request);

  if (allowed) return methodNotAllowed(context, allowed);

  return problemResponse(new ApiProblem(
    404,
    "endpoint_not_found",
    "Endpoint not found",
    `No ${request.method} endpoint exists at ${url.pathname}.`,
    {
      discovery: "GET /v1/capabilities",
      openapi: "GET /v1/openapi.json",
    },
  ), requestId);
}
