// robots.txt on captioneer.io: a plain allow-all, nothing else
// (Quiet Doors, small door fixes, 2026-10). No Crawl-delay, no training signal.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { onRequest } from "../functions/_middleware.js";

const PLAIN = "User-agent: *\nAllow: /\n";
const file = new URL("../public/robots.txt", import.meta.url);

test("public/robots.txt is a plain allow-all", () => {
  assert.equal(readFileSync(file, "utf8"), PLAIN);
});

test("the middleware passes robots.txt through unchanged", async () => {
  const res = await onRequest({
    request: new Request("https://captioneer.test/robots.txt"),
    next: async () => new Response(readFileSync(file, "utf8"), { headers: { "content-type": "text/plain; charset=utf-8" } }),
  });
  assert.equal(res.status, 200);
  assert.match(res.headers.get("content-type"), /^text\/plain/);
  assert.equal(await res.text(), PLAIN);
});
