import { analyzeDocument } from "./_lib/core-adapter.js";
import { handleApi, methodNotAllowed, optionsResponse, readJson } from "./_lib/http.js";
import { parseDocumentInput } from "./_lib/input.js";

export function onRequestOptions({ request }) {
  return optionsResponse(request);
}

export async function onRequestPost(context) {
  return handleApi(context, async ({ request, requestId }) => {
    const document = parseDocumentInput(await readJson(request));
    const analysis = await analyzeDocument(document);
    return { ...analysis, request_id: requestId };
  });
}

export function onRequestGet(context) {
  return methodNotAllowed(context, ["POST"]);
}
