import { getTechnique } from "../_lib/core-adapter.js";
import { ApiProblem, handleApi, methodNotAllowed, optionsResponse } from "../_lib/http.js";
import { SCHEMA_VERSION } from "../_lib/versions.js";

export function onRequestOptions({ request }) {
  return optionsResponse(request);
}

export function onRequestGet(context) {
  return handleApi(context, ({ params, requestId }) => {
    const rawId = Array.isArray(params?.id) ? params.id[0] : params?.id;
    const technique = getTechnique(rawId || "");
    if (!technique) {
      throw new ApiProblem(
        404,
        "technique_not_found",
        "Technique not found",
        `No installed pack exposes technique ${rawId || "(missing)"}.`,
        { technique_id: rawId || null },
      );
    }
    return {
      object: "technique",
      schema_version: SCHEMA_VERSION,
      request_id: requestId,
      ...technique,
    };
  });
}

export function onRequestPost(context) {
  return methodNotAllowed(context, ["GET"]);
}
