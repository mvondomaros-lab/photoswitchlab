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
test("decimal input accepts German commas and dots without silently changing the value", () => {
  assert.equal(data.decimal("0,3"), 0.3);
  assert.equal(data.decimal("3,5"), 3.5);
  assert.equal(data.decimal("3.5"), 3.5);
  assert.equal(data.decimal(" 3,5 "), 3.5);
  for (const invalid of ["", "3,5,1", "3.5.1", "3,5.1", "3 5", "3e1", "NaN", "3,"]) assert.equal(data.decimal(invalid), null);
});
test("atom references carry chemical positions through substituent connectivity", () => {
  const graph = [
    {number: 1, element: "C", position: "C2′", neighbors: [{number: 2}]},
    {number: 2, element: "O", neighbors: [{number: 1}, {number: 3}]},
    {number: 3, element: "C", neighbors: [{number: 2}]},
  ];
  assert.equal(data.atomLabel(graph, 0), "Atom 1 (C, Ringposition C2′)");
  assert.equal(data.atomLabel(graph, 2), "Atom 3 (C, Ringbezug C2′)");
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

test("CIELAB display-color comparison has correct neutral anchors and is symmetric", () => {
  const white = data.lab([255, 255, 255]);
  assert.ok(Math.abs(white[0] - 100) < 0.001);
  assert.ok(Math.abs(white[1]) < 0.001 && Math.abs(white[2]) < 0.001);
  assert.deepEqual(data.lab([0, 0, 0]), [0, 0, 0]);
  assert.ok(Math.abs(data.colorDistance([255, 255, 255], [0, 0, 0]) - 100) < 0.001);
  assert.equal(data.colorDistance([255, 0, 0], [255, 0, 0]), 0);
  assert.equal(data.colorDistance([255, 0, 0], [0, 0, 255]), data.colorDistance([0, 0, 255], [255, 0, 0]));
  assert.equal(data.colorDistance(null, [0, 0, 0]), null);
});

function accessibleLab(search = "", deniedStorage = false) {
  let mutations = 0;
  const elements = new Map(), saved = new Map();
  function element() {
    let text = "";
    return {
      options: [], value: "", open: false, checked: false,
      get textContent() { return text; },
      set textContent(value) { text = value; mutations++; },
      replaceChildren(...children) { this.options = children; this.value = children[0]?.value ?? ""; mutations++; },
      append() {}, classList: { toggle() {} },
    };
  }
  const node = (id) => {
    if (!elements.has(id)) elements.set(id, element());
    return elements.get(id);
  };
  let exported;
  const context = vm.createContext({
    document: { getElementById: node, createElement: element, body: element() },
    Option: function(text, value) { return { text, value: String(value) }; },
    location: { search }, URLSearchParams,
    localStorage: {
      getItem(key) { if (deniedStorage) throw new Error("blocked"); return saved.get(key); },
      setItem(key, value) { if (deniedStorage) throw new Error("blocked"); saved.set(key, value); },
    },
    SolutionColor: { estimate: (spec) => spec?.color || null },
  });
  vm.runInContext(fs.readFileSync("src/photoswitchlab/web/static/progress.js", "utf8"), context);
  vm.runInContext(fs.readFileSync("src/photoswitchlab/web/static/accessibility.js", "utf8"), context);
  const molecule = { id: "a", kind: "minimum", name: 'A <script>alert("x")</script>', formula: "C12H10N2", atom_count: 3,
    xyz: "3\nexample\nC 0 0 0\nN 1 0 0\nN 1 2 0", properties: {energy_ev: -10, dihedral_deg: 180, ring_distance_pm: 400},
    atom_graph: [1, 2, 3].map((number) => ({ number, element: "C", position: `C${number}`, neighbors: [] })),
    spectrum: {energy_ev: [1, 2], absorption: [0.1, 0.5], excitations_ev: [1.5], oscillator_strengths: [0.2], color: {rgb: [255, 255, 0], luminance: 0.5}},
  };
  const state = { step: "spectrum", molecules: [molecule, {...molecule, id: "b", name: "B"}] };
  const view = context.AccessibilityView;
  view.initialize({ state, current: () => molecule, records: () => [], playback: () => ({records: []}),
    render: () => view.render(), showResult: () => {}, selectFrame: () => {}, label: (m) => m.name,
    substituentLabel: (s) => s, filename: (extension) => `result.${extension}`,
    download: (content, filename) => { exported = {content, filename}; },
  });
  return { view, node, saved, molecule, state, context, mutations: () => mutations, exported: () => exported };
}

test("explicit text preference persists and turning it off restores graphical-first disclosure", () => {
  const lab = accessibleLab("?text=1");
  assert.equal(lab.saved.get("photoswitchlab.textPreferred"), "true");
  assert.equal(lab.node("accessible-results").open, true);
  lab.node("text-preference").checked = false;
  lab.node("text-preference").onchange();
  assert.equal(lab.node("accessible-results").open, false);
  const denied = accessibleLab("?text=0", true);
  assert.equal(denied.view.prefersText, false);
});

test("identical result renders cause no text mutations or live announcements", () => {
  const lab = accessibleLab();
  lab.view.render();
  const previous = lab.mutations();
  lab.view.render();
  lab.view.render();
  assert.equal(lab.mutations(), previous);
  assert.equal(lab.node("accessible-status").textContent, "");
});

test("readable report escapes data and includes chosen information without full curve dumps", () => {
  const lab = accessibleLab();
  lab.view.render();
  lab.node("curve-energy").value = "1,5";
  lab.node("curve-query").onclick();
  lab.node("color-comparison").value = "b";
  lab.node("color-comparison").onchange();
  lab.node("data-report").onclick();
  const output = lab.exported();
  assert.equal(output.filename, "result.html");
  assert.ok(output.content.includes('lang="de"'));
  assert.ok(output.content.includes("&lt;script&gt;"));
  assert.ok(!output.content.includes("<script>"));
  assert.ok(output.content.includes("Aktuelle Auswahl"));
  assert.ok(output.content.includes("1,5000 eV"));
  assert.ok(output.content.includes("CIE76-Farbabstand"));
  assert.ok(output.content.includes("feste Absorbanzskalierung"));
  assert.ok(!output.content.includes("Vollständige Übergangstabelle"));
});

test("invalid and out-of-range curve input remain distinct", () => {
  const lab = accessibleLab();
  lab.view.render();
  lab.node("curve-energy").value = "0,3";
  lab.node("curve-query").onclick();
  assert.ok(lab.node("curve-value").textContent.includes("zwischen 1,0000 und 2,0000"));
  lab.node("curve-energy").value = "1,5.1";
  lab.node("curve-query").onclick();
  assert.ok(lab.node("curve-value").textContent.includes("Dezimalkomma oder Dezimalpunkt"));
});

test("explicit observation collection retains several named probes and geometries without collecting every selection", () => {
  const lab = accessibleLab();
  lab.view.render();
  lab.node("atom-explorer").open = true;
  const initialCount = lab.node("observations-summary").textContent;
  lab.node("curve-energy").value = "1,2";
  lab.node("curve-query").onclick();
  assert.equal(lab.node("observations-summary").textContent, initialCount); // No automatic capture.
  lab.node("remember-observation").onclick();
  lab.node("curve-energy").value = "1,8";
  lab.node("curve-query").onclick();
  lab.node("remember-observation").onclick();
  lab.node("remember-observation").onclick(); // Duplicate capture is harmless.
  assert.equal(lab.node("observations-summary").textContent, "Gemerkte Beobachtungen (2)");
  lab.state.step = "optimize";
  lab.molecule.ts_search = {path: [
    {image: 0, energy_ev: -10, positions: [0, 0, 0, 1, 0, 0, 1, 2, 0]},
    {image: 1, energy_ev: -9, positions: [0, 0, 0, 2, 0, 0, 2, 2, 0]},
  ]};
  lab.view.render();
  for (const index of ["0", "1"]) {
    lab.node("path-point").value = index;
    lab.node("path-point").onchange();
    lab.node("remember-observation").onclick();
  }
  lab.node("data-report").onclick();
  const report = lab.exported().content;
  for (const text of ["1,2000 eV", "1,8000 eV", "Pfadstruktur 1", "Pfadstruktur 2", "Ringposition C1", "100,0 pm", "200,0 pm"]) assert.ok(report.includes(text), text);
  assert.equal((report.match(/<h2>Beobachtung /g) || []).length, 4);
  lab.node("clear-observations").onclick();
  lab.node("data-report").onclick();
  assert.ok(!lab.exported().content.includes("Beobachtung 1"));
});

test("calculation focus follows completion only while the user has not moved", async () => {
  for (const move of [false, true]) {
    const nodes = new Map(), listeners = new Set();
    const document = {body: {}, addEventListener: (_type, fn) => listeners.add(fn), removeEventListener: (_type, fn) => listeners.delete(fn)};
    const node = (id) => {
      if (!nodes.has(id)) nodes.set(id, {id, focus() { document.activeElement = this; listeners.forEach((fn) => fn({target: this})); }});
      return nodes.get(id);
    };
    document.activeElement = node("create");
    let finish;
    const finished = new Promise((resolve) => { finish = resolve; });
    const context = vm.createContext({document, $: node, state: {busy: false}, current: () => null,
      error() {}, stopAnimation() {}, updateControls() { if (context.state.busy) document.activeElement = document.body; },
      api: async () => ({id: "job"}), displayJob() {}, monitor: () => finished,
    });
    const app = fs.readFileSync("src/photoswitchlab/web/static/app.js", "utf8");
    vm.runInContext(app.slice(app.indexOf("async function startJob("), app.indexOf("function handle(")), context);
    const running = context.startJob({kind: "template"});
    await new Promise(setImmediate);
    assert.equal(document.activeElement.id, "job-title");
    if (move) node("guide-open").focus();
    finish({status: "complete"});
    await running;
    assert.equal(document.activeElement.id, move ? "guide-open" : "active-name");
  }
});
