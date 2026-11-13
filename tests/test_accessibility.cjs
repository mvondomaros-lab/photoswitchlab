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
  const settings = {substituents: ["H", "H", "H", "H", "H", "OMe", "H", "H", "H", "H"]};
  assert.ok(data.atomLabel(graph, 2, settings).includes("zugeordnet: Methoxygruppe"));
  assert.ok(data.atomLabel(graph, 0, settings).includes("trägt Methoxygruppe"));
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
      options: [], children: [], value: "", open: false, checked: false,
      get textContent() { return text; },
      set textContent(value) { text = value; mutations++; },
      replaceChildren(...children) { this.options = children; this.value = children[0]?.value ?? ""; mutations++; },
      append(...children) { this.children.push(...children); }, focus() { focused = this; }, classList: { toggle() {} },
    };
  }
  const node = (id) => {
    if (!elements.has(id)) {
      const created = element();
      created.id = id;
      elements.set(id, created);
    }
    return elements.get(id);
  };
  let exported, focused;
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
  let selected = molecule;
  const view = context.AccessibilityView;
  view.initialize({ state, current: () => selected, records: () => [], playback: () => ({records: []}),
    render: () => view.render(), showResult: () => {}, selectFrame: () => {}, label: (m) => m.name,
    substituentLabel: (s) => s, filename: (extension) => `result.${extension}`,
    download: (content, filename) => { exported = {content, filename}; },
  });
  return { view, node, saved, molecule, state, context, select: (value) => { selected = value; view.render(); }, mutations: () => mutations, exported: () => exported, focused: () => focused };
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
  lab.node("remember-observation").onclick();
  lab.node("color-comparison").value = "b";
  lab.node("color-comparison").onchange();
  lab.node("remember-observation").onclick();
  lab.node("data-report").onclick();
  const output = lab.exported();
  assert.equal(output.filename, "photoswitchlab-beobachtungen.html");
  assert.ok(output.content.includes('lang="de"'));
  assert.ok(output.content.includes("&lt;script&gt;"));
  assert.ok(!output.content.includes("<script>"));
  assert.ok(output.content.includes("Beobachtung 1"));
  assert.ok(output.content.includes("1,5000 eV"));
  assert.ok(output.content.includes("Farbabstand"));
  assert.ok(output.content.includes("feste Absorbanzskalierung"));
  assert.ok(!output.content.includes("Vollständige Spektraldaten"));
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

test("the shared capture action remembers only its explicit current scope and cannot capture a failed query", () => {
  const lab = accessibleLab();
  lab.view.render();
  lab.node("curve-energy").value = "1,2";
  lab.node("curve-query").onclick();
  assert.equal(lab.node("remember-observation").textContent, "Kurvenwert merken");
  lab.node("atom-explorer").open = true;
  lab.node("atom-first").onchange();
  assert.equal(lab.node("remember-observation").textContent, "Messung merken");
  lab.node("remember-observation").onclick();
  lab.node("data-report").onclick();
  assert.ok(lab.exported().content.includes("Ringposition C1"));
  assert.ok(!lab.exported().content.includes("1,2000 eV"));
  lab.node("curve-energy").value = "1,8";
  lab.node("curve-query").onclick();
  lab.node("curve-energy").value = "0,3";
  lab.node("curve-query").onclick();
  assert.equal(lab.node("remember-observation").disabled, true);
  lab.node("remember-observation").onclick(); // Even a programmatic invocation adds no stale datum.
  assert.equal(lab.node("observations-summary").textContent, "Gemerkte Beobachtungen (1)");
  lab.node("data-report").onclick();
  assert.ok(!lab.exported().content.includes("1,8000 eV"));
});

