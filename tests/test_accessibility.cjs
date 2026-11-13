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
  assert.equal(data.atomLabel(graph, 0), "Atom 1 (C, Ringposition C2′ im zweiten Ring)");
  assert.equal(data.atomLabel(graph, 2), "Atom 3 (C, Ringbezug C2′ im zweiten Ring)");
  const settings = {substituents: ["H", "H", "H", "H", "H", "OMe", "H", "H", "H", "H"]};
  assert.ok(data.atomLabel(graph, 2, settings).includes("zugeordnet: Methoxygruppe"));
  assert.ok(data.atomLabel(graph, 0, settings).includes("trägt Methoxygruppe"));
});
test("approximate color words distinguish achromatic, dark and selective colors", () => {
  assert.equal(data.color([255, 255, 255]), "nahezu farblos");
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
  const context = vm.createContext({ScientificDisplay: globalThis.ScientificDisplay,
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
  const elements = new Map(), saved = new Map(), regions = [], events = new Map(), records = [];
  function element() {
    let text = "", html = "";
    return {
      get innerHTML() { return html; },
      set innerHTML(value) { html = value; mutations++; },
      attributes: {},
      setAttribute(key, value) { this.attributes[key] = value; },
      getAttribute(key) { return this.attributes[key]; },
      hasAttribute(key) { return key in this.attributes; },
      removeAttribute(key) { delete this.attributes[key]; },
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
  const context = vm.createContext({ScientificDisplay: globalThis.ScientificDisplay,
    document: { getElementById: node, createElement: element, body: element(), querySelectorAll: () => regions, addEventListener: (type, handler) => events.set(type, handler) },
    addEventListener: (type, handler) => events.set(type, handler),
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
  const molecule = { id: "a", kind: "minimum", converged: true, settings: {configuration: "cis", substituents: Array(10).fill("H")}, name: 'A <script>alert("x")</script>', formula: "C12H10N2", atom_count: 3,
    xyz: "3\nexample\nC 0 0 0\nN 1 0 0\nN 1 2 0", properties: {energy_ev: -10, dihedral_deg: 180, ring_distance_pm: 400},
    atom_graph: [1, 2, 3].map((number) => ({ number, element: "C", position: `C${number}`, neighbors: [] })),
    spectrum: {energy_ev: [1, 2], absorption: [0.1, 0.5], excitations_ev: [1.5], oscillator_strengths: [0.2], color: {rgb: [255, 255, 0], luminance: 0.5}},
  };
  const state = { step: "spectrum", molecules: [molecule, {...molecule, id: "b", name: "B", settings: {...molecule.settings, configuration: "trans"}}] };
  let selected = molecule;
  const view = context.AccessibilityView;
  view.initialize({ state, current: () => selected, records: () => records, playback: () => ({records: []}),
    selectableMolecules: () => state.molecules.filter((m) => state.step !== "spectrum" || m.kind === "minimum"),
    selectMolecule: (id) => { selected = state.molecules.find((m) => m.id === id); view.render(); },
    render: () => view.render(), showResult: () => {}, selectFrame: () => {}, label: (m) => m.name,
    substituentLabel: (s) => s, filename: (extension) => `result.${extension}`,
    download: (content, filename) => { exported = {content, filename}; },
  });
  return { view, node, saved, molecule, state, context, regions, events, records, select: (value) => { selected = value; view.render(); }, mutations: () => mutations, exported: () => exported, focused: () => focused };
}

test("explicit text preference persists and turning it off restores graphical-first disclosure", () => {
  const lab = accessibleLab("?text=1");
  assert.equal(lab.saved.get("photoswitchlab.textPreferred"), "true");
  assert.equal(lab.node("accessible-results").open, true);
  lab.node("text-preference").checked = false;
  lab.node("graphic-preference").checked = true;
  lab.node("graphic-preference").onchange();
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

test("automatic in-app result and optional export share one escaped report model", () => {
  const lab = accessibleLab("?text=1");
  lab.view.render();
  const displayed = lab.node("result-report-content").innerHTML;
  assert.ok(displayed.includes("&lt;script&gt;"));
  assert.ok(!displayed.includes("<script>"));
  assert.ok(displayed.includes("Stärkste elektronische Übergänge"));
  assert.ok(displayed.includes("Zugehöriges cis/trans-Paar"));
  lab.node("data-report").onclick();
  assert.equal(lab.exported().filename, "result-Spektrum.html"); // Reports of different steps keep distinct names.
  assert.equal(lab.node("accessible-status").textContent, "Ergebnisbericht gespeichert: result-Spektrum.html");
  assert.match(lab.exported().content, /<p>Erstellt am [^<]+\.<\/p>/);
  assert.ok(lab.exported().content.replaceAll(' tabindex="0"', "").includes(displayed));
  assert.ok(!lab.exported().content.includes("Beobachtung 1"));
  assert.ok(!lab.exported().content.includes("Vollständige Spektraldaten"));
  const source = fs.readFileSync("src/photoswitchlab/web/static/accessibility.js", "utf8");
  assert.ok(!source.includes("remember-observation"));
  assert.ok(!source.includes("observations"));
});

test("shared-energy probe immediately compares both configurations without capturing or choosing a partner", () => {
  const lab = accessibleLab();
  lab.state.molecules[1].spectrum = {...lab.molecule.spectrum, absorption: [0.3, 0.9]};
  lab.view.render();
  lab.node("curve-energy").value = "1,5";
  lab.node("curve-query").onclick();
  const displayed = lab.node("curve-value").innerHTML;
  for (const text of ["1,5 eV", "cis", "trans", "0,3", "0,6"]) assert.ok(displayed.includes(text), text);
  lab.node("data-report").onclick();
  assert.ok(lab.exported().content.replaceAll(' tabindex="0"', "").includes(displayed));
  assert.ok(!lab.exported().content.includes("Diederwinkel"));
  // A later query replaces the current value instead of building a mental queue.
  lab.node("curve-energy").value = "1,8";
  lab.node("curve-query").onclick();
  lab.node("data-report").onclick();
  assert.ok(lab.exported().content.includes("1,8 eV"));
  assert.ok(!lab.exported().content.includes("1,5 eV ("));
});

test("invalid and out-of-range probes show clear messages and do not export stale values", () => {
  const lab = accessibleLab();
  lab.view.render();
  lab.node("curve-energy").value = "1,8";
  lab.node("curve-query").onclick();
  for (const [value, expected] of [["0,3", "von 1 bis 2"], ["1,5.1", "Dezimalkomma oder Dezimalpunkt"]]) {
    lab.node("curve-energy").value = value;
    lab.node("curve-query").onclick();
    assert.ok(lab.node("curve-value").innerHTML.includes(expected));
    lab.node("data-report").onclick();
    assert.ok(!lab.exported().content.includes("1,8 eV ("));
  }
});

test("paired spectra retain source-specific coverage warnings and explain unavailable samples without dropping valid ones", () => {
  const lab = accessibleLab("?text=1");
  lab.molecule.name = "cis-Azobenzol";
  lab.molecule.spectrum = {...lab.molecule.spectrum, energy_ev: [1, 2, 3], absorption: [0, 1, 0], coverage_complete: true};
  const partner = lab.state.molecules[1];
  partner.name = "trans-Azobenzol";
  partner.spectrum = {...partner.spectrum, energy_ev: [2, 3, 4], absorption: [0, 2, 0], coverage_complete: false};
  lab.view.render();
  const main = lab.node("result-report-content").innerHTML;
  assert.ok(main.includes("trans-Azobenzol · Minimumstruktur: Am oberen Rand des Beobachtungsfensters"));
  assert.ok(main.includes("trans-Azobenzol · Minimumstruktur: Beobachtungsfenster 2 bis 4 eV"));
  assert.ok(!main.includes("cis-Azobenzol · Minimumstruktur: Am oberen Rand"));
  lab.node("curve-energy").value = "1,5";
  lab.node("curve-query").onclick();
  let probe = lab.node("curve-value").innerHTML;
  assert.ok(probe.includes("trans-Azobenzol · Minimumstruktur: Bei 1,5 eV ist kein Kurvenwert verfügbar"));
  assert.ok(probe.includes("von 2 bis 4 eV"));
  assert.ok(probe.includes("0,5")); // cis remains valid.
  // A value outside the selected spectrum can still be available in its partner.
  lab.node("curve-energy").value = "3,5";
  lab.node("curve-query").onclick();
  probe = lab.node("curve-value").innerHTML;
  assert.ok(probe.includes("cis-Azobenzol · Minimumstruktur: Bei 3,5 eV ist kein Kurvenwert verfügbar"));
  assert.ok(probe.includes("1</td>")); // trans remains available despite incomplete high-edge coverage.
  lab.node("data-report").onclick();
  assert.ok(lab.exported().content.replaceAll(' tabindex="0"', "").includes(probe));
  assert.ok(lab.exported().content.includes("trans-Azobenzol · Minimumstruktur: Am oberen Rand"));
});

test("color is a descriptive primary result without a distance metric and tables keep one visible title plus an accessible caption", () => {
  const lab = accessibleLab("?text=1");
  lab.view.render();
  const main = lab.node("result-report-content").innerHTML;
  assert.ok(main.includes("<h3>Farbvorhersage</h3>"));
  assert.ok(main.includes("Geschätzte Lösungsfarbe") && main.includes("Lichtdurchlässigkeit"));
  assert.ok(!main.includes("Farbabstand") && !main.includes("CIE76"));
  lab.node("data-report").onclick();
  const exported = lab.exported().content;
  assert.ok(exported.includes("<section><h3>Farbvorhersage</h3>"));
  assert.ok(!exported.includes("Freiwillige"));
  assert.ok(exported.includes('<div class="table-scroll" tabindex="0" role="region"')); // Standalone exports have no resize observer.
  assert.ok(exported.includes(".sr-only{position:absolute"));
  const body = data.reportBody([{title: "Testtabelle", columns: ["Struktur", "Wert"], rows: [["cis", "1"]]}]);
  assert.equal((body.match(/<h3>Testtabelle<\/h3>/g) || []).length, 1);
  assert.ok(body.includes('<caption class="sr-only">Testtabelle</caption>'));
  assert.ok(!body.includes("<caption>"));
});

test("automatic matching accepts all eight independent ring orientations and never crosses derivatives", () => {
  const substitutions = ["Me", "OMe", "NMe2", "CF3", "CN", "NO2", "Me", "H", "OMe", "H"];
  const m = {id: "cis", kind: "minimum", converged: true, settings: {configuration: "cis", substituents: substitutions}};
  const first = substitutions.slice(0, 5), second = substitutions.slice(5), keys = new Set();
  for (const a of [first, [...first].reverse()]) for (const b of [second, [...second].reverse()]) for (const subs of [[...a, ...b], [...b, ...a]]) {
    const other = {...m, id: "trans", settings: {configuration: "trans", substituents: subs}};
    keys.add(JSON.stringify(subs));
    assert.equal(data.partner(m, [m, other]), other);
  }
  assert.equal(keys.size, 8);
  const wrong = {...m, id: "wrong", settings: {configuration: "trans", substituents: ["H", ...substitutions.slice(1)]}};
  assert.equal(data.partner(m, [m, wrong]), null);
  assert.equal(data.derivativeKey({configuration: "cis", substituents: ["H"]}), null);
  assert.equal(data.derivativeKey({configuration: "cis", substituents: Array(10).fill("unknown")}), null);
  assert.equal(data.partner({...m, settings: undefined}, [wrong]), null);
  assert.equal(data.partner(m, [m]), null);
  const other = {...m, id: "other", settings: {...m.settings, configuration: "trans"}};
  assert.equal(data.partner(m, [m, {...other, converged: false}]), null);
  assert.equal(data.partner(m, [m, other, {...other, id: "ambiguous"}]), null);
  assert.equal(data.partner(m, [m, other], true), null); // No spectra.
});

test("five transitions are selected in the inclusive observation window and ordered by descending raw strength", () => {
  const spectrum = {energy_ev: [1.5, 5.5], absorption: [0, 1],
    excitations_ev: [1.4, 1.5, 2, 2.5, 3, 4, 5, 5.5, 5.6, 3.5, 4.5, 4.7],
    oscillator_strengths: [100, .2, .9, 0, .5, .5, .3, .4, 100, -1, NaN, Infinity]};
  const selected = data.strongestTransitions(spectrum);
  assert.deepEqual(selected.map((t) => t.index), [3, 5, 6, 8, 7]);
  assert.deepEqual(data.strongestTransitions(spectrum, 6).map((t) => t.index), [3, 5, 6, 8, 7, 2]);
  const tied = {...spectrum, oscillator_strengths: spectrum.oscillator_strengths.map((f) => f > 0 && Number.isFinite(f) ? 1 : f)};
  assert.deepEqual(data.strongestTransitions(tied).map((t) => t.index), [2, 3, 5, 6, 7]);
  assert.deepEqual(data.strongestTransitions({...spectrum, oscillator_strengths: spectrum.oscillator_strengths.map(() => 0)}), []);
});

test("a weak visible line remains discoverable while curve maximum and same-energy values use the full broadened spectrum", () => {
  const lab = accessibleLab();
  lab.molecule.spectrum = {energy_ev: [1.5, 2, 2.5, 3, 4, 5.5], absorption: [0, 4, 0, 1, 0, 0],
    excitations_ev: [2.1, 3.5, 3.7, 4, 4.5, 5], oscillator_strengths: [0.0000002, .1, .2, .3, .4, .5]};
  lab.view.render();
  const report = lab.node("result-report-content").innerHTML;
  assert.ok(report.includes("Emax = 2 eV"));
  assert.ok(report.includes("Weitere Übergänge im sichtbaren Bereich"));
  assert.ok(report.includes("2,1</td>"));
  assert.ok(report.includes("2 mal zehn hoch minus 7"));
  assert.equal(lab.node("transition-table-body").options.length, 6);
  assert.ok(!report.includes("Lokale Maxima"));
});

test("reports follow the selected saved structure and preserve convergence and transition-structure validation", () => {
  const lab = accessibleLab();
  lab.state.step = "optimize";
  lab.molecule.kind = "ts";
  lab.molecule.ts_search = {connectivity: {verified: false}, validation: {imaginary_count: 1, imaginary_frequency_cm1: -230},
    failure_reason: "Verbindung nicht bestätigt", path: [{image: 0, energy_ev: -10, positions: [0, 0, 0, 1, 0, 0, 1, 2, 0]}, {image: 1, energy_ev: -9, positions: [0, 0, 0, 2, 0, 0, 2, 2, 0]}]};
  lab.view.render();
  const report = lab.node("result-report-content").innerHTML;
  for (const text of ["Verbindung zwischen cis und trans bestätigt</th><td>nein", "Betrag über 20 cm⁻¹</th><td>1", "230", "Verbindung nicht bestätigt"]) assert.ok(report.includes(text), text);
  lab.node("path-point").value = "1";
  lab.node("path-point").onchange();
  assert.ok(lab.node("result-report-content").innerHTML.includes("Pfadstruktur 2"));
  lab.select({...lab.molecule, id: "different", name: "Andere Struktur", kind: "minimum", ts_search: null});
  lab.node("data-report").onclick();
  assert.ok(lab.exported().content.includes("Andere Struktur"));
  assert.ok(!lab.exported().content.includes("230"));
  lab.select(null);
  assert.equal(lab.node("accessible-results").hidden, true);
  assert.equal(lab.node("data-report").disabled, true);
});

test("inline structure selection calls the shared selection action without opening a dialog", () => {
  const lab = accessibleLab("?text=1");
  lab.view.render();
  lab.node("accessible-molecule-select").value = "b";
  lab.node("accessible-molecule-select").onchange();
  assert.ok(lab.node("result-report-content").innerHTML.includes("B · Minimumstruktur"));
  const template = fs.readFileSync("src/photoswitchlab/web/static/index.html", "utf8");
  assert.ok(!template.includes('id="transition-point"'));
  assert.ok(!template.includes('id="color-comparison"'));
  assert.ok(!template.includes('id="remember-observation"'));
  assert.ok(template.includes('id="accessible-molecule-select"'));
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
  assert.ok(description.bands[0].includes("1,7 eV"));
  assert.ok(description.bands[2].includes("Außerhalb des sichtbaren Bereichs"));
  assert.ok(description.bands[2].includes("relative Absorption 3"));
});

test("curve overview treats plateaus, clipped boundaries, flat curves and partial visible coverage explicitly", () => {
  const plateau = {energy_ev: [1, 2, 3, 4], absorption: [0, 0.7, 0.7, 0]};
  assert.deepEqual(data.curveOverview(plateau).peaks.map((peak) => [peak.low, peak.high]), [[2, 3]]);
  assert.ok(data.describeCurve(plateau).bands[0].includes("2–3 eV"));
  assert.ok(data.describeCurve(plateau).bands[0].includes("Plateau"));
  assert.ok(!data.describeCurve(plateau).bands[0].includes("2,5000"));
  const boundary = {energy_ev: [1.5, 2, 3.5, 4], absorption: [0, 1, 0.5, 2]};
  assert.deepEqual(data.curveOverview(boundary).peaks.map((peak) => peak.low), [2]);
  assert.ok(data.describeCurve(boundary).note.includes("am oberen Rand"));
  assert.ok(!data.describeCurve(boundary).bands.join(" ").includes("4 eV"));
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
  assert.ok(!overview.bands.some((band) => band.includes("1,7 eV")));
  assert.ok(!overview.bands.some((band) => band.includes("3,5 eV")));
  assert.ok(overview.allBands.some((band) => band.includes("1,7 eV")));
  assert.ok(overview.allBands.some((band) => band.includes("3,5 eV")));
  assert.ok(overview.note.includes("2 weitere lokale Maxima sind"));
  const fewer = {...spectrum, absorption: [...absorption]};
  fewer.absorption[21] = 0;
  assert.ok(data.describeCurve(fewer).note.includes("1 weiteres lokales Maximum ist"));
  const lab = accessibleLab();
  lab.molecule.spectrum = spectrum;
  lab.view.render();
  assert.equal(lab.node("spectrum-all-band-list").options.length, 8);
  assert.ok(lab.node("spectrum-all-band-list").options[0].textContent.includes("1,7 eV"));
  lab.node("curve-energy").value = "1,7";
  lab.node("curve-query").onclick();
  lab.node("data-report").onclick();
  assert.ok(lab.exported().content.includes("1,7 eV"));
});

test("unit conversion accepts comma or dot consistently in all fields and rejects invalid wavelengths", () => {
  const nodes = new Map();
  const node = (id) => {
    if (!nodes.has(id)) nodes.set(id, {value: "", textContent: "", attributes: {}, setAttribute(key, value) { this.attributes[key] = value; }});
    return nodes.get(id);
  };
  const context = vm.createContext({ScientificDisplay: globalThis.ScientificDisplay,$: node, AccessibleData: data, EV_KJ: 96.48533212331002, HC: 1239.8419843320026});
  const app = fs.readFileSync("src/photoswitchlab/web/static/app.js", "utf8");
  vm.runInContext(app.slice(app.indexOf("function convert(source)"), app.indexOf('for (const key of ["ev", "kj", "nm"])\n  $("convert-" + key).oninput')), context);
  const convert = (source, value) => { node(`convert-${source}`).value = value; context.convert(source); };
  const value = (key) => data.decimal(node(`convert-${key}`).value);
  convert("ev", "0,3");
  assert.equal(node("convert-kj").value, "28,95");
  convert("ev", "3,5");
  assert.equal(node("convert-nm").value, "354,2");
  const expected = node("convert-nm").value;
  convert("ev", "3.5");
  assert.equal(node("convert-nm").value, expected);
  convert("kj", "0,3");
  assert.equal(node("convert-ev").value, "0,003109");
  convert("nm", "3,5");
  assert.equal(node("convert-ev").value, "354,2");
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
  const context = vm.createContext({ScientificDisplay: globalThis.ScientificDisplay,
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
    const context = vm.createContext({ScientificDisplay: globalThis.ScientificDisplay,document, $: node, state: {busy: false}, current: () => null,
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

test("display precision keeps useful energy differences, removes padding and gives tiny values a spoken scientific form", () => {
  const numbers = globalThis.ScientificDisplay;
  assert.equal(numbers.fixed(-1234.5678123, 4), "-1234,5678");
  assert.equal(numbers.fixed(-1234.6951123, 4), "-1234,6951");
  assert.equal(numbers.fixed(142.37, 0), "142");
  assert.equal(numbers.fixed(124.76, 1), "124,8");
  assert.equal(numbers.fixed(180, 1), "180");
  assert.equal(numbers.fixed(-0.000001, 1), "0"); // Geometric numerical noise is not extra precision.
  for (const zero of [0, -0]) {
    assert.equal(numbers.fixed(zero, 4), "0");
    assert.equal(numbers.significant(zero, 2), "0");
  }
  assert.equal(numbers.significant(0.1273, 3), "0,127");
  assert.equal(numbers.significant(12.283, 3), "12,3");
  assert.equal(numbers.significant(.0356, 2), "0,036");
  assert.equal(numbers.significant(.2252, 2), "0,23");
  const tiny = numbers.significant(5.321e-31, 2);
  assert.equal(tiny, "5,3 × 10⁻³¹");
  assert.equal(numbers.spoken(tiny), "5,3 mal zehn hoch minus 31");
  assert.equal(numbers.spoken(numbers.significant(-1.234e-7, 3)), "minus 1,23 mal zehn hoch minus 7");
  assert.ok(numbers.html(tiny).includes('role="math" aria-label="5,3 mal zehn hoch minus 31"'));
  assert.ok(!numbers.html('<script>"' + tiny).includes("<script>"));
});

test("frequency thresholds and percentage endpoints remain truthful after display rounding", () => {
  const numbers = globalThis.ScientificDisplay;
  assert.deepEqual([-19.96, -20, -20.04].map((value) => numbers.frequency(value)), ["knapp unter 20", "20", "knapp über 20"]);
  assert.equal([-19.96, -20, -20.04].filter((value) => Math.abs(value) > 20).length, 1);
  assert.deepEqual([0, 0.04, 73.456, 99.96, 100].map((value) => numbers.percent(value)), ["0", "<0,1", "73,5", ">99,9", "100"]);
});

test("local comparison precision distinguishes close values and marks remaining rounded equality", () => {
  const numbers = globalThis.ScientificDisplay;
  assert.deepEqual(numbers.compare([3.0011, 3.0012], "energy"), ["3,0011", "3,0012"]);
  assert.deepEqual(numbers.compare([.2341, .2342], "strength"), ["0,2341", "0,2342"]);
  assert.deepEqual(numbers.compare([.234100001, .234100002], "strength"), ["0,2341 (gerundet gleich)", "0,2341 (gerundet gleich)"]);
  assert.deepEqual(numbers.compare([.2, .2], "strength"), ["0,2", "0,2"]);
});

test("human reports and collision labels contain chemical names and calculation numbers without technical IDs", () => {
  const lab = accessibleLab("?text=1");
  lab.molecule.id = "aabbccddeeff00112233445566778899";
  lab.molecule.name = "cis-Azobenzol";
  lab.state.molecules[1].name = "trans-Azobenzol";
  lab.state.molecules[1].id = "ffeeddccbbaa99887766554433221100";
  lab.state.molecules.push({...lab.molecule, id: "0123456789abcdef0123456789abcdef"});
  lab.view.render();
  const options = lab.node("accessible-molecule-select").options.map((option) => option.text).join(" ");
  assert.ok(options.includes("Berechnung 1") && options.includes("Berechnung 2"));
  lab.node("data-report").onclick();
  for (const molecule of lab.state.molecules) {
    for (const output of [options, lab.node("result-report-content").innerHTML, lab.exported().content]) assert.ok(!output.includes(molecule.id));
  }
  assert.ok(!lab.exported().content.includes("Gespeicherte Kennung"));
  lab.node("data-json").onclick();
  assert.ok(lab.exported().content.includes(lab.molecule.id)); // Deliberately chosen machine data retains provenance.
});

test("reaction paths are directly open with short choices while optimization iterations remain optional", () => {
  const lab = accessibleLab("?text=1");
  lab.state.step = "optimize";
  lab.molecule.ts_search = {path: [{image: 0, energy_ev: -10, positions: [0, 0, 0, 1, 0, 0, 1, 2, 0]}, {image: 1, energy_ev: -9.8, positions: [0, 0, 0, 2, 0, 0, 2, 2, 0]}]};
  lab.view.render();
  assert.equal(lab.node("accessible-path").hidden, false);
  assert.equal(lab.node("accessible-path").open, true);
  assert.equal(lab.node("accessible-path-summary").hidden, true);
  assert.equal(lab.node("path-point").options[1].text, "Pfadstruktur 1");
  lab.records.push({step: 0, energy_ev: -10, positions: [0, 0, 0]}, {step: 1, energy_ev: -9, positions: [0, 0, 0]});
  lab.select({...lab.molecule, id: "iteration", ts_search: null});
  assert.equal(lab.node("accessible-path").hidden, false);
  assert.equal(lab.node("accessible-path").open, false);
  assert.equal(lab.node("accessible-path-summary").hidden, false);
  lab.node("accessible-path").open = true;
  lab.view.render();
  assert.equal(lab.node("accessible-path").open, true);
});

test("all positive visible transitions supplement the strongest five without duplication, with consistent strength sorting", () => {
  const lab = accessibleLab("?text=1");
  lab.molecule.spectrum = {energy_ev: [1.5, 3.2, 5.5], absorption: [0, 1, 0],
    excitations_ev: [1.8, 2.1, 2.8, 4, 4.5, 5, 5.2, 5.4], oscillator_strengths: [.03, .001, 0, .1, .2, .3, .4, .5]};
  const original = JSON.stringify(lab.molecule.spectrum);
  lab.view.render();
  const sections = lab.view.reportSections;
  const strongest = sections.find((section) => section.title === "Stärkste elektronische Übergänge").rows;
  const visible = sections.find((section) => section.title === "Weitere Übergänge im sichtbaren Bereich").rows;
  assert.deepEqual(Array.from(strongest, (row) => row[0]), [8, 7, 6, 5, 4]);
  assert.deepEqual(Array.from(visible, (row) => row[0]), [1, 2]);
  const full = lab.node("transition-table-body").options.map((row) => Number(row.children[0].textContent));
  assert.deepEqual(Array.from(full), [8, 7, 6, 5, 4, 1, 2, 3]); // f = 0 remains in the complete list.
  assert.equal(JSON.stringify(lab.molecule.spectrum), original);
  const tie = data.strongestTransitions({energy_ev: [1, 5], absorption: [0, 1], excitations_ev: [4, 3, 3], oscillator_strengths: [.5, .5, .5]});
  assert.deepEqual(tie.map((transition) => transition.index), [2, 3, 1]);
});

test("short tables do not add tab stops and overflowing tables remain keyboard reachable after opening or zoom", () => {
  const lab = accessibleLab("?text=1"), region = lab.node("test-region");
  lab.regions.push(region);
  region.dataset = {};
  region.setAttribute("role", "region");
  region.setAttribute("aria-label", "Energiedaten");
  region.clientWidth = 600;
  region.scrollWidth = 550;
  lab.view.updateTableFocus();
  assert.equal(region.hasAttribute("tabindex"), false);
  assert.equal(region.hasAttribute("role"), false); // No landmark for a table without scrolling.
  assert.equal(region.hasAttribute("aria-label"), false);
  region.clientWidth = 250;
  lab.events.get("resize")();
  assert.equal(region.getAttribute("tabindex"), "0");
  assert.equal(region.getAttribute("role"), "region");
  assert.equal(region.getAttribute("aria-label"), "Energiedaten");
  region.clientWidth = region.scrollWidth = 0;
  lab.events.get("toggle")();
  assert.equal(region.hasAttribute("tabindex"), false);
  region.clientWidth = 250;
  region.scrollWidth = 550;
  lab.events.get("toggle")();
  assert.equal(region.getAttribute("tabindex"), "0");
});

test("unit conversion preserves the active input and emits four-significant-digit editable decimal values", () => {
  const nodes = new Map(), node = (id) => {
    if (!nodes.has(id)) nodes.set(id, {value: "", textContent: "", setAttribute() {}});
    return nodes.get(id);
  };
  const context = vm.createContext({ScientificDisplay: globalThis.ScientificDisplay, $: node, AccessibleData: data, EV_KJ: 96.48533212331002, HC: 1239.8419843320026});
  const app = fs.readFileSync("src/photoswitchlab/web/static/app.js", "utf8");
  vm.runInContext(app.slice(app.indexOf("function convert(source)"), app.indexOf('for (const key of ["ev", "kj", "nm"])\n  $("convert-" + key).oninput')), context);
  for (const input of ["1,2345", "1.2345"]) {
    node("convert-ev").value = input;
    context.convert("ev");
    assert.equal(node("convert-ev").value, input);
    assert.equal(node("convert-kj").value, "119,1");
    assert.equal(node("convert-nm").value, "1004");
  }
  node("convert-ev").value = "0,0000001";
  context.convert("ev");
  assert.equal(node("convert-kj").value, "0,000009649");
  assert.equal(node("convert-nm").value, "12400000000");
  assert.equal(data.decimal(node("convert-nm").value), 12400000000);
  node("convert-ev").value = "1,";
  context.convert("ev");
  assert.equal(node("convert-ev").value, "1,");
});

test("close paired maxima and absorption values keep distinguishable displays without changing exported raw data", () => {
  const lab = accessibleLab("?text=1");
  const partner = lab.state.molecules[1];
  lab.molecule.properties.energy_ev = -1234.567812345;
  lab.molecule.spectrum = {energy_ev: [1.5, 3.0011, 5.5], absorption: [0, .2341, 0], excitations_ev: [3.0011, 3.0012], oscillator_strengths: [1.23e-28, .2]};
  partner.spectrum = {...lab.molecule.spectrum, energy_ev: [1.5, 3.0012, 5.5], absorption: [0, .2342, 0]};
  lab.view.render();
  const pair = lab.view.reportSections.find((section) => section.title === "Zugehöriges cis/trans-Paar");
  assert.deepEqual(Array.from(pair.rows, (row) => row[2]), ["3,0011", "3,0012"]);
  const transitions = lab.node("transition-table-body").options;
  assert.equal(transitions.length, 2);
  assert.equal(transitions[0].children[1].textContent, "3,0012");
  assert.equal(transitions[1].children[1].textContent, "3,0011");
  assert.equal(transitions[0].children[2].textContent, "413");
  assert.equal(transitions[1].children[2].textContent, "413");
  lab.node("curve-energy").value = "3,00115";
  lab.node("curve-query").onclick();
  assert.match(lab.node("curve-value").innerHTML, /0,2341|0,2342/);
  lab.node("data-json").onclick();
  const exported = JSON.parse(lab.exported().content);
  assert.equal(exported.molecule.properties.energy_ev, -1234.567812345);
  assert.equal(exported.molecule.spectrum.oscillator_strengths[0], 1.23e-28);
  assert.deepEqual(exported.molecule.spectrum.excitations_ev, [3.0011, 3.0012]);
});

test("Enter queries absorption and atom list changes update text without live announcements", () => {
  const lab = accessibleLab("?text=1");
  lab.view.render();
  lab.node("curve-energy").value = "1,5";
  let prevented = false;
  lab.node("curve-energy").onkeydown({key: "Enter", preventDefault: () => { prevented = true; }});
  assert.ok(prevented);
  assert.ok(lab.node("curve-value").innerHTML.includes("Relative Absorption bei 1,5 eV"));
  lab.node("accessible-status").textContent = "";
  lab.node("atom-second").value = "2";
  lab.node("atom-second").onchange();
  assert.ok(lab.node("atom-distance").textContent.startsWith("Abstand"));
  assert.equal(lab.node("accessible-status").textContent, ""); // The result follows the list directly.
});

test("running optimizations keep step tables hidden and unchanged until the result is complete", () => {
  const lab = accessibleLab("?text=1");
  lab.state.step = "optimize";
  lab.records.push({step: 0, energy_ev: -10, positions: [0, 0, 0, 1, 0, 0, 1, 2, 0]});
  lab.state.busy = true;
  lab.view.render();
  assert.equal(lab.node("accessible-path").hidden, true);
  const before = lab.mutations();
  lab.records.push({step: 1, energy_ev: -10.2, positions: [0, 0, 0, 1, 0, 0, 1, 2, 0]});
  lab.view.render();
  assert.equal(lab.node("path-point").options.length, 0); // Not rebuilt for each live step.
  assert.ok(lab.mutations() - before < 5);
  lab.state.busy = false;
  lab.view.render();
  assert.equal(lab.node("accessible-path").hidden, false);
  assert.equal(lab.node("path-point").options.length, 3);
});
