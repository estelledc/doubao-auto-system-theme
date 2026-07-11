import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const SOURCE = readFileSync(new URL("../assets/showcase.js", import.meta.url), "utf8");

function bootDemo({ audited }) {
  const handlers = new Map();
  const badges = Array.from({ length: 5 }, () => ({
    dataset: { status: "pass" },
    textContent: "PASS",
  }));
  const panel = { dataset: { demoTheme: "dark", audited: String(audited) } };
  const toggle = {
    attributes: {},
    textContent: "Dark signal",
    addEventListener(type, handler) { handlers.set(type, handler); },
    setAttribute(name, value) { this.attributes[name] = value; },
  };
  const auditStatus = { dataset: { status: "pass" }, textContent: "PASS · SAMPLE DOM ONLY" };
  const auditResults = {
    querySelectorAll(selector) {
      assert.equal(selector, "[data-status]");
      return badges;
    },
  };
  const selectors = new Map([
    ["[data-demo-theme]", panel],
    ["[data-demo-toggle]", toggle],
    ["[data-run-audit]", null],
    ["[data-audit-root]", null],
    ["[data-audit-results]", auditResults],
    ["[data-audit-status]", auditStatus],
  ]);
  const document = {
    querySelector(selector) { return selectors.get(selector) ?? null; },
    createElement() { throw new Error("createElement is not expected before an audit run"); },
  };

  vm.runInNewContext(SOURCE, { document, window: {} }, { filename: "assets/showcase.js" });
  return { handler: handlers.get("click"), panel, toggle, auditStatus, badges };
}

test("theme toggle marks the overall result and every audit row STALE after a completed audit", () => {
  const demo = bootDemo({ audited: true });
  assert.equal(typeof demo.handler, "function");

  demo.handler();

  assert.equal(demo.panel.dataset.demoTheme, "light");
  assert.equal(demo.toggle.attributes["aria-pressed"], "false");
  assert.equal(demo.toggle.textContent, "Light signal");
  assert.deepEqual(demo.auditStatus, {
    dataset: { status: "unknown" },
    textContent: "STALE · RUN AGAIN",
  });
  for (const badge of demo.badges) {
    assert.deepEqual(badge, { dataset: { status: "unknown" }, textContent: "STALE" });
  }
});

test("theme toggle does not invent a stale audit before the first run", () => {
  const demo = bootDemo({ audited: false });

  demo.handler();

  assert.equal(demo.panel.dataset.demoTheme, "light");
  assert.equal(demo.auditStatus.textContent, "PASS · SAMPLE DOM ONLY");
  assert.ok(demo.badges.every((badge) => badge.textContent === "PASS"));
});