test("explicit observation collection retains several named probes and geometries without collecting every selection", () => {
  const lab = accessibleLab();
  lab.view.render();
  lab.node("atom-explorer").open = true;
  lab.node("atom-first").onchange();
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
  lab.node("atom-first").onchange();
  for (const index of ["0", "1"]) {
    lab.node("path-point").value = index;
    lab.node("path-point").onchange();
    lab.node("remember-observation").onclick();
    lab.node("atom-first").onchange();
    lab.node("remember-observation").onclick();
  }
  lab.node("data-report").onclick();
  const report = lab.exported().content;
  for (const text of ["1,2000 eV", "1,8000 eV", "Pfadstruktur 1", "Pfadstruktur 2", "Ringposition C1", "100,0 pm", "200,0 pm"]) assert.ok(report.includes(text), text);
  assert.equal((report.match(/<h3>Beobachtung /g) || []).length, 6);
  lab.node("clear-observations").onclick();
  lab.node("data-report").onclick();
  assert.ok(!lab.exported().content.includes("Beobachtung 1"));
});

test("remembered spectral evidence keeps frozen source context without unrelated current or default geometry", () => {
  const lab = accessibleLab();
  lab.molecule.name = "Spektrum A";
  lab.molecule.converged = true;
  lab.molecule.spectrum.coverage_complete = false;
  lab.view.render();
  lab.node("atom-explorer").open = true; // Opening optional geometry alone is not a measurement selection.
  for (const energy of ["1,2", "1,8"]) {
    lab.node("curve-energy").value = energy;
    lab.node("curve-query").onclick();
    lab.node("remember-observation").onclick();
  }
  // Later state changes must not rewrite the provenance of retained observations.
  lab.molecule.spectrum.coverage_complete = true;
  const start = {...lab.molecule, id: "new", name: "Unbeteiligte Startstruktur B", kind: "initial", spectrum: null};
  lab.select(start);
  lab.node("atom-explorer").open = true;
  lab.node("data-report").onclick();
  const report = lab.exported().content;
  assert.equal(lab.exported().filename, "photoswitchlab-beobachtungen.html");
  assert.ok(!report.includes("Unbeteiligte Startstruktur B"));
  assert.ok(!report.includes("Aktuelle Auswahl"));
  assert.ok(!report.includes("Diederwinkel"));
  assert.ok(!report.includes("Ringposition"));
  assert.equal((report.match(/INDO\/S–CIS/g) || []).length, 1);
  assert.equal((report.match(/Absorption kann dort unterschätzt werden/g) || []).length, 1);
  for (const energy of ["1,2000", "1,8000"]) assert.ok(report.includes(energy));
  lab.select(null);
  assert.equal(lab.node("accessible-results").hidden, false);
  assert.equal(lab.node("accessible-current").hidden, true);
  assert.equal(lab.node("remember-observation").disabled, true);
  assert.equal(lab.node("data-report").disabled, false);
  lab.node("data-report").onclick();
  assert.equal(lab.exported().content, report);
  lab.node("clear-observations").onclick();
  assert.equal(lab.node("accessible-results").hidden, true);
  assert.equal(lab.node("data-report").disabled, true);
});

test("remembered path evidence retains its own convergence and validation after selecting another structure", () => {
  const lab = accessibleLab();
  lab.state.step = "optimize";
  lab.molecule.name = "Pfadstruktur A";
  lab.molecule.kind = "ts";
  lab.molecule.converged = true;
  lab.molecule.ts_search = {
    connectivity: {verified: false},
    validation: {imaginary_count: 1, imaginary_frequency_cm1: -230},
    path: [
      {image: 0, energy_ev: -10, positions: [0, 0, 0, 1, 0, 0, 1, 2, 0]},
      {image: 1, energy_ev: -9, positions: [0, 0, 0, 2, 0, 0, 2, 2, 0]},
    ],
  };
  lab.view.render();
  for (const point of ["0", "1"]) {
    lab.node("path-point").value = point;
    lab.node("path-point").onchange();
    lab.node("remember-observation").onclick();
  }
  lab.molecule.ts_search.validation.imaginary_count = 3;
  lab.select({...lab.molecule, id: "other", name: "Andere Minimumstruktur B", kind: "minimum", ts_search: null});
  lab.node("data-report").onclick();
  const report = lab.exported().content;
  assert.ok(!report.includes("Andere Minimumstruktur B"));
  assert.equal((report.match(/Verbindung zwischen cis und trans bestätigt/g) || []).length, 1);
  assert.ok(report.includes('Verbindung zwischen cis und trans bestätigt</th><td>nein</td>'));
  assert.ok(report.includes('Betrag über 20 cm⁻¹</th><td>1</td>'));
  assert.ok(report.includes("230,0"));
  assert.ok(report.includes("erste Pfadstruktur"));
  assert.equal((report.match(/Optimierung abgeschlossen/g) || []).length, 1);
});

