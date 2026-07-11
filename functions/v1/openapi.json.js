import { handleApi, methodNotAllowed, optionsResponse } from "./_lib/http.js";
import { openApiDocument } from "./_lib/openapi.js";

export function onRequestOptions({ request }) {
  return optionsResponse(request);
}

export function onRequestGet(context) {
  return handleApi(context, () => openApiDocument());
}

export function onRequestPost(context) {
  return methodNotAllowed(context, ["GET"]);
}
