/** POST /api/read — the subtext reader.
 *
 *  The deterministic close-reader (in the page) shows the EVIDENCE — every
 *  hedge, deleted subject, and loaded term, as visible marks. This adds the
 *  READING: a Workers AI model writes the "truth caption" — the plain-meaning
 *  version of what's being said, plus one line on the emotional register.
 *
 *  Honesty is enforced in the prompt, not just the copy: the model is told it
 *  reads the LANGUAGE, never the mind — it may say what the words are doing,
 *  never whether the speaker is lying. It runs only when a human asks (the
 *  page's opt-in button), so cost is bounded to intent.
 */

const SYSTEM = `You are Captioneer's subtext reader. Given a statement, you write its "truth caption": the plain, direct version of what the words are actually saying, once the hedging, spin, and softening are stripped away.

Hard rules:
- Rewrite it in the speaker's OWN first-person voice ("I…", "we…"), plain and short — the same words said without the padding. One or two sentences, maximum. It's a subtitle, not an essay.
- You read the LANGUAGE, never the person's mind. Never claim to know whether they are lying — you only make the words plainer.
- Be fair, not cynical. If a statement is already direct and owns its point, keep the caption close to the original and say plainly that it's straight.
- The "register" is one short, vivid line naming the emotional tone AND what (if anything) is being avoided or performed — e.g. "rehearsed contrition, responsibility deleted".`;

const SCHEMA = {
  type: "object",
  properties: { caption: { type: "string" }, register: { type: "string" } },
  required: ["caption", "register"],
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

export async function onRequestPost(context) {
  const { request, env } = context;

  let text;
  try {
    ({ text } = await request.json());
  } catch {
    return json({ error: "Send { text }." }, 400);
  }
  if (typeof text !== "string" || text.trim().length < 3) {
    return json({ error: "Give me a sentence to read." }, 400);
  }
  // Cost + abuse guard: cap the input. Captions are for statements, not essays.
  text = text.slice(0, 2400);

  if (!env.AI) {
    return json({ error: "The subtext reader isn't wired on this deployment yet." }, 503);
  }

  try {
    const out = await env.AI.run("@cf/meta/llama-3.3-70b-instruct-fp8-fast", {
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: text },
      ],
      max_tokens: 320,
      temperature: 0.2,
      // Structured output → `response` comes back as a reliable object, not
      // free-form text that sometimes stringifies to "[object Object]".
      response_format: { type: "json_schema", json_schema: SCHEMA },
    });

    // The binding returns `response` either as a STRING (raw model text) or,
    // when the model emits JSON, as an already-parsed OBJECT. Handle both and
    // always degrade to something honest rather than throwing.
    const r = out ? out.response : undefined;
    let p = null, caption = "", register = "";
    if (r && typeof r === "object") {
      p = r; // structured output straight from the model
    } else {
      const raw = String(r ?? "").trim();
      const m = raw.match(/\{[\s\S]*\}/);
      if (m) { try { p = JSON.parse(m[0]); } catch { /* not JSON */ } }
      if (!p && raw) caption = raw; // prose-only reply — use it verbatim
    }
    if (p) {
      if (typeof p.caption === "string") caption = p.caption.trim();
      if (typeof p.register === "string") register = p.register.trim();
    }
    if (caption === "[object Object]") caption = ""; // never surface a mangled object
    if (!caption) return json({ error: "The reader came back empty. Try again." }, 502);

    return json({ caption, register });
  } catch (e) {
    return json({ error: "The reader couldn't finish — the model may be busy. Try again in a moment." }, 502);
  }
}
