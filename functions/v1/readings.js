import { analyzeDocument } from "./_lib/core-adapter.js";
import { handleApi, methodNotAllowed, optionsResponse, readJson } from "./_lib/http.js";
import { parseDocumentInput } from "./_lib/input.js";
import { generateReading } from "./_lib/readings.js";

export function onRequestOptions({ request }) {
  return optionsResponse(request);
}

export async function onRequestPost(context) {
  return handleApi(context, async ({ request, env, requestId }) => {
    // Calling this dedicated endpoint is the opt-in boundary. Deterministic
    // analysis happens first so every returned basis ID can be dereferenced.
    const document = parseDocumentInput(await readJson(request));
    const analysis = await analyzeDocument(document);
    const reading = await generateReading({ env, ...document, analysis });
    return {
      ...reading,
      request_id: requestId,
      analysis: { ...analysis, request_id: requestId },
    };
  });
}

export function onRequestGet(context) {
  return methodNotAllowed(context, ["POST"]);
}
