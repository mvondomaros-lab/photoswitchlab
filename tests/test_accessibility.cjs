"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
require("../src/photoswitchlab/web/static/accessibility.js");
const data = globalThis.AccessibleData;

test("XYZ atom order and pm measurements remain consistent across selected geometries", () => {
  const positions = data.coordinates("3\nexample\nC 0 0 0\nN 1 0 0\nN 1 2 0\n");
  assert.deepEqual(positions, [0, 0, 0, 1, 0, 0, 1, 2, 0]);
  assert.equal(data.distance(positions, 0, 1), 100);
  assert.equal(data.distance(positions, 1, 2), 200);
  assert.equal(data.angle(positions, 0, 1, 2), 90);
  assert.equal(data.angle(positions, 0, 0, 2), null);
  assert.equal(data.distance(positions, 0, 3), null);
});
test("absorption interpolation uses broadened curve data and never extrapolates", () => {
  const spectrum = { energy_ev: [1, 2, 3], absorption: [0, 8, 2], oscillator_strengths: [0.3] };
  assert.equal(data.absorption(spectrum, 1), 0);
  assert.equal(data.absorption(spectrum, 2), 8);
  assert.equal(data.absorption(spectrum, 3), 2);
  assert.equal(data.absorption(spectrum, 2.5), 5);
  assert.equal(data.absorption(spectrum, 0.9), null);
  assert.equal(data.absorption(spectrum, NaN), null);
});
test("approximate color words distinguish achromatic, dark and selective colors", () => {
  assert.equal(data.color([255, 255, 255]), "annähernd weiß");
  assert.equal(data.color([15, 15, 15]), "annähernd schwarz");
  assert.equal(data.color([250, 250, 0]), "gelb");
  assert.equal(data.color([0, 0, 100]), "dunkel, blau");
});
test("CSV preserves machine-readable decimals and quotes cells correctly", () => {
  assert.equal(data.csv([["structure", "energy_ev"], ['a,"b"', -1.25], ["line\n2", null]]),
    'structure,energy_ev\r\n"a,""b""",-1.25\r\n"line\n2",');
});
test("individual path frames can be selected without a WebGL component", () => {
  const app = fs.readFileSync("src/photoswitchlab/web/static/app.js", "utf8");
  const context = vm.createContext({
    state: { busy: false, selected: "m" }, component: null,
    playbackData: () => ({ kind: "path", frames: [[1, 0, 0]], records: [{ image: 0, energy_ev: -1 }] }),
    applyLiveGeometry() {}, renderEnergyHistory() {}, renderPlaybackControls() {},
  });
  vm.runInContext(app.slice(app.indexOf("function showFrame("), app.indexOf("function showResult(")), context);
  context.showFrame(0);
  assert.equal(context.state.previewIndex, 0);
  assert.equal(context.state.live.phase, "path");
  assert.equal(context.state.live.source_id, "m");
});
