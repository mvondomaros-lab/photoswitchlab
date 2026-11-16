/* Shared result data for visual and nonvisual exploration. No network services. */
"use strict";
/* Display precision never changes stored values or scientific decisions. */
globalThis.ScientificDisplay = {
  note: "Die Anzeige ist gerundet; Berechnungen und Rohdaten behalten die ungerundeten Werte. Absolute elektronische Energien haben bis zu vier Nachkommastellen, damit Sie Energiedifferenzen bestimmen können. Nahe Vergleichswerte können zusätzliche Stellen erhalten.",
  fixed(value, digits = 2) {
    if (!Number.isFinite(value)) return "nicht verfügbar";
    const rounded = Number(value.toFixed(digits));
    return (rounded === 0 ? 0 : rounded).toLocaleString("de-DE", {useGrouping: false, maximumFractionDigits: digits});
  },
  significant(value, digits = 2) {
    if (!Number.isFinite(value)) return "nicht verfügbar";
    if (value === 0) return "0";
    const rounded = Number(value.toPrecision(digits));
    if (Math.abs(rounded) >= 0.001 && Math.abs(rounded) < 100000) return rounded.toLocaleString("de-DE", {useGrouping: false, maximumSignificantDigits: digits});
    const [mantissa, exponent] = value.toExponential(digits - 1).split("e");
    const power = String(Number(exponent)).replace(/[-0-9]/g, (character) => "⁻⁰¹²³⁴⁵⁶⁷⁸⁹"["-0123456789".indexOf(character)]);
    return `${Number(mantissa).toLocaleString("de-DE", {useGrouping: false, maximumSignificantDigits: digits})} × 10${power}`;
  },
  compare(values, kind = "energy") {
    const format = kind === "energy" ? this.fixed.bind(this) : this.significant.bind(this);
    return values.map((value) => {
      if (!Number.isFinite(value)) return "nicht verfügbar";
      let digits = 2;
      const collides = () => values.some((other) => Number.isFinite(other) && other !== value && format(other, digits) === format(value, digits));
      while (digits < 4 && collides()) digits++;
      return format(value, digits) + (collides() ? " (gerundet gleich)" : "");
    });
  },
  percent(value) {
    if (!Number.isFinite(value)) return "nicht verfügbar";
    const text = this.fixed(value, 1);
    if (value > 0 && value < 100 && text === "0") return "<0,1";
    if (value > 0 && value < 100 && text === "100") return ">99,9";
    return text;
  },
  frequency(value) {
    if (!Number.isFinite(value)) return "nicht verfügbar";
    const magnitude = Math.abs(value);
    if (Math.round(magnitude) === 20 && magnitude !== 20) return magnitude < 20 ? "knapp unter 20" : "knapp über 20";
    return this.fixed(magnitude, 0);
  },
  converter(value) {
    return Number.isFinite(value) ? (value === 0 ? 0 : value).toLocaleString("de-DE", {useGrouping: false, maximumSignificantDigits: 4}) : "";
  },
  spoken(text) {
    return String(text).replace(/(-?\d+(?:,\d+)?) × 10([⁻⁰¹²³⁴⁵⁶⁷⁸⁹]+)/g, (_match, coefficient, power) => {
      const exponent = power.replace(/[⁻⁰¹²³⁴⁵⁶⁷⁸⁹]/g, (character) => "-0123456789"["⁻⁰¹²³⁴⁵⁶⁷⁸⁹".indexOf(character)]);
      return `${coefficient.replace(/^-/, "minus ")} mal zehn hoch ${exponent.replace(/^-/, "minus ")}`;
    });
  },
  html(text) {
    const escaped = String(text ?? "").replace(/[&<>"']/g, (character) => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"})[character]);
    return escaped.replace(/-?\d+(?:,\d+)? × 10[⁻⁰¹²³⁴⁵⁶⁷⁸⁹]+/g, (value) => `<span role="math" aria-label="${this.spoken(value)}">${value}</span>`);
  },
  setText(element, text) {
    if (element.textContent === text) return;
    element.textContent = text;
    if (this.spoken(text) !== text) element.innerHTML = this.html(text);
  },
};

