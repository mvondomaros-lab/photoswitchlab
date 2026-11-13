"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

test("website static alternative follows presentation changes even when model loading finishes later", async () => {
  let simple = true, finish;
  const fallback = {hidden: false}, instruction = {hidden: true}, status = {hidden: false};
  const listeners = new Map(), stages = [];
  const figure = {querySelector: (selector) => selector === "[data-viewer-fallback]" ? fallback : instruction};
  const disclosure = {open: true, addEventListener() {}};
  const viewer = {dataset: {}, closest: (selector) => selector === "figure" ? figure : disclosure, querySelector: () => status};
  const context = vm.createContext({
    document: {currentScript: {src: "https://example.org/assets/structure-viewer.js?v=2"},
      body: {classList: {contains: () => simple}}, querySelectorAll: () => [viewer],
      addEventListener: (type, listener) => listeners.set(type, listener)},
    URL,
    NGL: {Stage: class {
      constructor() { this.resizes = 0; stages.push(this); }
      handleResize() { this.resizes++; }
      loadFile() { return new Promise((resolve) => { finish = resolve; }); }
    }},
    ResizeObserver: class { observe() {} }, requestAnimationFrame: (callback) => callback(), console,
  });
  vm.runInContext(fs.readFileSync("site/assets/structure-viewer.js", "utf8"), context);
  await new Promise(setImmediate);
  assert.equal(stages.length, 0); // An initially simplified page does not need WebGL.
  assert.equal(fallback.hidden, false);
  assert.equal(instruction.hidden, true);
  const change = (value) => { simple = value; listeners.get("photoswitchlab-presentation")(); };
  change(false);
  await new Promise(setImmediate);
  assert.equal(stages.length, 1);
  assert.equal(viewer.dataset.viewerState, "loading");
  change(true); // Switch while the structure file is still loading.
  finish({addRepresentation() {}, autoView() {}});
  await new Promise(setImmediate);
  assert.equal(viewer.dataset.viewerState, "ready");
  assert.equal(fallback.hidden, false);
  assert.equal(instruction.hidden, true);
  const resizes = stages[0].resizes;
  change(false);
  assert.equal(stages.length, 1); // Returning reuses the initialized model.
  assert.ok(stages[0].resizes > resizes);
  assert.equal(fallback.hidden, true);
  assert.equal(instruction.hidden, false);
  change(true);
  assert.equal(fallback.hidden, false);
  assert.equal(instruction.hidden, true);
});
