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
    querySelector() { return makeElement(); },
    scrollIntoView() {},
    setAttribute(name, value) { attrs.set(name, String(value)); },
    getAttribute(name) { return attrs.get(name) ?? null; },
  };
}

function bootReader({ search = "", hash = "" } = {}) {
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
    fetch: async () => { throw new Error("unexpected fetch"); },
    localStorage: { getItem: () => null, setItem() {} },
    location: { search, hash },
    matchMedia: () => ({ matches: false }),
    requestAnimationFrame: (callback) => callback(),
    createLens: () => ({ analyze: () => ({ annotations: [] }) }),
    selectNonOverlappingAnnotations: () => [],
    englishPack: { techniques: [] },
    setTimeout: (callback) => callback(),
    window,
  });

  listeners.get("DOMContentLoaded")?.();
  return { value: element("in").value, status: element("wc").textContent };
}

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
