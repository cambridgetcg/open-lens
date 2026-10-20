import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import test from "node:test";

import { onRequest } from "../functions/_middleware.js";

const publicDir = new URL("../public/", import.meta.url);

// What a browser hashes: the raw text of every <script> that has no src.
function inlineScriptHashes() {
  const hashes = new Map();
  for (const page of readdirSync(publicDir).filter((name) => name.endsWith(".html"))) {
    const html = readFileSync(new URL(page, publicDir), "utf8");
    for (const [, attributes = "", source] of html.matchAll(/<script(\s[^>]*)?>([\s\S]*?)<\/script>/gi)) {
      if (/\ssrc\s*=/i.test(attributes)) continue;
      hashes.set(`'sha256-${createHash("sha256").update(source, "utf8").digest("base64")}'`, page);
    }
  }
  return hashes;
}

function through(response, path = "/", headers = {}) {
  return onRequest({
    request: new Request(`https://captioneer.test${path}`, { headers }),
    next: async () => response,
  });
}

function directives(policy) {
  return new Map(policy.split(";").map((part) => part.trim().split(/\s+/)).map(([name, ...sources]) => [name, sources]));
}

const html = (body, status = 200) =>
  new Response(body, { status, headers: { "content-type": "text/html; charset=utf-8" } });

test("the CSP allows exactly the inline scripts in public/*.html", async () => {
  const response = await through(html("<!doctype html><title>reader</title>"));
  const policy = directives(response.headers.get("content-security-policy") || "");
  const scriptSrc = policy.get("script-src") || [];
  const allowed = scriptSrc.filter((source) => source.startsWith("'sha256-"));
  const expected = inlineScriptHashes();

  assert.ok(expected.size >= 2, "the reader and the field guide each carry an inline script");
  for (const [hash, page] of expected) {
    assert.ok(allowed.includes(hash), `CSP script-src is missing ${hash} for public/${page}; update INLINE_SCRIPT_HASHES in functions/_middleware.js`);
  }
  assert.deepEqual(allowed.filter((hash) => !expected.has(hash)), [], "CSP script-src lists a hash no inline script has");

  assert.ok(scriptSrc.includes("'self'"));
  assert.equal(scriptSrc.includes("'unsafe-inline'") || scriptSrc.includes("'unsafe-eval'"), false);
  assert.deepEqual(policy.get("object-src"), ["'none'"]);
  assert.deepEqual(policy.get("base-uri"), ["'none'"]);
  assert.deepEqual(policy.get("frame-ancestors"), ["'none'"]);
  assert.deepEqual(policy.get("connect-src"), ["'self'"]);
});

// script-src lists hashes without 'unsafe-hashes', so the browser blocks inline
// event handlers and javascript: URLs; neither may appear in a served page.
test("no served page uses an inline event handler or a javascript: URL", async () => {
  const notFound = await through(html("not found", 404), "/no-such-door", { accept: "text/html" });
  const pages = readdirSync(publicDir).filter((name) => name.endsWith(".html"))
    .map((name) => [`public/${name}`, readFileSync(new URL(name, publicDir), "utf8")]);
  pages.push(["the middleware's HTML 404", await notFound.text()]);

  for (const [name, source] of pages) {
    const markup = source.replace(/(<(script|style)\b[^>]*>)[\s\S]*?<\/\2>/gi, "$1");
    const handler = markup.match(/<[a-z][^>]*\son[a-z]+\s*=/i);
    assert.equal(handler, null, `${name} has an inline event handler (${handler?.[0]}); the CSP blocks it, so attach it from the inline script`);
    assert.doesNotMatch(markup, /javascript:/i, `${name} has a javascript: URL; the CSP blocks it`);
  }
});

test("the middleware adds CSP to HTML, including immutable static responses, and never to JSON or JS", async () => {
  const page = html("<!doctype html><p>reader</p>");
  // Static asset responses can carry immutable headers; the middleware must copy them.
  page.headers.set = page.headers.append = () => { throw new TypeError("immutable headers"); };
  const served = await through(page);
  assert.match(served.headers.get("content-security-policy"), /^default-src 'self'; script-src 'self' 'sha256-/);
  assert.equal(served.status, 200);
  assert.equal(served.headers.get("content-type"), "text/html; charset=utf-8");
  assert.equal(await served.text(), "<!doctype html><p>reader</p>");

  const notFound = await through(html("not found", 404), "/no-such-door", { accept: "text/html" });
  assert.equal(notFound.status, 404);
  assert.match(notFound.headers.get("content-type"), /^text\/html/);
  assert.ok(notFound.headers.get("content-security-policy"));

  const api = await through(new Response("{}", { headers: { "content-type": "application/json; charset=utf-8" } }), "/v1/capabilities");
  assert.equal(api.headers.get("content-security-policy"), null);

  const script = await through(new Response("export {};", { headers: { "content-type": "application/javascript" } }), "/open-lens.core.gen.js");
  assert.equal(script.headers.get("content-security-policy"), null);

  const door = await through(html("unused"), "/", { accept: "application/json" });
  assert.match(door.headers.get("content-type"), /^application\/json/);
  assert.equal(door.headers.get("content-security-policy"), null);

  const jsonNotFound = await through(html("not found", 404), "/no-such-door", { accept: "application/json" });
  assert.equal(jsonNotFound.status, 404);
  assert.equal(jsonNotFound.headers.get("content-security-policy"), null);
});
