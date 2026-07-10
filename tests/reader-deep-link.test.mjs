import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const html = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)];
const readerScript = scripts.map((match) => match[1]).find((source) => source.includes("deep link: ?text="));

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
    URLSearchParams,
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
    setTimeout: (callback) => callback(),
    window,
  });

  listeners.get("DOMContentLoaded")?.();
  return element("in").value;
}

test("query-string deep links survive default-example initialization", () => {
  assert.equal(bootReader({ search: "?text=From%20the%20paper" }), "From the paper");
});

test("hash deep links survive default-example initialization", () => {
  assert.equal(bootReader({ hash: "#t=Hash%20quote" }), "Hash quote");
});

test("the default example still loads without a deep link", () => {
  assert.match(bootReader(), /^We want to be clear/);
});
