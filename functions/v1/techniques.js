import { listTechniques } from "./_lib/core-adapter.js";
import { handleApi, methodNotAllowed, optionsResponse } from "./_lib/http.js";
import { SCHEMA_VERSION } from "./_lib/versions.js";

export function onRequestOptions({ request }) {
  return optionsResponse(request);
}

export function onRequestGet(context) {
  return handleApi(context, ({ requestId }) => ({
    object: "list",
    schema_version: SCHEMA_VERSION,
    request_id: requestId,
    data: listTechniques(),
  }));
}

export function onRequestPost(context) {
  return methodNotAllowed(context, ["GET"]);
}