test("spectrum presentation prioritizes its own results while geometry remains optional", () => {
  const lab = accessibleLab("?text=1");
  lab.view.render();
  assert.equal(lab.node("accessible-spectrum").hidden, false);
  assert.equal(lab.node("accessible-geometry").hidden, true);
  assert.equal(lab.node("accessible-spectrum-geometry").hidden, false);
  lab.node("data-report").onclick();
  assert.ok(lab.exported().content.includes("Höchste gespeicherte relative Absorption"));
  assert.ok(!lab.exported().content.includes("Diederwinkel"));
  lab.state.step = "optimize";
  lab.view.render();
  assert.equal(lab.node("accessible-spectrum").hidden, true);
  assert.equal(lab.node("accessible-geometry").hidden, false);
});

test("stored broadened-curve overview finds visible and ultraviolet maxima without fitting sub-grid peaks", () => {
  const spectrum = {energy_ev: [1.5, 1.7, 2, 2.3, 3, 3.4, 4, 4.3, 5], absorption: [0, 1, 0.1, 0.8, 0.1, 0.1, 3, 0.1, 0]};
  const curve = data.curveOverview(spectrum);
  assert.deepEqual(curve.peaks.map((peak) => peak.low), [1.7, 2.3, 4]);
  assert.deepEqual(curve.peaks.map((peak) => peak.visible), [true, true, false]);
  assert.equal(curve.visible.coverage, "full");
  const description = data.describeCurve(spectrum);
  assert.equal(description.bands.length, 3);
  assert.ok(description.bands[0].startsWith("Sichtbarer Bereich"));
  assert.ok(description.bands[0].includes("1,7000 eV"));
  assert.ok(description.bands[2].includes("Außerhalb des sichtbaren Bereichs"));
  assert.ok(description.bands[2].includes("relative Absorption 3"));
});

test("curve overview treats plateaus, clipped boundaries, flat curves and partial visible coverage explicitly", () => {
  const plateau = {energy_ev: [1, 2, 3, 4], absorption: [0, 0.7, 0.7, 0]};
  assert.deepEqual(data.curveOverview(plateau).peaks.map((peak) => [peak.low, peak.high]), [[2, 3]]);
  assert.ok(data.describeCurve(plateau).bands[0].includes("2,0000–3,0000 eV"));
  assert.ok(data.describeCurve(plateau).bands[0].includes("Plateau"));
  assert.ok(!data.describeCurve(plateau).bands[0].includes("2,5000"));
  const boundary = {energy_ev: [1.5, 2, 3.5, 4], absorption: [0, 1, 0.5, 2]};
  assert.deepEqual(data.curveOverview(boundary).peaks.map((peak) => peak.low), [2]);
  assert.ok(data.describeCurve(boundary).note.includes("am oberen Rand"));
  assert.ok(!data.describeCurve(boundary).bands.join(" ").includes("4,0000 eV"));
  const flat = {energy_ev: [1, 2, 3, 4], absorption: [0.2, 0.2, 0.2, 0.2]};
  assert.equal(data.curveOverview(flat).flat, true);
  assert.equal(data.describeCurve(flat).bands.length, 0);
  assert.ok(data.describeCurve(flat).note.includes("konstant"));
  const partial = {energy_ev: [2, 2.5, 3], absorption: [1, 2, 3]};
  assert.equal(data.curveOverview(partial).visible.coverage, "partial");
  assert.ok(data.describeCurve(partial).coverage.includes("nur von"));
  assert.ok(data.describeCurve(partial).note.includes("steigen dort mit steigender Energie"));
  assert.ok(data.describeCurve(partial).note.includes("kein inneres lokales Maximum"));
  assert.equal(data.curveOverview({energy_ev: [4, 5], absorption: [1, 2]}).visible.coverage, "none");
  assert.equal(data.curveOverview({energy_ev: [2, 2], absorption: [0, 1]}), null);
  assert.equal(data.curveOverview({energy_ev: [2, 3], absorption: [0, -1]}), null);
});

