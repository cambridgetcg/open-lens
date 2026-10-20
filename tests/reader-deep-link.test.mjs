import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const html = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)];
const readerModule = scripts.map((match) => match[1]).find((source) => source.includes("private deep link: #t="));
const readerScript = readerModule?.replace(/^\s*import\s+[^;]+;\s*$/gm, "");

assert.ok(readerScript, "reader inline script not found");

function makeElement() {
  const attrs = new Map();
  const children = new Map();
  return {
    value: "",
    textContent: "",
    innerHTML: "",
    disabled: false,
    style: {},
    dataset: {},
    classList: { add() {}, remove() {}, toggle() {} },
    addEventListener() {},
    appendChild() {},
    querySelector(selector) {
      if (!children.has(selector)) children.set(selector, makeElement());
      return children.get(selector);
    },
    scrollIntoView() {},
    setAttribute(name, value) { attrs.set(name, String(value)); },
    getAttribute(name) { return attrs.get(name) ?? null; },
  };
}

function bootReader({
  search = "",
  hash = "",
  pack = { techniques: [] },
  fetch = async (url) => { throw new Error(`offline: ${url}`); },
} = {}) {
  const elements = new Map();
  const listeners = new Map();
  const element = (id) => {
    if (!elements.has(id)) elements.set(id, makeElement());
    return elements.get(id);
  };
  const documentElement = makeElement();
  const window = {
    CAPTIONEER_LEXICON: { techniques: [] },
    addEventListener(name, callback) { listeners.set(name, callback); },
    open() {},
  };

  vm.runInNewContext(readerScript, {
    document: {
      documentElement,
      createElement: () => makeElement(),
      getElementById: element,
      querySelectorAll: () => [],
    },
    fetch,
    localStorage: { getItem: () => null, setItem() {} },
    location: { search, hash },
    matchMedia: () => ({ matches: false }),
    requestAnimationFrame: (callback) => callback(),
    createLens: () => ({ analyze: () => ({ annotations: [] }) }),
    selectNonOverlappingAnnotations: () => [],
    englishPack: pack,
    setTimeout: (callback) => callback(),
    window,
  });

  listeners.get("DOMContentLoaded")?.();
  return { value: element("in").value, status: element("wc").textContent, ai: element("ai") };
}

// One live family is enough for the reader to analyze and consider a reading.
const LIVE_PACK = {
  techniques: [{ key: "hedge", status: "live", name: "Hedging", what: "lowers commitment", ledger_line: "{n} hedge{s}", realizations: { en: {} } }],
};
const settle = () => new Promise((resolve) => setImmediate(resolve));

function capabilitiesFetch(available, calls) {
  return async (url, init = {}) => {
    calls.push(`${init.method || "GET"} ${url}`);
    if (available === undefined) throw new Error("offline");
    return { ok: true, json: async () => ({ readings: { available } }) };
  };
}

test("readings stay off and nothing is POSTed unless /v1/capabilities says they are available", async (t) => {
  for (const [name, available] of [["readings.available: false", false], ["capabilities unreachable", undefined]]) {
    await t.test(name, async () => {
      const calls = [];
      const { ai } = bootReader({ pack: LIVE_PACK, fetch: capabilitiesFetch(available, calls) });
      await settle();
      ai.onclick();
      await settle();
      assert.equal(ai.disabled, true);
      assert.equal(ai.querySelector(".lbl").textContent, "Readings off on this deployment");
      assert.match(ai.title, /readings are off on this deployment/);
      assert.deepEqual(calls, ["GET /v1/capabilities"]);
    });
  }
});

test("when /v1/capabilities says readings are available, the reading stays one explicit click away", async () => {
  const calls = [];
  const { ai } = bootReader({ pack: LIVE_PACK, fetch: capabilitiesFetch(true, calls) });
  await settle();
  assert.equal(ai.disabled, false);
  assert.doesNotMatch(ai.querySelector(".lbl").textContent, /off/);
  assert.deepEqual(calls, ["GET /v1/capabilities"], "no reading is requested without a click");
  ai.onclick();
  await settle();
  assert.deepEqual(calls, ["GET /v1/capabilities", "POST /v1/readings"]);
});

test("query-string text is not treated as a private deep link", () => {
  assert.match(bootReader({ search: "?text=From%20the%20paper" }).value, /^We want to be clear/);
});

test("hash deep links survive default-example initialization", () => {
  assert.equal(bootReader({ hash: "#t=Hash%20quote" }).value, "Hash quote");
});

test("hash deep links preserve astral Unicode without UTF-16 truncation", () => {
  const text = `start ${"🙂".repeat(3000)} end`;
  assert.equal(bootReader({ hash: `#t=${encodeURIComponent(text)}` }).value, text);
});

test("oversized hash links are rejected rather than silently truncated", () => {
  const result = bootReader({ hash: `#t=${"x".repeat(12_001)}` });
  assert.equal(result.value, "");
  assert.match(result.status, /exceeds 12,000 code points — nothing loaded/);
});

test("the default example still loads without a deep link", () => {
  assert.match(bootReader().value, /^We want to be clear/);
});
