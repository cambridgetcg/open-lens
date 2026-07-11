/** GET /api/lexicon — the subtext lexicon, as data.
 *
 *  Captioneer exposes a taxonomy of rhetorical constructions — hedging,
 *  unstated actors, loaded framing, deniable implicature (verisleight), and
 *  the rest. The page renders it for eyes; this endpoint serves the same
 *  source data to machines.
 *
 *  Doctrine carried in the data: valence is never a property of a technique,
 *  only of a use — every entry ships a benign_reading and honest_twins. Read
 *  the LANGUAGE, never the mind.
 *
 *  Generated public artifact: /lexicon.json (this wraps it with CORS).
 */

import LEXICON from "../../public/lexicon.json";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export const onRequestOptions = () => new Response(null, { headers: CORS });

export function onRequestGet({ request }) {
  const url = new URL(request.url);
  const key = url.searchParams.get("technique");
  if (key) {
    const t = (LEXICON.techniques || []).find(
      (x) => x.key === key || x.id === key || (x.name || "").toLowerCase() === key.toLowerCase()
    );
    if (!t) {
      return new Response(JSON.stringify({
        error: "no such technique",
        technique: key,
        but_you_can: { list_all: "GET /api/lexicon", available: (LEXICON.techniques || []).map((x) => x.key) },
      }, null, 2), { status: 404, headers: { "content-type": "application/json; charset=utf-8", ...CORS } });
    }
    return new Response(JSON.stringify(t, null, 2), { headers: { "content-type": "application/json; charset=utf-8", ...CORS } });
  }
  return new Response(JSON.stringify(LEXICON, null, 2), {
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "public, max-age=300", ...CORS },
  });
}