test("full spectral data exposes every broadened-curve maximum when the compact overview omits weak peaks", () => {
  const energy_ev = Array.from({length: 41}, (_value, i) => Number((1.4 + i * 0.1).toFixed(1)));
  const absorption = energy_ev.map(() => 0);
  [3, 5, 7, 9, 11, 21, 25, 29].forEach((index, i) => { absorption[index] = (i + 1) / 10; });
  const spectrum = {energy_ev, absorption, excitations_ev: [2.1], oscillator_strengths: [0.2]};
  const overview = data.describeCurve(spectrum);
  assert.equal(overview.bands.length, 6);
  assert.equal(overview.allBands.length, 8);
  assert.ok(!overview.bands.some((band) => band.includes("1,7000 eV")));
  assert.ok(!overview.bands.some((band) => band.includes("3,5000 eV")));
  assert.ok(overview.allBands.some((band) => band.includes("1,7000 eV")));
  assert.ok(overview.allBands.some((band) => band.includes("3,5000 eV")));
  assert.ok(overview.note.includes("2 weitere lokale Maxima sind"));
  const fewer = {...spectrum, absorption: [...absorption]};
  fewer.absorption[21] = 0;
  assert.ok(data.describeCurve(fewer).note.includes("1 weiteres lokales Maximum ist"));
  const lab = accessibleLab();
  lab.molecule.spectrum = spectrum;
  lab.view.render();
  assert.equal(lab.node("spectrum-band-list").options.length, 6);
  assert.equal(lab.node("spectrum-all-band-list").options.length, 8);
  assert.ok(lab.node("spectrum-all-band-list").options[0].textContent.includes("1,7000 eV"));
  lab.node("curve-energy").value = "1,7";
  lab.node("curve-query").onclick();
  lab.node("remember-observation").onclick();
  lab.node("data-report").onclick();
  assert.ok(lab.exported().content.includes("1,7000 eV"));
});

test("remembering a spectrum retains the factual band overview with its source context", () => {
  const lab = accessibleLab();
  lab.molecule.spectrum = {energy_ev: [1.5, 2, 2.5, 3, 3.5], absorption: [0, 1, 0, 2, 0], excitations_ev: [2], oscillator_strengths: [0.2]};
  lab.view.render();
  lab.node("remember-observation").onclick();
  lab.select(null);
  lab.node("data-report").onclick();
  const report = lab.exported().content;
  assert.ok(report.includes("2,0000 eV"));
  assert.ok(report.includes("3,0000 eV"));
  assert.ok(report.includes("Sichtbarer Bereich"));
  assert.ok(report.includes("INDO/S–CIS"));
  assert.ok(report.includes("Lokale Maxima werden an den gespeicherten Kurvenpunkten bestimmt"));
});

test("removing or clearing the last observation without a current structure focuses a visible heading", () => {
  for (const remove of [true, false]) {
    const lab = accessibleLab();
    lab.view.render();
    lab.node("remember-observation").onclick();
    const button = lab.node("observations-list").options[0].children[1];
    lab.select(null);
    if (remove) button.onclick();
    else lab.node("clear-observations").onclick();
    assert.equal(lab.node("accessible-results").hidden, true);
    assert.equal(lab.focused(), lab.node("step-title"));
    assert.ok(lab.node("accessible-status").textContent.includes(remove ? "entfernt" : "geleert"));
  }
  const lab = accessibleLab();
  lab.view.render();
  lab.node("remember-observation").onclick();
  lab.node("clear-observations").onclick();
  assert.equal(lab.node("accessible-results").hidden, false);
  assert.equal(lab.focused(), lab.node("observations-summary"));
});