globalThis.AccessibleData = {
  decimal(text) {
    const value = String(text).trim();
    if (!/^[+-]?(?:\d+(?:[.,]\d+)?|[.,]\d+)$/.test(value)) return null;
    const parsed = Number(value.replace(",", "."));
    return Number.isFinite(parsed) ? parsed : null;
  },
  derivativeKey(settings) {
    const allowed = new Set(["H", "Me", "OMe", "NMe2", "CF3", "CN", "NO2"]);
    if (!["cis", "trans"].includes(settings?.configuration) || !Array.isArray(settings.substituents) ||
        settings.substituents.length !== 10 || settings.substituents.some((value) => !allowed.has(value))) return null;
    const first = settings.substituents.slice(0, 5), second = settings.substituents.slice(5);
    // Each phenyl ring can be numbered in either direction; the rings can be exchanged.
    const orientations = [];
    for (const a of [first, [...first].reverse()]) for (const b of [second, [...second].reverse()]) {
      orientations.push(JSON.stringify([...a, ...b]), JSON.stringify([...b, ...a]));
    }
    return orientations.sort()[0];
  },
  partner(molecule, molecules, spectral = false) {
    const key = this.derivativeKey(molecule?.settings);
    if (!key || molecule.kind !== "minimum" || molecule.converged !== true || (spectral && !this.curveOverview(molecule.spectrum))) return null;
    const candidates = molecules.filter((other) => other.id !== molecule.id && other.kind === "minimum" && other.converged === true &&
      other.settings?.configuration !== molecule.settings.configuration && this.derivativeKey(other.settings) === key &&
      (!spectral || this.curveOverview(other.spectrum)));
    // Multiple calculated conformers need an explicit scientific choice, not a latest-item heuristic.
    return candidates.length === 1 ? candidates[0] : null;
  },
  strongestTransitions(spectrum, count = 5) {
    const curve = this.curveOverview(spectrum);
    if (!curve) return [];
    const low = spectrum.energy_ev[0], high = spectrum.energy_ev.at(-1);
    return (spectrum.excitations_ev || []).map((energy, index) => ({index: index + 1, energy, strength: spectrum.oscillator_strengths?.[index]}))
      .filter(({energy, strength}) => Number.isFinite(energy) && energy >= low && energy <= high && Number.isFinite(strength) && strength > 0)
      .sort((a, b) => b.strength - a.strength || a.energy - b.energy || a.index - b.index).slice(0, count);
  },
  curveMaximum(spectrum) {
    const curve = this.curveOverview(spectrum);
    if (!curve || curve.flat) return null;
    const index = spectrum.absorption.indexOf(curve.maximum);
    return {energy: spectrum.energy_ev[index], value: curve.maximum,
      boundary: index === 0 || index === spectrum.energy_ev.length - 1,
      multiple: spectrum.absorption.filter((value) => value === curve.maximum).length > 1};
  },
  substituentName(value) {
    return {Me: "Methylgruppe", OMe: "Methoxygruppe", NMe2: "Dimethylaminogruppe", CF3: "Trifluormethylgruppe", CN: "Cyanogruppe", NO2: "Nitrogruppe"}[value] || value;
  },
  // Nearest ring position in the bond sequence; substituent atoms inherit it.
  ringReference(graph, index) {
    const atom = graph[index];
    let position = atom?.position;
    if (atom && !position) {
      const seen = new Set([atom.number]), pending = [...(atom.neighbors || []).map((n) => n.number)];
      while (pending.length && !position) {
        const number = pending.shift();
        if (seen.has(number)) continue;
        seen.add(number);
        const neighbor = graph[number - 1];
        if (!neighbor) continue;
        position = neighbor.position;
        if (!position) pending.push(...neighbor.neighbors.map((n) => n.number));
      }
    }
    return position;
  },
  atomLabel(graph, index, settings) {
    const atom = graph[index];
    if (!atom) return "Atom nicht verfügbar";
    const position = this.ringReference(graph, index);
    const site = position?.match(/^C([2-6])(′)?$/);
    const substituent = site && settings?.substituents?.[Number(site[1]) - 2 + (site[2] ? 5 : 0)];
    const group = substituent && substituent !== "H" ? `, ${atom.position ? "trägt " : "zugeordnet: "}${this.substituentName(substituent)}` : "";
    const azo = atom.element === "N" && atom.neighbors?.some((neighbor) => graph[neighbor.number - 1]?.element === "N" && neighbor.bond_order === 2) ? ", Azogruppe" : "";
    // Name the ring explicitly: screen readers may not speak the prime of C2′.
    const ring = position ? (position.endsWith("′") ? " im zweiten Ring" : " im ersten Ring") : "";
    return `Atom ${atom.number} (${atom.element}${position ? `, ${atom.position ? "Ringposition" : "Ringbezug"} ${position}${ring}` : ""}${group}${azo})`;
  },
  // Short chemical name for distance lists: group and ring position, no atom number.
  atomName(graph, index, settings) {
    const atom = graph[index];
    if (!atom) return "Atom nicht verfügbar";
    const position = this.ringReference(graph, index);
    if (!position) return atom.element;
    const site = position.match(/^C([2-6])(′)?$/);
    const substituent = site && settings?.substituents?.[Number(site[1]) - 2 + (site[2] ? 5 : 0)];
    // Screen readers may not speak the prime, so the second ring is also named.
    const at = position.endsWith("′") ? `${position} im zweiten Ring` : position;
    if (atom.element === "N" && atom.neighbors?.some((neighbor) => graph[neighbor.number - 1]?.element === "N")) return `N der Azogruppe an ${at}`;
    if (atom.position) return `Ringatom ${at}`;
    if (substituent && substituent !== "H") return `${atom.element} der ${this.substituentName(substituent)} an ${at}`;
    return `${atom.element} an ${at}`;
  },
  outputMethods: [
    "Kurvenabfragen: Zwischen gespeicherten Kurvenpunkten wird die relative Absorption linear interpoliert.",
    "Farbvergleich: CIE76 ist der Abstand der berechneten sRGB-Bildschirmfarben im CIE-L*a*b*-Farbraum mit D65-Referenzweiß. Größere Werte bedeuten größere Modellabstände, keine proportional empfundenen Unterschiede. Die Umrechnung begrenzt die Farben auf sRGB. Beide Farben verwenden dieselbe feste Absorbanzskalierung.",
  ],
  curveOverview(spectrum) {
    const energy = spectrum?.energy_ev, values = spectrum?.absorption;
    if (!Array.isArray(energy) || !Array.isArray(values) || energy.length < 2 || energy.length !== values.length ||
        energy.some((e, i) => !Number.isFinite(e) || e <= 0 || (i && e <= energy[i - 1])) || values.some((value) => !Number.isFinite(value) || value < 0)) return null;
    const visibleLow = 1239.8419843320026 / 780, visibleHigh = 1239.8419843320026 / 380;
    const maximum = Math.max(...values), flat = values.every((value) => value === values[0]);
    const peaks = [];
    for (let first = 0; first < values.length;) {
      let last = first;
      while (last + 1 < values.length && values[last + 1] === values[first]) last++;
      if (first > 0 && last < values.length - 1 && values[first] > values[first - 1] && values[last] > values[last + 1]) peaks.push({first, last, low: energy[first], high: energy[last], height: values[first], visible: energy[last] >= visibleLow && energy[first] <= visibleHigh});
      first = last + 1;
    }
    const overlapLow = Math.max(energy[0], visibleLow), overlapHigh = Math.min(energy.at(-1), visibleHigh);
    const visibleValues = values.filter((_value, i) => energy[i] >= visibleLow && energy[i] <= visibleHigh);
    const changes = visibleValues.slice(1).map((value, i) => Math.sign(value - visibleValues[i])).filter(Boolean);
    const trend = visibleValues.length < 2 ? null : !changes.length ? "flat" : changes.every((value) => value > 0) ? "rising" : changes.every((value) => value < 0) ? "falling" : null;
    return {maximum, flat, peaks, lowerBoundaryHighest: !flat && values[0] === maximum, upperBoundaryHighest: !flat && values.at(-1) === maximum,
      visible: {coverage: overlapLow > overlapHigh ? "none" : energy[0] <= visibleLow && energy.at(-1) >= visibleHigh ? "full" : "partial", low: overlapLow, high: overlapHigh, samples: visibleValues.length, trend}};
  },
  visibleCoverage(spectrum) {
    const curve = this.curveOverview(spectrum);
    if (!curve) return "";
    const fmt = (value) => ScientificDisplay.fixed(value, 0);
    return curve.visible.coverage === "full" ? "Sichtbarer Bereich (380–780 nm): vollständig abgedeckt."
      : curve.visible.coverage === "none" ? "Der sichtbare Bereich (380–780 nm) liegt außerhalb des berechneten Energiebereichs."
      : `Sichtbarer Bereich (380–780 nm): nur von ${fmt(1239.8419843320026 / curve.visible.high)} bis ${fmt(1239.8419843320026 / curve.visible.low)} nm abgedeckt.`;
  },
  // Coarse common energy grid for sonification: one point per 0.05 eV is fine enough to
  // hear band shapes and few enough to step through with arrow keys.
  sonificationSeries(entries, step = 0.05) {
    const valid = entries.filter(({spectrum}) => this.curveOverview(spectrum));
    if (!valid.length) return [];
    const low = Math.max(...valid.map(({spectrum}) => spectrum.energy_ev[0]));
    const high = Math.min(...valid.map(({spectrum}) => spectrum.energy_ev.at(-1)));
    if (!(high > low)) return [];
    const count = Math.floor((high - low) / step + 1e-9);
    const grid = Array.from({length: count + 1}, (_, i) => Number((low + i * step).toFixed(6)));
    if (grid.at(-1) < high - 1e-9) grid.push(high);
    return valid.map(({name, spectrum}) => ({name, points: grid.map((x) => ({x, y: this.absorption(spectrum, x)}))}));
  },
  coordinates(xyz) {
    return (xyz || "").trim().split("\n").slice(2).flatMap((line) =>
      line.trim().split(/\s+/).slice(1, 4).map(Number));
  },
  // Shortest distances between the two halves of the molecule (first ring with its
  // substituents and azo nitrogen versus the primed side), more than three bonds apart.
  closeContacts(graph, positions, count = 5) {
    const side = graph.map((_atom, index) => { const reference = this.ringReference(graph, index); return reference ? reference.endsWith("′") : null; });
    const near = graph.map((_atom, start) => {
      const seen = new Set([start]);
      let frontier = [start];
      for (let depth = 0; depth < 3; depth++) {
        frontier = frontier.flatMap((index) => (graph[index]?.neighbors || []).map((neighbor) => neighbor.number - 1)
          .filter((next) => !seen.has(next) && seen.add(next)));
      }
      return seen;
    });
    const pairs = [];
    for (let first = 0; first < graph.length; first++) {
      for (let second = first + 1; second < graph.length; second++) {
        const across = side[first] != null && side[second] != null && side[first] !== side[second];
        const distance = !across || near[first].has(second) ? null : this.distance(positions, first, second);
        // The atom from the unprimed ring comes first, so every entry reads in the same order.
        if (distance != null) pairs.push(side[first] ? {first: second, second: first, distance} : {first, second, distance});
      }
    }
    return pairs.sort((a, b) => a.distance - b.distance || a.first - b.first || a.second - b.second).slice(0, count);
  },
  distance(positions, first, second) {
    if (!positions || !Number.isInteger(first) || !Number.isInteger(second)) return null;
    const a = positions.slice(first * 3, first * 3 + 3);
    const b = positions.slice(second * 3, second * 3 + 3);
    return a.length === 3 && b.length === 3 && [...a, ...b].every(Number.isFinite)
      ? Math.hypot(...a.map((value, i) => value - b[i])) * 100 : null;
  },
  absorption(spec, energy) {
    if (!Number.isFinite(energy) || !spec?.energy_ev?.length ||
        energy < spec.energy_ev[0] || energy > spec.energy_ev.at(-1)) return null;
    const i = spec.energy_ev.findIndex((value) => value >= energy);
    if (spec.energy_ev[i] === energy) return spec.absorption[i];
    const fraction = (energy - spec.energy_ev[i - 1]) / (spec.energy_ev[i] - spec.energy_ev[i - 1]);
    return spec.absorption[i - 1] + fraction * (spec.absorption[i] - spec.absorption[i - 1]);
  },
  angle(positions, first, vertex, third) {
    const vector = (i) => [0, 1, 2].map((axis) => positions?.[3 * i + axis] - positions?.[3 * vertex + axis]);
    const a = vector(first), b = vector(third), length = Math.hypot(...a) * Math.hypot(...b);
    if (![...a, ...b].every(Number.isFinite) || length < 1e-12) return null;
    return Math.acos(Math.max(-1, Math.min(1, a.reduce((sum, value, i) => sum + value * b[i], 0) / length))) * 180 / Math.PI;
  },
  color(rgb) {
    if (!rgb) return "Keine Farbschätzung verfügbar.";
    const max = Math.max(...rgb), min = Math.min(...rgb), delta = max - min;
    if (max < 35) return "annähernd schwarz";
    if (delta < 20) return min > 230 ? "nahezu farblos" : "annähernd grau";
    const [r, g, b] = rgb;
    let hue = max === r ? ((g - b) / delta) % 6 : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4;
    hue = (hue * 60 + 360) % 360;
    const name = hue < 20 || hue >= 340 ? "rot" : hue < 45 ? "orange" : hue < 75 ? "gelb" : hue < 165 ? "grün" : hue < 200 ? "türkis" : hue < 260 ? "blau" : hue < 290 ? "violett" : "magenta";
    return `${max < 120 ? "dunkel, " : ""}${name}`;
  },
  lab(rgb) {
    // sRGB -> XYZ D65 -> CIELAB with D65 reference white. Display RGB is
    // intentionally used after gamut clipping, matching the visible swatch.
    if (!Array.isArray(rgb) || rgb.length !== 3 || rgb.some((v) => !Number.isFinite(v) || v < 0 || v > 255)) return null;
    const linear = rgb.map((v) => v / 255).map((v) => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
    const matrix = [[0.4124564, 0.3575761, 0.1804375], [0.2126729, 0.7151522, 0.0721750], [0.0193339, 0.1191920, 0.9503041]];
    const white = [0.95047, 1, 1.08883];
    const f = matrix.map((row, i) => row.reduce((sum, v, j) => sum + v * linear[j], 0) / white[i])
      .map((v) => v > 216 / 24389 ? Math.cbrt(v) : ((24389 / 27) * v + 16) / 116);
    return [116 * f[1] - 16, 500 * (f[0] - f[1]), 200 * (f[1] - f[2])];
  },
  colorDistance(first, second) {
    const a = this.lab(first), b = this.lab(second);
    return a && b ? Math.hypot(...a.map((v, i) => v - b[i])) : null;
  },
  reportBody(sections, focusTables = false) {
    const escape = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"})[c]);
    return sections.map(({title, paragraphs = [], rows = [], columns, optional = false}) => {
      const body =
      paragraphs.map((p) => `<p>${ScientificDisplay.html(p)}</p>`).join("") +
      (rows.length ? `<div class="table-scroll"${focusTables ? ' tabindex="0"' : ""} role="region" aria-label="${escape(ScientificDisplay.spoken(title))}"><table><caption class="sr-only">${escape(ScientificDisplay.spoken(title))}</caption><thead><tr>${(columns || ["Größe oder Angabe", "Wert"]).map((label) => `<th scope="col">${escape(label)}</th>`).join("")}</tr></thead><tbody>` + rows.map((row) => `<tr>${row.map((value, index) => index ? `<td>${ScientificDisplay.html(value)}</td>` : `<th scope="row">${ScientificDisplay.html(value)}</th>`).join("")}</tr>`).join("") + "</tbody></table></div>" : "");
      return optional ? `<details><summary>${ScientificDisplay.html(title)}</summary>${body}</details>` : `<section><h3>${ScientificDisplay.html(title)}</h3>${body}</section>`;
    }).join("");
  },
  report(sections, created) {
    return `<!doctype html><html lang="de"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>PhotoSwitchLab Ergebnisbericht</title><style>body{font:1rem/1.6 system-ui,sans-serif;max-width:90ch;margin:2rem auto;padding:0 1rem;color:#192d43;background:white}h1,h2,h3{line-height:1.3}section{margin:2rem 0}.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap;border:0}.table-scroll{overflow-x:auto}table{border-collapse:collapse;width:100%}caption{text-align:left;font-weight:600}th,td{border:1px solid #b8c4d0;padding:.5rem;text-align:left;overflow-wrap:anywhere}thead{background:#edf2f7}@media(max-width:400px){th,td{padding:.3rem}}@media print{body{max-width:none;margin:0}}</style><main><h1>PhotoSwitchLab Ergebnisbericht</h1>${created ? `<p>Erstellt am ${created.toLocaleString("de-DE", {dateStyle: "long", timeStyle: "short"})}.</p>` : ""}<p>Aktuelle Rechenergebnisse und zugehörige Vergleiche. Wissenschaftliche Deutungen ergänzen Sie selbst im Protokoll.</p>${this.reportBody(sections, true)}</main></html>`;
  },
  csv(rows) {
    return rows.map((row) => row.map((value) => {
      const text = value == null ? "" : String(value);
      return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
    }).join(",")).join("\r\n");
  },
};

globalThis.AccessibilityView = {
  prefersText: false,
  initialize(context) {
    const $ = (id) => document.getElementById(id), data = AccessibleData;
    const layout = globalThis.PresentationLayout?.create(document);
    const setText = (id, text) => ScientificDisplay.setText($(id), text);
    const fmt = (value, digits = 2) => ScientificDisplay.fixed(value, digits);
    const preference = $("text-preference"), graphicPreference = $("graphic-preference");
    const query = new URLSearchParams(location.search).get("text");
    let saved = false;
    try { saved = localStorage.getItem("photoswitchlab.textPreferred") === "true"; } catch { /* Optional persistence. */ }
    preference.checked = query === "1" || (query !== "0" && saved);
    graphicPreference.checked = !preference.checked;
    if (query === "1" || query === "0") {
      try { localStorage.setItem("photoswitchlab.textPreferred", String(preference.checked)); } catch { /* Optional persistence. */ }
    }
    const disclosurePreference = {graphical: $("accessible-results").open, text: true};
    const applyPreference = () => {
      this.prefersText = preference.checked;
      document.body.classList.toggle("text-preferred", this.prefersText);
      $("accessible-results").open = disclosurePreference[this.prefersText ? "text" : "graphical"];
      layout?.apply(this.prefersText, context.state.step);
    };
    this.announce = (message) => setText("accessible-status", message);
    applyPreference();
    const changePreference = () => {
      disclosurePreference[this.prefersText ? "text" : "graphical"] = $("accessible-results").open;
      applyPreference();
      try { localStorage.setItem("photoswitchlab.textPreferred", String(preference.checked)); } catch { /* Optional persistence. */ }
      context.render();
      context.presentationChanged?.();
      this.announce(this.prefersText ? "Barrierearmer Arbeitsmodus aktiviert." : "Grafischer Arbeitsmodus aktiviert.");
    };
    preference.onchange = graphicPreference.onchange = changePreference;
    let moleculeKey = null, graphKey = null, pointIndex = null, points = [], path = false;
    let positions = [], graph = [], csvRows = [], tableSignature = "", selectorSignature = "";
    let curveQuery = null, contactSignature = "", measurementSelected = false, reportSections = [], querySections = [], measurementSections = [], methodSections = [];
    let colorComparisonRecord = null;
    const rendered = new Map();
    const updateTableFocus = () => {
      document.querySelectorAll?.(".table-scroll").forEach((region) => {
        if (!Number.isFinite(region.clientWidth) || !Number.isFinite(region.scrollWidth)) return;
        const overflow = region.clientWidth > 0 && region.scrollWidth > region.clientWidth + 1;
        // A non-scrolling table needs no extra landmark; its caption already names it.
        if (region.dataset && region.hasAttribute("aria-label")) region.dataset.regionLabel = region.getAttribute("aria-label");
        if (overflow && region.getAttribute("tabindex") !== "0") {
          region.setAttribute("tabindex", "0");
          region.setAttribute("role", "region");
          if (region.dataset?.regionLabel) region.setAttribute("aria-label", region.dataset.regionLabel);
        } else if (!overflow && (region.hasAttribute("tabindex") || region.hasAttribute("role"))) {
          region.removeAttribute("tabindex");
          region.removeAttribute("role");
          region.removeAttribute("aria-label");
        }
      });
    };
    document.addEventListener?.("toggle", updateTableFocus, true);
    globalThis.addEventListener?.("resize", updateTableFocus);
    this.updateTableFocus = updateTableFocus;
    setText("curve-interpolation-note", data.outputMethods[0]);
    setText("display-rounding-note", ScientificDisplay.note);
    function display(id, sections) {
      const content = data.reportBody(sections);
      if (rendered.get(id) !== content) { $(id).innerHTML = content; rendered.set(id, content); updateTableFocus(); }
    }
    function fillSelect(select, options, value) {
      select.replaceChildren(...options.map(([label, key]) => new Option(label, key)));
      if (value != null && [...select.options].some((option) => option.value === String(value))) select.value = value;
    }
    const strength = (value) => ScientificDisplay.significant(value, 2);
    const kjPerEv = 96.48533212331002;
    let pathSonification = null;
    // Chart2Music makes the energy profile explorable by pitch and speech; accessible mode only,
    // since sound in a shared lab room must never start by accident.
    const renderPathSonification = (profile) => {
      const element = $("path-sonification");
      element.hidden = $("path-sonification-hint").hidden = !profile || !globalThis.c2mChart;
      if (element.hidden || pathSonification?.key === profile.key) return;
      const points = profile.relative.map((y, index) => ({x: index + 1, y}));
      const axes = {
        x: {label: "Pfadstruktur", format: (x) => `Pfadstruktur ${x}, C–N=N–C ${fmt(profile.dihedrals[x - 1], 0)} °`},
        y: {label: "ΔE zum Anfang / (kJ/mol)", format: (y) => `${ScientificDisplay.significant(y, 3)} kJ/mol`},
      };
      try {
        if (pathSonification) pathSonification.chart.setData(points, axes);
        else {
          const {err, data: chart} = globalThis.c2mChart({type: "line", element, cc: $("path-sonification-cc"), lang: "de",
            title: "Energieverlauf entlang des Reaktionspfads", data: points, axes, audioEngine: globalThis.SonificationAudio?.()});
          if (err) throw new Error(err);
          pathSonification = {chart};
        }
        pathSonification.key = profile.key;
      } catch (exc) {
        element.hidden = $("path-sonification-hint").hidden = true;
        console.warn("Sonification unavailable", exc);
      }
    };
    const identity = (m) => {
      const label = context.label(m);
      const collisions = context.state.molecules.filter((other) => context.label(other) === label && other.kind === m.kind);
      if (collisions.length < 2) return label;
      const number = collisions.findIndex((other) => other.id === m.id) + 1;
      return `${label} · Berechnung ${number || 1}`;
    };
    const kind = (m) => ({initial: "Startstruktur", minimum: "Minimumstruktur", ts: "Übergangsstruktur", unconverged: "Optimierung nicht abgeschlossen"})[m.kind] || m.kind;
    const recordLabel = (m) => `${identity(m)} · ${kind(m)}`;
    const source = (m) => context.state.molecules.find((other) => other.id === m.parent_id);
    const windowText = (m) => `${fmt(m.spectrum?.energy_ev?.[0])} bis ${fmt(m.spectrum?.energy_ev?.at(-1))} eV`;
    const coverageWarning = (m) => m.spectrum?.coverage_complete === false
      ? `${recordLabel(m)}: Am oberen Rand des Beobachtungsfensters fehlen möglicherweise Beiträge weiterer Übergänge; die relative Absorption kann dort unterschätzt werden.` : null;
    const geometryRows = (m) => [identity(m), kind(m), fmt(m.properties?.energy_ev, 4), fmt(m.properties?.dihedral_deg, 1), fmt(m.properties?.ring_distance_pm, 0)];
    const geometryColumns = ["Struktur", "Strukturart", "E / eV", "C–N=N–C / °", "Ringabstand / pm"];
    const maximumText = (spectrum) => {
      const maximum = data.curveMaximum(spectrum);
      if (!maximum) return "Kein abgegrenztes Absorptionsmaximum in den gespeicherten Kurvenwerten.";
      return `Absorptionsmaximum des verbreiterten Spektrums im berechneten Energiebereich: Emax = ${fmt(maximum.energy)} eV (${fmt(1239.8419843320026 / maximum.energy, 0)} nm).` +
        (maximum.boundary ? " Der höchste gespeicherte Wert liegt am Rand des Energiebereichs; ein inneres Maximum ist dort nicht bestimmt." : "") +
        (maximum.multiple ? " Mehrere gespeicherte Punkte haben denselben Höchstwert; angegeben ist die kleinste Energie." : "");
    };
    const measurement = () => {
      const first = Number($("atom-first").value), second = Number($("atom-second").value), third = Number($("atom-third").value);
      const atom = graph[first], label = (index) => data.atomLabel(graph, index, context.current()?.settings);
      setText("atom-neighbors", atom ? `${label(first)}: ` + (atom.neighbors?.length ? atom.neighbors.map((neighbor) => {
        const bond = neighbor.bond_order === 1.5 ? "aromatische Bindung" : neighbor.bond_order === 1 ? "Einfachbindung" : neighbor.bond_order === 2 ? "Doppelbindung" : `Bindungsordnung ${fmt(neighbor.bond_order, 1)}`;
        return `${label(neighbor.number - 1)}, ${bond}`;
      }).join("; ") : "keine gespeicherten Bindungen") + "." : "Für diese gespeicherte Struktur fehlen Atom- und Bindungsdaten. Erstellen Sie die Struktur erneut.");
      // Optimizations keep the atom order, so the same pair can be measured in related structures.
      const m = context.current(), elements = graph.map((atom) => atom.element).join();
      const related = m ? [source(m), ...context.state.molecules.filter((other) => other.parent_id === m.id)]
        .filter((other) => other?.xyz && other.atom_graph?.map((atom) => atom.element).join() === elements) : [];
      const order = {initial: 0, unconverged: 1, minimum: 2, ts: 3};
      const values = [[m, positions], ...related.map((other) => [other, data.coordinates(other.xyz)])]
        .sort(([a], [b]) => (order[a?.kind] ?? 4) - (order[b?.kind] ?? 4))
        .map(([record, coordinates]) => `${fmt(data.distance(coordinates, first, second), 0)} pm${related.length ? ` in der ${inStructure(record)}` : ""}`);
      const name = (index) => data.atomName(graph, index, m?.settings);
      const distance = graph.length ? `Abstand ${name(first)} und ${name(second)}: ${values.join(", ")}.` : "";
      setText("atom-distance", distance);
      setText("contact-distance", measurementSelected ? distance : "");
      setText("atom-angle", graph.length ? `Winkel ${[first, second, third].map(label).join(" – ")}: ${fmt(data.angle(positions, first, second, third), 1)} °.` : "");
      measurementSections = measurementSelected ? [{title: "Ausgewählter Atomabstand", paragraphs: [$("accessible-spectrum-geometry").textContent, distance,
        ...(!this.prefersText ? [$("atom-angle").textContent] : [])]}] : [];
    };
    const inStructure = (m) => ({initial: "Startstruktur", minimum: "Minimumstruktur", ts: "Übergangsstruktur", unconverged: "nicht abgeschlossenen Optimierung"})[m?.kind] || "Struktur";
    $("atom-first").onchange = $("atom-second").onchange = $("atom-third").onchange = () => {
      measurementSelected = true;
      measurement();
    };
    $("accessible-molecule-select").onchange = () => context.selectMolecule?.($("accessible-molecule-select").value);
    function updateQuery() {
      const m = context.current();
      querySections = [];
      if (!curveQuery) { display("curve-value", []); return; }
      const energy = curveQuery.energy;
      if (energy == null) {
        display("curve-value", [{title: "Absorptionsabfrage", paragraphs: ["Geben Sie eine Zahl mit Dezimalkomma oder Dezimalpunkt ein, zum Beispiel 3,5."]}]);
        return;
      }
      const partner = data.partner(m, context.state.molecules, true);
      const partners = [m, ...(partner ? [partner] : [])].sort((a, b) => (a.settings?.configuration || "").localeCompare(b.settings?.configuration || ""));
      const values = partners.map((other) => data.absorption(other.spectrum, energy));
      const displayedValues = ScientificDisplay.compare(values, "strength");
      const unavailable = partners.flatMap((other, index) => values[index] == null
        ? [`${recordLabel(other)}: Bei ${ScientificDisplay.significant(energy, 4)} eV ist kein Kurvenwert verfügbar. Das Beobachtungsfenster reicht von ${windowText(other)}.`] : []);
      const sections = [{title: values.some((value) => value != null) ? `Relative Absorption bei ${ScientificDisplay.significant(energy, 4)} eV (${fmt(1239.8419843320026 / energy, 0)} nm)` : "Absorptionsabfrage",
        paragraphs: ["Werte der verbreiterten Spektren bei derselben Energie.", ...unavailable, ...(!partner ? ["Kein eindeutig zuordenbares cis/trans-Paar mit abgeschlossenen Minimumsuchen und Spektren gespeichert."] : [])],
        columns: ["Struktur", "Konfiguration", "Relative Absorption"], rows: values.some((value) => value != null)
          ? partners.map((other, index) => [recordLabel(other), other.settings?.configuration || "nicht angegeben", displayedValues[index]]) : []}];
      if (values.some((value) => value != null)) querySections = sections;
      display("curve-value", sections);
    }
    $("curve-query").onclick = () => {
      curveQuery = {energy: data.decimal($("curve-energy").value)};
      updateQuery();
    };
    $("curve-energy").onkeydown = (event) => {
      if (event.key === "Enter") { event.preventDefault(); $("curve-query").onclick(); }
    };
    $("data-report").onclick = () => {
      this.render();
      if (!reportSections.length) return;
      const step = {build: "Struktur", optimize: "Optimierung", spectrum: "Spektrum"}[context.state.step] || context.state.step;
      const name = context.filename("html").replace(/\.html$/, `-${step}.html`);
      context.download(data.report([...reportSections, ...querySections, ...measurementSections, ...methodSections], new Date()), name, "text/html;charset=utf-8");
      this.announce(`Ergebnisbericht gespeichert: ${name}`);
    };
    $("data-json").onclick = () => context.download(JSON.stringify({molecule: context.current(), displayed_record: points[pointIndex] || null,
      optimization_records: context.records(), color_comparison: colorComparisonRecord}, null, 2), context.filename("json"), "application/json");
    $("data-csv").onclick = () => context.download(data.csv(csvRows), context.filename("csv"), "text/csv;charset=utf-8");
    this.render = () => {
      const m = context.current(), step = context.state.step;
      layout?.apply(this.prefersText, step);
      const choices = context.selectableMolecules?.() || context.state.molecules;
      const choiceSignature = JSON.stringify(choices.map((other) => [other.id, recordLabel(other)]));
      if (choiceSignature !== selectorSignature) {
        selectorSignature = choiceSignature;
        // Group by derivative and configuration like the graphical structure picker.
        const order = {initial: 0, minimum: 1, unconverged: 2, ts: 3}, groups = new Map();
        for (const other of choices) {
          const name = context.groupLabel?.(other) ?? context.label(other);
          if (!groups.has(name)) groups.set(name, []);
          groups.get(name).push(other);
        }
        const options = (members) => members.sort((a, b) => (order[a.kind] ?? 4) - (order[b.kind] ?? 4)).map((other) => new Option(recordLabel(other), other.id));
        // One entry per group would only repeat each name; a flat list is shorter to hear.
        $("accessible-molecule-select").replaceChildren(...([...groups.values()].every((members) => members.length === 1)
          ? options(choices.slice())
          : [...groups].map(([name, members]) => {
            const group = document.createElement("optgroup");
            group.label = name;
            group.append(...options(members));
            return group;
          })));
      }
      $("accessible-molecule-select").value = m?.id || "";
      $("accessible-molecule-select").disabled = context.state.busy || !choices.length;
      $("accessible-results").hidden = !m;
      $("data-report").disabled = !m;
      if (!m) {
        $("simple-structure-figure").hidden = true;
        reportSections = querySections = measurementSections = methodSections = [];
        csvRows = [];
        moleculeKey = graphKey = null;
        contactSignature = "";
        $("atom-contacts").replaceChildren();
        return;
      }
      const key = `${m.id}:${step}`;
      if (key !== moleculeKey) {
        moleculeKey = key;
        pointIndex = null;
        curveQuery = null;
        measurementSelected = false;
        $("accessible-path").open = false;
      }
      const subs = (m.settings?.substituents || []).flatMap((sub, index) => sub === "H" ? [] : [`${index % 5 + 2}${index >= 5 ? "′" : ""}: ${context.substituentLabel(sub)}`]);
      const structuralFacts = `${m.formula}, ${m.atom_count} Atome. Konfiguration: ${m.settings?.configuration || "nicht angegeben"}. Substituenten: ${subs.join("; ") || "keine"}.`;
      const validation = m.kind === "initial" ? "Generierte, noch nicht quantenchemisch optimierte Startstruktur." : m.converged === false ? "Optimierung nicht abgeschlossen." : m.converged === true ? "Optimierung abgeschlossen." : "Status der Optimierung nicht angegeben.";
      reportSections = [{title: recordLabel(m), paragraphs: [structuralFacts, ...(!(m.ts_search && step === "optimize") ? [validation] : [])]}];
      if (step !== "build") reportSections[0].paragraphs.push("Elektronische Energien: GFN1-xTB.");
      $("simple-structure-figure").hidden = !m.svg;
      if (m.svg) {
        const image = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(m.svg);
        if ($("simple-structure-image").getAttribute?.("src") !== image) $("simple-structure-image").setAttribute?.("src", image);
        $("simple-structure-image").alt = `Strukturformel von ${context.label(m)}. Bindungen und Ringpositionen sind zusätzlich als Text verfügbar.`;
      }
      path = !!m.ts_search?.path?.length;
      points = path ? m.ts_search.path : context.records().filter((record) => Number.isFinite(record.energy_ev));
      if (context.state.live?.replay) {
        const index = points.findIndex((point) => path ? point.image === context.state.live.image : point.step === context.state.live.step);
        if (index >= 0) pointIndex = index;
      }
      if (pointIndex >= points.length) pointIndex = null;
      const selected = pointIndex == null ? null : points[pointIndex], preview = selected && step === "optimize";
      positions = preview ? selected.positions : data.coordinates(m.xyz);
      const properties = preview ? {...OptimizationProgress.geometryProperties(positions, m.geometry_definition), energy_ev: selected.energy_ev} : m.properties;
      const geometryText = `${preview ? path ? `Pfadstruktur ${pointIndex + 1}` : `Rechenschritt ${selected.step}` : "Gespeicherte Struktur"}: elektronische Energie ${fmt(properties?.energy_ev, 4)} eV; Diederwinkel C–N=N–C ${fmt(properties?.dihedral_deg, 1)} °; Ringabstand ${fmt(properties?.ring_distance_pm, 0)} pm.`;
      setText("accessible-spectrum-geometry", geometryText);
      let azoAngles = "";
      if (m.geometry_definition) {
        const [a, b, c, d] = m.geometry_definition.dihedral_indices;
        azoAngles = `Winkel C–N=N ${fmt(data.angle(positions, a, b, c), 1)} °; Winkel N=N–C ${fmt(data.angle(positions, b, c, d), 1)} °.`;
      }
      if (step === "optimize") {
        // A minimum search needs one sentence, not its own collapsible section.
        if (!path && points.length > 1 && !context.state.busy) {
          const change = (points.at(-1).energy_ev - points[0].energy_ev) * kjPerEv;
          reportSections[0].paragraphs.push(`${points.length} gespeicherte Rechenschritte; die elektronische Energie ${change < 0 ? "sank" : "stieg"} vom ersten zum letzten Schritt um ${ScientificDisplay.significant(Math.abs(change), 3)} kJ/mol.`);
        }
        reportSections.push({title: "Geometrie", paragraphs: [geometryText, azoAngles].filter(Boolean)});
        const input = source(m), partner = data.partner(m, context.state.molecules);
        const related = [m, input, partner, partner && source(partner)].filter((item, index, all) => item && all.findIndex((other) => other?.id === item.id) === index);
        if (related.length > 1) reportSections.push({title: "Zugehörige Start- und Minimumstrukturen", columns: geometryColumns, rows: related.map(geometryRows)});
        if (preview) reportSections.push({title: "Ausgewählte Zwischenstruktur", paragraphs: [`ΔE zur ersten gespeicherten ${path ? "Pfadstruktur" : "Suchstruktur"}: ${ScientificDisplay.significant(selected.energy_ev - points[0].energy_ev, 3)} eV.`]});
      }
      if (m.ts_search && step === "optimize") {
        const ts = m.ts_search;
        reportSections.push({title: "Prüfung der Übergangsstruktur", paragraphs: [ts.failure_reason,
          ...(ts.connectivity?.verified === true && ts.connectivity.endpoint_conformers_match === false ? ["Die erhaltenen Minimumstrukturen unterscheiden sich in der Orientierung der Ringe oder Substituenten von den Endstrukturen des dargestellten Reaktionspfads."] : [])].filter(Boolean), rows: [
          ["Optimierung abgeschlossen", m.converged === true ? "ja" : "nein"],
          ["Verbindung zwischen cis und trans bestätigt", ts.connectivity?.verified === true ? "ja" : ts.connectivity?.verified === false ? "nein" : "noch nicht geprüft"],
          ["Imaginäre Frequenzen mit einem Betrag über 20 cm⁻¹", ts.validation?.imaginary_count ?? "noch nicht geprüft"],
          ["Betrag der imaginären Frequenz / cm⁻¹", Number.isFinite(ts.validation?.imaginary_frequency_cm1) ? ScientificDisplay.frequency(ts.validation.imaginary_frequency_cm1) : "nicht verfügbar"],
        ]});
      }
      const previousElements = graph.map((atom) => atom.element).join();
      graph = m.atom_graph || [];
      if (graphKey !== m.id) {
        graphKey = m.id;
        const options = graph.map((_atom, index) => [data.atomLabel(graph, index, m.settings), index]);
        // Optimizations keep the atom order, so a chosen pair stays comparable between start and minimum.
        const keep = previousElements && previousElements === graph.map((atom) => atom.element).join();
        for (const [id, value] of [["atom-first", 0], ["atom-second", Math.min(1, graph.length - 1)], ["atom-third", Math.min(2, graph.length - 1)]]) {
          fillSelect($(id), options, keep ? $(id).value : value); $(id).disabled = !graph.length;
        }
        setText("atom-scaffold", "Grundgerüst: C1–N=N–C1′. Erster Ring: C1–C2–C3–C4–C5–C6–C1. Zweiter Ring: C1′–C2′–C3′–C4′–C5′–C6′–C1′. Diese Positionsnummern bezeichnen Ringatome; die zusätzlichen Atomnummern gelten für die gespeicherten Koordinaten.");
      }
      if (!context.state.busy) {
        const contacts = graph.length ? data.closeContacts(graph, positions) : [];
        const signature = JSON.stringify([m.id, contacts.map((contact) => [contact.first, contact.second, Math.round(contact.distance)])]);
        if (signature !== contactSignature) {
          contactSignature = signature;
          const name = (index) => data.atomName(graph, index, m.settings);
          $("atom-contacts").replaceChildren(...contacts.map((contact) => {
            const item = document.createElement("li"), button = document.createElement("button");
            button.type = "button";
            button.className = "text-button";
            button.textContent = `${name(contact.first)} und ${name(contact.second)}: ${fmt(contact.distance, 0)} pm`;
            button.onclick = () => {
              $("atom-first").value = String(contact.first);
              $("atom-second").value = String(contact.second);
              measurementSelected = true;
              measurement();
              this.announce($("contact-distance").textContent);
            };
            item.append(button);
            return item;
          }));
        }
      }
      measurement();
      // Live steps arrive every poll; rebuilding tables then would move a screen reader's reading position.
      $("accessible-path").hidden = step !== "optimize" || !path || !!context.state.busy;
      $("accessible-path-summary").hidden = this.prefersText;
      $("accessible-path-title").hidden = !this.prefersText;
      if (this.prefersText && path) $("accessible-path").open = true;
      // Distances matter for structures, not for spectra; the text mode hides them there.
      $("atom-explorer").hidden = this.prefersText && step === "spectrum";
      const relative = points.map((point) => (point.energy_ev - points[0].energy_ev) * kjPerEv);
      const dihedrals = points.map((point) => OptimizationProgress.geometryProperties(point.positions, m.geometry_definition).dihedral_deg);
      setText("accessible-path-note", "Reaktionspfad im elektronischen Grundzustand aus berechneten Strukturen, keine molekulare Dynamik. ΔE bezieht sich auf die erste Pfadstruktur.");
      const spectrum = m.spectrum, tableKey = JSON.stringify([m.id, path, relative, dihedrals]);
      if (tableKey !== tableSignature && !context.state.busy) {
        tableSignature = tableKey;
        const peak = relative.indexOf(Math.max(...relative));
        const rows = path ? [["Anfang", 0], ["Energiemaximum", peak], ["Ende", points.length - 1]] : [];
        $("energy-table-body").replaceChildren(...rows.map(([label, index]) => {
          const tr = document.createElement("tr");
          [label, String(index + 1), ScientificDisplay.significant(relative[index], 3), fmt(dihedrals[index], 1)].forEach((text, column) => {
            const cell = document.createElement(column ? "td" : "th");
            if (!column) cell.scope = "row";
            cell.textContent = text;
            if (ScientificDisplay.spoken(text) !== text) cell.innerHTML = ScientificDisplay.html(text);
            tr.append(cell);
          });
          return tr;
        }));
      }
      renderPathSonification(path && this.prefersText && !context.state.busy ? {key: tableKey, relative, dihedrals} : null);
      $("accessible-spectrum").hidden = step !== "spectrum" || !spectrum;
      colorComparisonRecord = null;
      if (step === "spectrum" && spectrum) {
        const transitions = data.strongestTransitions(spectrum), color = SolutionColor.estimate(spectrum);
        const transitionEnergies = ScientificDisplay.compare(spectrum.excitations_ev || [], "energy");
        const transitionRows = transitions.map((transition) => [transition.index, transitionEnergies[transition.index - 1], fmt(1239.8419843320026 / transition.energy, 0), strength(transition.strength)]);
        const visible = (spectrum.excitations_ev || []).map((energy, index) => ({energy, index, strength: spectrum.oscillator_strengths?.[index]}))
          .filter((transition) => transition.energy >= 1239.8419843320026 / 780 && transition.energy <= 1239.8419843320026 / 380 && transition.strength > 0 && Number.isFinite(transition.strength));
        const additionalVisible = visible.filter((transition) => !transitions.some((shown) => shown.index === transition.index + 1))
          .sort((a, b) => b.strength - a.strength || a.energy - b.energy || a.index - b.index);
        const spectralNote = `INDO/S–CIS. Beobachtungsfenster: ${fmt(spectrum.energy_ev?.[0])} bis ${fmt(spectrum.energy_ev?.at(-1))} eV. Relative Absorption in willkürlichen Einheiten.` +
          (spectrum.coverage_complete === false ? " Am oberen Rand fehlen möglicherweise Beiträge weiterer Übergänge; die Absorption kann dort unterschätzt werden." : "");
        reportSections.push({title: "Stärkste elektronische Übergänge", paragraphs: [`Bis zu fünf stärkste Übergänge im Beobachtungsfenster ${fmt(spectrum.energy_ev[0], 1)}–${fmt(spectrum.energy_ev.at(-1), 1)} eV, absteigend nach Oszillatorstärke. Die Oszillatorstärke f beschreibt die berechnete Übergangsstärke; sie ist keine gemessene Absorbanz.`,
          ...(!transitions.length ? ["Keine Übergänge mit positiver Oszillatorstärke im Beobachtungsfenster."] : [])],
          columns: ["Übergang", "E / eV", "λ / nm", "Oszillatorstärke f"], rows: transitionRows});
        if (additionalVisible.length) reportSections.push({title: "Weitere Übergänge im sichtbaren Bereich", columns: ["Übergang", "E / eV", "λ / nm", "Oszillatorstärke f"],
          rows: additionalVisible.map((transition) => [transition.index + 1, transitionEnergies[transition.index], fmt(1239.8419843320026 / transition.energy, 0), strength(transition.strength)])});
        reportSections.push({title: "UV/Vis-Spektrum", paragraphs: [maximumText(spectrum), data.visibleCoverage(spectrum), spectralNote]});
        const partner = data.partner(m, context.state.molecules, true);
        const paired = [m, ...(partner ? [partner] : [])].sort((a, b) => (a.settings?.configuration || "").localeCompare(b.settings?.configuration || ""));
        if (partner) {
          const maxima = ScientificDisplay.compare(paired.map((other) => data.curveMaximum(other.spectrum)?.energy), "energy");
          const differentWindow = spectrum.energy_ev[0] !== partner.spectrum.energy_ev[0] || spectrum.energy_ev.at(-1) !== partner.spectrum.energy_ev.at(-1);
          reportSections.push({title: "Zugehöriges cis/trans-Paar", paragraphs: [coverageWarning(partner), ...(differentWindow ? [`${recordLabel(partner)}: Beobachtungsfenster ${windowText(partner)}.`] : [])].filter(Boolean),
            columns: ["Struktur", "Konfiguration", "Emax / eV"],
            rows: paired.map((other, index) => [identity(other), other.settings.configuration, maxima[index]])});
        } else reportSections.push({title: "cis/trans-Vergleich", paragraphs: ["Kein eindeutig zuordenbares cis/trans-Paar mit abgeschlossenen Minimumsuchen und Spektren gespeichert. Berechnen Sie beide Konfigurationen desselben Substitutionsmusters."]});
        const second = partner && SolutionColor.estimate(partner.spectrum), distance = color && second ? data.colorDistance(color.rgb, second.rgb) : null;
        if (distance != null) colorComparisonRecord = {first_id: m.id, second_id: partner.id, first_rgb: color.rgb, second_rgb: second.rgb, cie76_distance: distance, reference_white: "D65", gamut: "clipped_sRGB", color_assumption: "fixed_absorbance_scale_no_concentration_or_path_length"};
        // Color is reported descriptively; the CIE76 distance stays in the JSON export only.
        reportSections.push({title: "Farbvorhersage",
          paragraphs: ["Modellvorhersage mit fester Absorbanzskalierung, keiner bestimmten Konzentration oder Schichtdicke zugeordnet."],
          columns: ["Struktur", "Konfiguration", "Geschätzte Lösungsfarbe", "Gewichtete Lichtdurchlässigkeit / %"],
          rows: paired.map((other) => { const result = SolutionColor.estimate(other.spectrum); return [identity(other), other.settings?.configuration || "nicht angegeben", result ? data.color(result.rgb) : "nicht verfügbar: unvollständige oder nicht auswertbare Spektraldaten", result ? ScientificDisplay.percent(100 * result.luminance) : "nicht verfügbar"]; })});

      }
      methodSections = step === "spectrum" && spectrum ? [{title: "Methoden der Datenausgabe", optional: true,
        paragraphs: [data.outputMethods[0], ScientificDisplay.note]}] : [];
      display("result-report-content", reportSections);
      updateQuery();
      this.reportSections = reportSections;
      updateTableFocus();
      const energyRows = points.map((point, index) => {
        const geometry = OptimizationProgress.geometryProperties(point.positions, m.geometry_definition);
        return [path ? index + 1 : point.step, point.energy_ev, point.energy_ev - points[0].energy_ev, geometry.dihedral_deg, geometry.ring_distance_pm];
      });
      csvRows = [["structure", "kind", "data_type", "index", "energy_ev", "delta_energy_ev", "wavelength_nm", "oscillator_strength", "relative_absorption", "dihedral_deg", "ring_distance_pm"],
        [context.label(m), m.kind, "saved_geometry", "", m.properties?.energy_ev, "", "", "", "", m.properties?.dihedral_deg, m.properties?.ring_distance_pm],
        ...energyRows.map((row) => [context.label(m), m.kind, path ? "path_relative_to_first" : "search_relative_to_first", row[0], row[1], row[2], "", "", "", row[3], row[4]]),
        ...(spectrum?.excitations_ev || []).map((energy, index) => [context.label(m), m.kind, "transition", index + 1, energy, "", 1239.8419843320026 / energy, spectrum.oscillator_strengths[index]]),
        ...(spectrum?.energy_ev || []).map((energy, index) => [context.label(m), m.kind, "absorption_curve", index + 1, energy, "", 1239.8419843320026 / energy, "", spectrum.absorption[index]])];
      const metadata = ["GFN1-xTB", spectrum ? "INDO/S-CIS" : "", m.converged ?? "not_applicable", m.ts_search?.connectivity?.verified ?? "not_applicable", spectrum?.coverage_complete ?? "not_applicable", "fixed_absorbance_scale_no_concentration_or_path_length"];
      csvRows = csvRows.map((row, index) => [...Array.from({length: 11}, (_, column) => row[column] ?? ""), ...(index ? metadata : ["energy_method", "spectrum_method", "converged", "connectivity_verified", "spectrum_coverage_complete", "color_assumption"])]);
    };
  },
};
