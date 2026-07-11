import { ApiProblem } from "./http.js";
import { MAX_TEXT_CODE_POINTS } from "./versions.js";

const LANGUAGE_TAG = /^[A-Za-z]{2,8}(?:-[A-Za-z0-9]{1,8})*$/;

export function codePointLength(value) {
  return [...value].length;
}

export function parseDocumentInput(body, { maxCodePoints = MAX_TEXT_CODE_POINTS } = {}) {
  const unexpectedFields = Object.keys(body).filter((key) => key !== "text" && key !== "language");
  if (unexpectedFields.length) {
    throw new ApiProblem(
      422,
      "unknown_fields",
      "Unknown request fields",
      `Remove unsupported field${unexpectedFields.length === 1 ? "" : "s"}: ${unexpectedFields.join(", ")}.`,
      { fields: unexpectedFields },
    );
  }

  if (typeof body.text !== "string" || body.text.trim().length === 0) {
    throw new ApiProblem(
      422,
      "invalid_text",
      "Invalid text",
      "The text field must be a non-empty string.",
      { field: "text" },
    );
  }

  const length = codePointLength(body.text);
  if (length > maxCodePoints) {
    throw new ApiProblem(
      413,
      "text_too_large",
      "Text too large",
      `Text is limited to ${maxCodePoints} Unicode code points; no input was analyzed or truncated.`,
      { field: "text", max_code_points: maxCodePoints, received_code_points: length },
    );
  }

  const language = body.language ?? "en";
  if (typeof language !== "string" || !LANGUAGE_TAG.test(language)) {
    throw new ApiProblem(
      422,
      "invalid_language",
      "Invalid language tag",
      "language must be a BCP 47 language tag such as en or en-GB.",
      { field: "language" },
    );
  }
  if (language.split("-")[0].toLowerCase() !== "en") {
    throw new ApiProblem(
      422,
      "unsupported_language",
      "Unsupported language",
      `No installed pack supports ${language}.`,
      { field: "language", supported_languages: ["en"] },
    );
  }

  return { text: body.text, language };
}
