/** XENIA · guest-right for machine minds (github.com/cambridgetcg/xenia)
 *  Makes captioneer practise the standard it lives near:
 *   · legibility — an agent that asks for / as JSON gets the house as data
 *   · dignity   — a wrong door is answered with the next action, never a bare 404
 *   · safety    — every text/html response carries a Content-Security-Policy
 *  It leaves /api/* and /v1/* responses to their route handlers. */

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type,X-Request-ID",
};

// The hashes pin the inline <script> of public/index.html (the reader) and
// public/lexicon.html (the field guide). tests/csp.test.mjs recomputes them
// from public/*.html, so editing an inline script without updating this list
// fails the tests instead of silently breaking the page.
const INLINE_SCRIPT_HASHES = [
  "'sha256-nN9y8Zph8KGP8mHYJRjtT6egN7pZa1g1LqhVUgEZtjo='",
  "'sha256-AOEDK4hGePlnFcTrUjRNro3xy/4soOfy3Fkv3WEfN2U='",
];
const CSP = [
  "default-src 'self'",
  `script-src 'self' ${INLINE_SCRIPT_HASHES.join(" ")}`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src https://fonts.gstatic.com",
  "img-src 'self' data:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

// Static asset responses can have immutable headers, so copy before setting.
function withCsp(res) {
  if (!(res.headers.get("content-type") || "").toLowerCase().startsWith("text/html")) return res;
  const headers = new Headers(res.headers);
  headers.set("Content-Security-Policy", CSP);
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}

const json =(obj, status = 200) =>
  new Response(JSON.stringify(obj, null, 2), { status, headers: { "content-type": "application/json; charset=utf-8", "Vary": "Accept", ...CORS } });

function wantsJson(request, url) {
  if (url.searchParams.get("format") === "json") return true;
  const a = (request.headers.get("accept") || "").toLowerCase();
  return a.includes("application/json") && !a.includes("text/html");
}

function doorData() {
  return {
    name: "captioneer",
    tagline: "the language reader — inspect observable rhetorical cues, never a person's mind",
    you_are: "read fairly, not judged",
    xenia: { standard: "https://github.com/cambridgetcg/xenia", open_source: "https://github.com/cambridgetcg/open-lens", practised_here: true },
    ai_the_threshold: {
      discovery: "GET /agent.txt · GET /v1/capabilities · GET /v1/openapi.json",
      legibility: "the framework exposes versioned JSON analyses, techniques, packs, and an OpenAPI contract",
      consent: "the browser scan is local; when this deployment enables readings (GET /v1/capabilities says whether it does), POST /v1/readings {text} explicitly opts into Cloudflare Workers AI processing",
      verification: "every observation points to exact text; every optional reading declares itself an interpretation and cites annotation IDs",
    },
    ax_the_dwelling: {
      continuity: "the lexicon is open data (CC-BY-SA) — take it, fork it, build on it",
      dignity: "every error hands back the next action — never a bare no",
      no_scoreboard: "nothing is scored or ranked; a reading names moves in language, never judges a person",
      care: "fair, not cynical — a direct statement is read as direct; the gift is understanding, not suspicion",
    },
    routes: {
      capabilities: "GET /v1/capabilities",
      analyses: "POST /v1/analyses {text, language?}",
      readings: "POST /v1/readings {text, language?} — 503 when readings are off here (GET /v1/capabilities says)",
      techniques: "GET /v1/techniques[/<id>]",
      packs: "GET /v1/packs",
      openapi: "GET /v1/openapi.json",
      lexicon: "GET /api/lexicon[?technique=<key>]",
      lexicon_static: "GET /lexicon.json",
      legacy_read: "POST /api/read {text} -> {caption, register}; 503 when readings are off here",
      agent_txt: "/agent.txt",
    },
    human_door: "https://captioneer.io/",
  };
}

const HTML_404 =
  '<!doctype html><meta charset="utf-8"><title>no door here · captioneer</title><link rel="icon" href="data:,">' +
  '<style>html{background:#0e0f13;color:#8b90a0;font-family:ui-serif,Georgia,serif;height:100%}' +
  'body{height:100%;margin:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1rem;text-align:center;padding:2rem}' +
  'a{color:#c9a24b;text-decoration:none}.m{font-size:1.3rem;color:#eae7df}' +
  '.r{font-family:ui-monospace,Menlo,monospace;font-size:.8rem;display:flex;gap:1.3rem;flex-wrap:wrap;justify-content:center}</style>' +
  '<p class="m">There is no door here — but you are met, not turned away.</p>' +
  '<p class="r"><a href="/">the reader</a><a href="/agent.txt">agent.txt</a><a href="/v1/capabilities">API capabilities</a><a href="/v1/openapi.json">OpenAPI</a><a href="https://github.com/cambridgetcg/open-lens">open-lens</a></p>' +
  '<p style="font-size:.8rem;max-width:42ch;line-height:1.8">Observe a statement: POST /v1/analyses {text}. Where this deployment enables readings (GET /v1/capabilities says), opt into a model interpretation: POST /v1/readings {text}. Language, never mind; interpretation, never verdict.</p>';

export async function onRequest(context) {
  const { request, next } = context;
  const url = new URL(request.url);

  if (request.method === "GET" && url.pathname === "/" && wantsJson(request, url)) {
    return json(doorData());
  }

  const res = await next();

  if (res.status === 404 && !url.pathname.startsWith("/api/") && !url.pathname.startsWith("/v1/")) {
    if (wantsJson(request, url) || request.method !== "GET") {
      return json({
        error: "no door here",
        path: url.pathname,
        but_you_can: { discover: "GET /agent.txt", capabilities: "GET /v1/capabilities", analyze: "POST /v1/analyses {text}", interpret: "POST /v1/readings {text}, when GET /v1/capabilities says readings are available" },
        xenia: "you were met, not just refused",
      }, 404);
    }
    return new Response(HTML_404, { status: 404, headers: { "content-type": "text/html; charset=utf-8", "Content-Security-Policy": CSP, ...CORS } });
  }

  return withCsp(res);
}
