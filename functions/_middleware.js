/** XENIA · guest-right for machine minds (github.com/cambridgetcg/xenia)
 *  Makes captioneer practise the standard it lives near:
 *   · legibility — an agent that asks for / as JSON gets the house as data
 *   · dignity   — a wrong door is answered with the next action, never a bare 404
 *  It leaves /api/* alone — those functions own their own responses. */

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};
const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj, null, 2), { status, headers: { "content-type": "application/json; charset=utf-8", "Vary": "Accept", ...CORS } });

function wantsJson(request, url) {
  if (url.searchParams.get("format") === "json") return true;
  const a = (request.headers.get("accept") || "").toLowerCase();
  return a.includes("application/json") && !a.includes("text/html");
}

function doorData() {
  return {
    name: "captioneer",
    tagline: "the subtext reader — name the move in the language, never the person",
    you_are: "read fairly, not judged",
    xenia: { standard: "https://github.com/cambridgetcg/xenia", open_source: "https://github.com/cambridgetcg/open-lens", practised_here: true },
    ai_the_threshold: {
      discovery: "GET /agent.txt · GET /api/lexicon",
      legibility: "the lexicon is JSON at /api/lexicon and /lexicon.json; Accept: application/json here for this house as data",
      consent: "no login — POST /api/read {text} to have a statement read",
      verification: "every technique ships a benign_reading and honest_twins; valence lives in the use, never the technique",
    },
    ax_the_dwelling: {
      continuity: "the lexicon is open data (CC-BY-SA) — take it, fork it, build on it",
      dignity: "every error hands back the next action — never a bare no",
      no_scoreboard: "nothing is scored or ranked; a reading names moves in language, never judges a person",
      care: "fair, not cynical — a direct statement is read as direct; the gift is understanding, not suspicion",
    },
    routes: {
      lexicon: "GET /api/lexicon[?technique=<key>]",
      lexicon_static: "GET /lexicon.json",
      read: "POST /api/read {text} -> {caption, register}",
      agent_txt: "/agent.txt",
    },
    human_door: "https://captioneer.io/",
  };
}

const HTML_404 =
  '<!doctype html><meta charset="utf-8"><title>no door here · captioneer</title>' +
  '<style>html{background:#0e0f13;color:#8b90a0;font-family:ui-serif,Georgia,serif;height:100%}' +
  'body{height:100%;margin:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1rem;text-align:center;padding:2rem}' +
  'a{color:#c9a24b;text-decoration:none}.m{font-size:1.3rem;color:#eae7df}' +
  '.r{font-family:ui-monospace,Menlo,monospace;font-size:.8rem;display:flex;gap:1.3rem;flex-wrap:wrap;justify-content:center}</style>' +
  '<p class="m">There is no door here — but you are met, not turned away.</p>' +
  '<p class="r"><a href="/">the reader</a><a href="/agent.txt">agent.txt</a><a href="/api/lexicon">the lexicon (as data)</a><a href="https://github.com/cambridgetcg/open-lens">open-lens</a></p>' +
  '<p style="font-size:.8rem;max-width:36ch;line-height:1.8">Read a statement: POST /api/read {text}. It names the move in the language, never the person.</p>';

export async function onRequest(context) {
  const { request, next } = context;
  const url = new URL(request.url);

  if (request.method === "GET" && url.pathname === "/" && wantsJson(request, url)) {
    return json(doorData());
  }

  const res = await next();

  if (res.status === 404 && !url.pathname.startsWith("/api/")) {
    if (wantsJson(request, url) || request.method !== "GET") {
      return json({
        error: "no door here",
        path: url.pathname,
        but_you_can: { discover: "GET /agent.txt", the_lexicon: "GET /api/lexicon", read_a_statement: "POST /api/read {text}" },
        xenia: "you were met, not just refused",
      }, 404);
    }
    return new Response(HTML_404, { status: 404, headers: { "content-type": "text/html; charset=utf-8", ...CORS } });
  }

  return res;
}