test("unit conversion accepts comma or dot consistently in all fields and rejects invalid wavelengths", () => {
  const nodes = new Map();
  const node = (id) => {
    if (!nodes.has(id)) nodes.set(id, {value: "", textContent: "", attributes: {}, setAttribute(key, value) { this.attributes[key] = value; }});
    return nodes.get(id);
  };
  const context = vm.createContext({$: node, AccessibleData: data, EV_KJ: 96.48533212331002, HC: 1239.8419843320026});
  const app = fs.readFileSync("src/photoswitchlab/web/static/app.js", "utf8");
  vm.runInContext(app.slice(app.indexOf("function convert(source)"), app.indexOf('for (const key of ["ev", "kj", "nm"])\n  $("convert-" + key).oninput')), context);
  const convert = (source, value) => { node(`convert-${source}`).value = value; context.convert(source); };
  const value = (key) => data.decimal(node(`convert-${key}`).value);
  convert("ev", "0,3");
  assert.ok(Math.abs(value("kj") - 28.945599637) < 1e-6);
  convert("ev", "3,5");
  assert.ok(Math.abs(value("nm") - 354.24056695) < 1e-6);
  const expected = node("convert-nm").value;
  convert("ev", "3.5");
  assert.equal(node("convert-nm").value, expected);
  convert("kj", "0,3");
  assert.ok(Math.abs(value("ev") - 0.3 / context.EV_KJ) < 1e-10);
  convert("nm", "3,5");
  assert.ok(Math.abs(value("ev") - context.HC / 3.5) < 1e-6);
  for (const energy of ["0", "-0,3"]) {
    convert("ev", energy);
    assert.equal(node("convert-nm").value, "");
    assert.equal(node("convert-ev").attributes["aria-invalid"], "false");
    assert.ok(value("kj") <= 0);
  }
  for (const wavelength of ["0", "-3,5"]) {
    convert("nm", wavelength);
    assert.equal(node("convert-ev").value, "");
    assert.equal(node("convert-nm").attributes["aria-invalid"], "true");
    assert.ok(node("conversion-status").textContent.includes("positive Wellenlänge"));
  }
  for (const source of ["ev", "kj", "nm"]) {
    convert(source, "3,5.1");
    assert.equal(node(`convert-${source}`).attributes["aria-invalid"], "true");
    assert.ok(node("conversion-status").textContent.includes("Dezimalkomma oder Dezimalpunkt"));
  }
});

test("website preference restores separate manual disclosure choices in each presentation", () => {
  const listeners = new Map();
  const preference = {checked: false, addEventListener(type, listener) { listeners.set(type, listener); }};
  const descriptions = [{open: true}, {open: false}];
  const context = vm.createContext({
    document: {currentScript: {src: "https://example.org/assets/site.js"}, querySelector: () => preference,
      querySelectorAll: () => descriptions, body: {classList: {toggle() {}}}},
    location: {search: ""}, URL, URLSearchParams,
    localStorage: {getItem: () => null, setItem() {}},
  });
  const site = fs.readFileSync("site/assets/site.js", "utf8");
  vm.runInContext(site.slice(0, site.indexOf("const mobileNavigation")), context);
  const toggle = (checked) => { preference.checked = checked; listeners.get("change")(); };
  toggle(true);
  assert.deepEqual(descriptions.map((description) => description.open), [true, true]);
  descriptions[0].open = false;
  toggle(false);
  assert.deepEqual(descriptions.map((description) => description.open), [true, false]);
  descriptions[1].open = true;
  toggle(true);
  assert.deepEqual(descriptions.map((description) => description.open), [false, true]);
  toggle(false);
  assert.deepEqual(descriptions.map((description) => description.open), [true, true]);
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
