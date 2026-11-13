/* Shared result data for visual and nonvisual exploration. No network services. */
"use strict";
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
      .sort((a, b) => b.strength - a.strength || a.index - b.index).slice(0, count)
      .sort((a, b) => a.energy - b.energy || a.index - b.index);
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
  atomLabel(graph, index, settings) {
    const atom = graph[index];
    if (!atom) return "Atom nicht verfügbar";
    let position = atom.position;
    if (!position) {
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
    const site = position?.match(/^C([2-6])(′)?$/);
    const substituent = site && settings?.substituents?.[Number(site[1]) - 2 + (site[2] ? 5 : 0)];
    const group = substituent && substituent !== "H" ? `, ${atom.position ? "trägt " : "zugeordnet: "}${this.substituentName(substituent)}` : "";
    const azo = atom.element === "N" && atom.neighbors?.some((neighbor) => graph[neighbor.number - 1]?.element === "N" && neighbor.bond_order === 2) ? ", Azogruppe" : "";
    return `Atom ${atom.number} (${atom.element}${position ? `, ${atom.position ? "Ringposition" : "Ringbezug"} ${position}` : ""}${group}${azo})`;
  },
  outputMethods: [
    "Kurvenabfragen: Zwischen gespeicherten Kurvenpunkten wird die relative Absorption linear interpoliert.",
    "Farbvergleich: CIE76 ist der Abstand der berechneten sRGB-Bildschirmfarben im CIE-L*a*b*-Farbraum mit D65-Referenzweiß. Größere Werte bedeuten größere Modellabstände, keine proportional empfundenen Unterschiede. Die Umrechnung begrenzt die Farben auf sRGB. Beide Farben verwenden dieselbe feste Absorbanzskalierung.",
    "Bandenübersicht: Lokale Maxima werden an den gespeicherten Kurvenpunkten bestimmt; gleich hohe benachbarte Punkte erscheinen als Intervall. Randwerte werden nicht als innere Bandenmaxima ausgegeben. Bei vielen Maxima nennt die Kurzansicht die vier höchsten im sichtbaren Bereich und zwei weitere. Die vollständigen Spektraldaten enthalten alle lokalen Maxima; die Kurvenabfrage bleibt für alle gespeicherten Energien verfügbar.",
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
  describeCurve(spectrum) {
    const curve = this.curveOverview(spectrum);
    if (!curve) return {summary: "Für die Bandenübersicht fehlen gültige Kurvenwerte.", coverage: "", bands: [], allBands: [], note: ""};
    const fmt = (value, digits) => value.toLocaleString("de-DE", {minimumFractionDigits: digits, maximumFractionDigits: digits});
    const height = (value) => value.toLocaleString("de-DE", {maximumSignificantDigits: 3});
    const coverage = curve.visible.coverage === "full" ? "Sichtbarer Bereich (380–780 nm): vollständig abgedeckt."
      : curve.visible.coverage === "none" ? "Der sichtbare Bereich (380–780 nm) liegt außerhalb des berechneten Energiebereichs."
      : `Sichtbarer Bereich (380–780 nm): nur von ${fmt(1239.8419843320026 / curve.visible.high, 1)} bis ${fmt(1239.8419843320026 / curve.visible.low, 1)} nm abgedeckt.`;
    const inVisible = curve.peaks.filter((peak) => peak.visible), elsewhere = curve.peaks.filter((peak) => !peak.visible);
    const select = (peaks, count) => [...peaks].sort((a, b) => b.height - a.height).slice(0, count).sort((a, b) => a.low - b.low);
    const selected = [...select(inVisible, 4), ...select(elsewhere, 2)];
    const describePeak = (peak) => {
      const range = peak.first === peak.last ? `${fmt(peak.low, 4)} eV (${fmt(1239.8419843320026 / peak.low, 1)} nm)`
        : `${fmt(peak.low, 4)}–${fmt(peak.high, 4)} eV (${fmt(1239.8419843320026 / peak.high, 1)}–${fmt(1239.8419843320026 / peak.low, 1)} nm), Plateau`;
      return `${peak.visible ? "Sichtbarer Bereich" : "Außerhalb des sichtbaren Bereichs"}: lokales Maximum bei ${range}; relative Absorption ${height(peak.height)}.`;
    };
    const bands = selected.map(describePeak), allBands = curve.peaks.map(describePeak);
    const notes = [];
    if (curve.flat) notes.push("Die gespeicherte Kurve ist konstant; es gibt kein abgegrenztes Maximum.");
    else {
      if (curve.visible.coverage !== "none" && !inVisible.length) {
        notes.push("Im sichtbaren Teilbereich liegt kein inneres lokales Maximum.");
        if (curve.visible.trend === "rising") notes.push("Die gespeicherten Werte steigen dort mit steigender Energie.");
        if (curve.visible.trend === "falling") notes.push("Die gespeicherten Werte fallen dort mit steigender Energie.");
        if (curve.visible.trend === "flat") notes.push("Die gespeicherten Werte sind dort konstant.");
        if (!curve.visible.samples) notes.push("In diesem Teilbereich liegen keine gespeicherten Kurvenpunkte.");
      }
      if (curve.lowerBoundaryHighest || curve.upperBoundaryHighest) notes.push(`Der höchste gespeicherte Wert liegt ${curve.lowerBoundaryHighest && curve.upperBoundaryHighest ? "an beiden Rändern" : curve.lowerBoundaryHighest ? "am unteren Rand" : "am oberen Rand"} des Energiebereichs; dort ist kein inneres Bandenmaximum bestimmt.`);
    }
    const omitted = curve.peaks.length - selected.length;
    if (omitted) notes.push(`${omitted === 1 ? "1 weiteres lokales Maximum ist" : `${omitted} weitere lokale Maxima sind`} in der Kurzansicht nicht aufgeführt. Die vollständige Übersicht steht in den Spektraldaten der App.`);
    return {summary: `Höchste gespeicherte relative Absorption: ${height(curve.maximum)}.`, coverage, bands, allBands, note: notes.join(" ")};
  },
  coordinates(xyz) {
    return (xyz || "").trim().split("\n").slice(2).flatMap((line) =>
      line.trim().split(/\s+/).slice(1, 4).map(Number));
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
  reportBody(sections) {
    const escape = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"})[c]);
    return sections.map(({title, paragraphs = [], rows = [], columns, optional = false}) => {
      const body =
      paragraphs.map((p) => `<p>${escape(p)}</p>`).join("") +
      (rows.length ? `<div class="table-scroll" tabindex="0" role="region" aria-label="${escape(title)}"><table><caption>${escape(title)}</caption><thead><tr>${(columns || ["Größe oder Angabe", "Wert"]).map((label) => `<th scope="col">${escape(label)}</th>`).join("")}</tr></thead><tbody>` + rows.map((row) => `<tr>${row.map((value, index) => index ? `<td>${escape(value)}</td>` : `<th scope="row">${escape(value)}</th>`).join("")}</tr>`).join("") + "</tbody></table></div>" : "");
      return optional ? `<details><summary>${escape(title)}</summary>${body}</details>` : `<section><h3>${escape(title)}</h3>${body}</section>`;
    }).join("");
  },
  report(sections) {
    return `<!doctype html><html lang="de"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>PhotoSwitchLab Ergebnisbericht</title><style>body{font:1rem/1.6 system-ui,sans-serif;max-width:90ch;margin:2rem auto;padding:0 1rem;color:#192d43;background:white}h1,h2,h3{line-height:1.3}section{margin:2rem 0}.table-scroll{overflow-x:auto}table{border-collapse:collapse;width:100%}caption{text-align:left;font-weight:600}th,td{border:1px solid #b8c4d0;padding:.5rem;text-align:left;overflow-wrap:anywhere}thead{background:#edf2f7}@media(max-width:400px){th,td{padding:.3rem}}@media print{body{max-width:none;margin:0}}</style><main><h1>PhotoSwitchLab Ergebnisbericht</h1><p>Aktuelle Rechenergebnisse und zugehörige Vergleiche. Wissenschaftliche Deutungen ergänzen Sie selbst im Protokoll.</p>${this.reportBody(sections)}</main></html>`;
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
    const setText = (id, text) => { if ($(id).textContent !== text) $(id).textContent = text; };
    const fmt = (value, digits = 4) => Number.isFinite(value) ? value.toLocaleString("de-DE", {minimumFractionDigits: digits, maximumFractionDigits: digits}) : "nicht verfügbar";
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
    let curveQuery = null, measurementSelected = false, reportSections = [], querySections = [], measurementSections = [], methodSections = [];
    let colorComparisonRecord = null;
    const rendered = new Map();
    function display(id, sections) {
      const content = data.reportBody(sections);
      if (rendered.get(id) !== content) { $(id).innerHTML = content; rendered.set(id, content); }
    }
    function fillSelect(select, options, value) {
      select.replaceChildren(...options.map(([label, key]) => new Option(label, key)));
      if (value != null && [...select.options].some((option) => option.value === String(value))) select.value = value;
    }
    const strength = (value) => Number.isFinite(value) ? value.toLocaleString("de-DE", {maximumSignificantDigits: 3, useGrouping: false}) : "nicht verfügbar";
    const identity = (m) => {
      const label = context.label(m);
      const collisions = context.state.molecules.filter((other) => context.label(other) === label && other.kind === m.kind);
      if (collisions.length < 2) return label;
      let length = 6;
      while (length < m.id.length && collisions.some((other) => other.id !== m.id && other.id.slice(0, length) === m.id.slice(0, length))) length++;
      return `${label} · ${m.id.slice(0, length)}`;
    };
    const kind = (m) => ({initial: "Startstruktur", minimum: "Minimumstruktur", ts: "Übergangsstruktur", unconverged: "Optimierung nicht abgeschlossen"})[m.kind] || m.kind;
    const recordLabel = (m) => `${identity(m)} · ${kind(m)}`;
    const source = (m) => context.state.molecules.find((other) => other.id === m.parent_id);
    const geometryRows = (m) => [identity(m), kind(m), fmt(m.properties?.energy_ev), fmt(m.properties?.dihedral_deg, 1), fmt(m.properties?.ring_distance_pm, 1)];
    const geometryColumns = ["Struktur", "Strukturart", "E / eV", "C–N=N–C / °", "Ringabstand / pm"];
    const maximumText = (spectrum) => {
      const maximum = data.curveMaximum(spectrum);
      if (!maximum) return "Kein abgegrenztes Absorptionsmaximum in den gespeicherten Kurvenwerten.";
      return `Absorptionsmaximum des verbreiterten Spektrums im berechneten Energiebereich: Emax = ${fmt(maximum.energy)} eV (${fmt(1239.8419843320026 / maximum.energy, 1)} nm).` +
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
      setText("atom-distance", graph.length ? `Abstand ${label(first)} zu ${label(second)}: ${fmt(data.distance(positions, first, second), 1)} pm.` : "");
      setText("atom-angle", graph.length ? `Winkel ${[first, second, third].map(label).join(" – ")}: ${fmt(data.angle(positions, first, second, third), 1)} °.` : "");
      measurementSections = measurementSelected ? [{title: "Ausgewählter Atomabstand", paragraphs: [$("accessible-spectrum-geometry").textContent, $("atom-distance").textContent,
        ...(!this.prefersText ? [$("atom-angle").textContent] : [])]}] : [];
    };
    $("atom-first").onchange = $("atom-second").onchange = $("atom-third").onchange = () => {
      measurementSelected = true;
      measurement();
      this.announce($("atom-distance").textContent + (this.prefersText ? "" : " " + $("atom-angle").textContent));
    };
    $("accessible-molecule-select").onchange = () => context.selectMolecule?.($("accessible-molecule-select").value);
    $("path-point").onchange = () => {
      if ($("path-point").value === "") { pointIndex = null; context.showResult(); }
      else {
        pointIndex = Number($("path-point").value);
        const point = points[pointIndex], playback = context.playback();
        const index = playback.records.findIndex((record) => path ? record.image === point?.image : record.step === point?.step);
        if (index >= 0 && !context.state.busy) context.selectFrame(index);
      }
      this.render();
      this.announce($("accessible-point").textContent || "Gespeicherte Struktur ausgewählt.");
    };
    function updateQuery() {
      const m = context.current(), spectrum = m?.spectrum;
      querySections = [];
      if (!curveQuery) { display("curve-value", []); return; }
      const energy = curveQuery.energy, value = energy == null ? null : data.absorption(spectrum, energy);
      if (energy == null || value == null) {
        display("curve-value", [{title: "Absorptionsabfrage", paragraphs: [energy == null ? "Geben Sie eine Zahl mit Dezimalkomma oder Dezimalpunkt ein, zum Beispiel 3,5."
          : `Geben Sie eine Energie zwischen ${fmt(spectrum?.energy_ev?.[0])} und ${fmt(spectrum?.energy_ev?.at(-1))} eV ein.`]}]);
        return;
      }
      const partner = data.partner(m, context.state.molecules, true);
      const partners = [m, ...(partner ? [partner] : [])].sort((a, b) => a.settings.configuration.localeCompare(b.settings.configuration));
      querySections = [{title: `Relative Absorption bei ${fmt(energy)} eV (${fmt(1239.8419843320026 / energy, 1)} nm)`,
        paragraphs: ["Werte der verbreiterten Spektren bei derselben Energie.", ...(!partner ? ["Kein eindeutig zuordenbares cis/trans-Paar mit abgeschlossenen Minimumsuchen und Spektren gespeichert."] : [])],
        columns: ["Struktur", "Konfiguration", "Relative Absorption"], rows: partners.map((other) => [recordLabel(other), other.settings?.configuration || "nicht angegeben", fmt(data.absorption(other.spectrum, energy))])}];
      display("curve-value", querySections);
    }
    $("curve-query").onclick = () => {
      curveQuery = {energy: data.decimal($("curve-energy").value)};
      updateQuery();
    };
    $("data-report").onclick = () => {
      this.render();
      if (reportSections.length) context.download(data.report([...reportSections, ...querySections, ...measurementSections, ...methodSections]), context.filename("html"), "text/html;charset=utf-8");
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
        fillSelect($("accessible-molecule-select"), choices.map((other) => [recordLabel(other), other.id]), m?.id);
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
        return;
      }
      const key = `${m.id}:${step}`;
      if (key !== moleculeKey) {
        moleculeKey = key;
        pointIndex = null;
        curveQuery = null;
        measurementSelected = false;
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
      const geometryText = `${preview ? path ? `Pfadstruktur ${pointIndex + 1}` : `Rechenschritt ${selected.step}` : "Gespeicherte Struktur"}: elektronische Energie ${fmt(properties?.energy_ev)} eV; Diederwinkel C–N=N–C ${fmt(properties?.dihedral_deg, 1)} °; Ringabstand ${fmt(properties?.ring_distance_pm, 1)} pm.`;
      setText("accessible-spectrum-geometry", geometryText);
      let azoAngles = "";
      if (m.geometry_definition) {
        const [a, b, c, d] = m.geometry_definition.dihedral_indices;
        azoAngles = `Winkel C–N=N ${fmt(data.angle(positions, a, b, c), 1)} °; Winkel N=N–C ${fmt(data.angle(positions, b, c, d), 1)} °.`;
      }
      if (step === "optimize") {
        reportSections.push({title: "Geometrie", paragraphs: [geometryText, azoAngles].filter(Boolean)});
        const input = source(m), partner = data.partner(m, context.state.molecules);
        const related = [m, input, partner, partner && source(partner)].filter((item, index, all) => item && all.findIndex((other) => other?.id === item.id) === index);
        if (related.length > 1) reportSections.push({title: "Zugehörige Start- und Minimumstrukturen", columns: geometryColumns, rows: related.map(geometryRows)});
        if (preview) reportSections.push({title: "Ausgewählte Zwischenstruktur", paragraphs: [`ΔE zur ersten gespeicherten ${path ? "Pfadstruktur" : "Suchstruktur"}: ${fmt(selected.energy_ev - points[0].energy_ev)} eV.`]});
      }
      if (m.ts_search && step === "optimize") {
        const ts = m.ts_search;
        reportSections.push({title: "Prüfung der Übergangsstruktur", paragraphs: [ts.failure_reason].filter(Boolean), rows: [
          ["Optimierung abgeschlossen", m.converged === true ? "ja" : "nein"],
          ["Verbindung zwischen cis und trans bestätigt", ts.connectivity?.verified === true ? "ja" : ts.connectivity?.verified === false ? "nein" : "noch nicht geprüft"],
          ["Imaginäre Frequenzen mit einem Betrag über 20 cm⁻¹", ts.validation?.imaginary_count ?? "noch nicht geprüft"],
          ["Betrag der imaginären Frequenz / cm⁻¹", Number.isFinite(ts.validation?.imaginary_frequency_cm1) ? fmt(Math.abs(ts.validation.imaginary_frequency_cm1), 1) : "nicht verfügbar"],
        ]});
      }
      graph = m.atom_graph || [];
      if (graphKey !== m.id) {
        graphKey = m.id;
        const options = graph.map((_atom, index) => [data.atomLabel(graph, index, m.settings), index]);
        for (const [id, value] of [["atom-first", 0], ["atom-second", Math.min(1, graph.length - 1)], ["atom-third", Math.min(2, graph.length - 1)]]) {
          fillSelect($(id), options, value); $(id).disabled = !graph.length;
        }
        setText("atom-rings", m.geometry_definition ? `Diederwinkel: Atome ${m.geometry_definition.dihedral_indices.map((index) => index + 1).join("–")}. Phenylringe: ${m.geometry_definition.rings.map((ring) => ring.map((index) => index + 1).join(", ")).join("; ")}.` : "");
        setText("atom-scaffold", "Grundgerüst: C1–N=N–C1′. Erster Ring: C1–C2–C3–C4–C5–C6–C1. Zweiter Ring: C1′–C2′–C3′–C4′–C5′–C6′–C1′. Diese Positionsnummern bezeichnen Ringatome; die zusätzlichen Atomnummern gelten für die gespeicherten Koordinaten.");
      }
      measurement();
      $("accessible-path").hidden = step !== "optimize" || !points.length;
      setText("accessible-path-note", path ? "Reaktionspfad im elektronischen Grundzustand. ΔE bezieht sich auf die erste Pfadstruktur. Die Auswahl zeigt berechnete Geometrien, keine molekulare Dynamik."
        : "Rechenschritte der Suche, keine Zeitachse. ΔE bezieht sich auf den ersten gespeicherten Suchschritt. Suchschritte einer Übergangsstruktursuche bilden noch keinen Reaktionspfad.");
      setText("energy-table-caption", path ? "Berechnete Strukturen des Reaktionspfads" : "Gespeicherte Suchschritte");
      const energyRows = points.map((point, index) => {
        const geometry = OptimizationProgress.geometryProperties(point.positions, m.geometry_definition);
        const indices = m.geometry_definition?.dihedral_indices;
        return [path ? index + 1 : point.step, point.energy_ev, point.energy_ev - points[0].energy_ev, geometry.dihedral_deg, geometry.ring_distance_pm,
          indices ? data.angle(point.positions, ...indices.slice(0, 3)) : null, indices ? data.angle(point.positions, ...indices.slice(1, 4)) : null];
      });
      const spectrum = m.spectrum, tableKey = JSON.stringify([m.id, energyRows, spectrum]);
      if (tableKey !== tableSignature) {
        tableSignature = tableKey;
        fillSelect($("path-point"), [["Gespeicherte Struktur", ""], ...energyRows.map((row, index) => [`${path ? "Pfadstruktur" : "Rechenschritt"} ${row[0]} · ${fmt(row[1])} eV`, index])], pointIndex ?? "");
        const table = (id, rows, digits) => $(id).replaceChildren(...rows.map((row) => {
          const tr = document.createElement("tr");
          row.forEach((value, index) => { const cell = document.createElement(index ? "td" : "th"); if (!index) cell.scope = "row"; cell.textContent = index ? id === "transition-table-body" && index === 3 ? strength(value) : fmt(value, digits[index] ?? 4) : String(value); tr.append(cell); });
          return tr;
        }));
        table("energy-table-body", energyRows, [0, 4, 4, 1, 1, 1, 1]);
        table("transition-table-body", (spectrum?.excitations_ev || []).map((energy, index) => [index + 1, energy, 1239.8419843320026 / energy, spectrum.oscillator_strengths[index]]), [0, 4, 1, 4]);
        const overview = data.describeCurve(spectrum);
        setText("spectrum-visible-coverage", overview.coverage);
        $("spectrum-all-band-list").replaceChildren(...overview.allBands.map((text) => { const item = document.createElement("li"); item.textContent = text; return item; }));
        setText("spectrum-all-band-note", overview.allBands.length ? "" : "Keine inneren lokalen Maxima in der gespeicherten Kurve.");
      }
      $("path-point").value = pointIndex == null ? "" : String(pointIndex);
      setText("accessible-point", selected ? `${path ? "Pfadstruktur" : "Rechenschritt"} ${path ? pointIndex + 1 : selected.step}: E = ${fmt(selected.energy_ev)} eV; ΔE = ${fmt(selected.energy_ev - points[0].energy_ev)} eV. ${azoAngles}` : "");
      $("accessible-spectrum").hidden = step !== "spectrum" || !spectrum;
      colorComparisonRecord = null;
      if (step === "spectrum" && spectrum) {
        const overview = data.describeCurve(spectrum), transitions = data.strongestTransitions(spectrum), color = SolutionColor.estimate(spectrum);
        const transitionRows = transitions.map((transition) => [transition.index, fmt(transition.energy), fmt(1239.8419843320026 / transition.energy, 1), strength(transition.strength)]);
        const visible = (spectrum.excitations_ev || []).map((energy, index) => ({energy, index, strength: spectrum.oscillator_strengths?.[index]}))
          .filter((transition) => transition.energy >= 1239.8419843320026 / 780 && transition.energy <= 1239.8419843320026 / 380 && transition.strength > 0 && Number.isFinite(transition.strength));
        display("visible-transition-data", [{title: "Sichtbare elektronische Übergänge", paragraphs: visible.length ? [] : ["Keine Übergänge mit positiver Oszillatorstärke im sichtbaren Bereich berechnet."],
          columns: ["Übergang", "E / eV", "λ / nm", "Oszillatorstärke f"], rows: visible.map((transition) => [transition.index + 1, fmt(transition.energy), fmt(1239.8419843320026 / transition.energy, 1), strength(transition.strength)])}]);
        const strongestVisible = [...visible].sort((a, b) => b.strength - a.strength || a.index - b.index)[0];
        const spectralNote = `INDO/S–CIS. Beobachtungsfenster: ${fmt(spectrum.energy_ev?.[0])} bis ${fmt(spectrum.energy_ev?.at(-1))} eV. Relative Absorption in willkürlichen Einheiten.` +
          (spectrum.coverage_complete === false ? " Am oberen Rand fehlen möglicherweise Beiträge weiterer Übergänge; die Absorption kann dort unterschätzt werden." : "");
        reportSections.push({title: "Stärkste elektronische Übergänge", paragraphs: [`Bis zu fünf stärkste Übergänge im Beobachtungsfenster ${fmt(spectrum.energy_ev[0], 1)}–${fmt(spectrum.energy_ev.at(-1), 1)} eV, geordnet nach Energie. Die Oszillatorstärke f beschreibt die berechnete Übergangsstärke; sie ist keine gemessene Absorbanz.`,
          ...(!transitions.length ? ["Keine Übergänge mit positiver Oszillatorstärke im Beobachtungsfenster."] : []),
          ...(strongestVisible && !transitions.some((transition) => transition.index === strongestVisible.index + 1) ? [`Stärkster weiterer Übergang im sichtbaren Bereich: ${fmt(strongestVisible.energy)} eV (${fmt(1239.8419843320026 / strongestVisible.energy, 1)} nm), f = ${strength(strongestVisible.strength)}.`] : [])],
          columns: ["Übergang", "E / eV", "λ / nm", "Oszillatorstärke f"], rows: transitionRows});
        reportSections.push({title: "UV/Vis-Spektrum", paragraphs: [maximumText(spectrum), overview.coverage, spectralNote]});
        reportSections.push({title: "Geschätzte Lösungsfarbe", paragraphs: [color ? `${data.color(color.rgb)}. Gewichtete Lichtdurchlässigkeit: ${fmt(100 * color.luminance, 1)} %. Feste Absorbanzskalierung, keiner bestimmten Konzentration oder Schichtdicke zugeordnet.`
          : "Keine Farbschätzung verfügbar: Das Spektrum ist unvollständig oder enthält keine auswertbaren Absorptionsdaten."]});
        const partner = data.partner(m, context.state.molecules, true);
        if (partner) {
          const paired = [m, partner].sort((a, b) => a.settings.configuration.localeCompare(b.settings.configuration));
          reportSections.push({title: "Zugehöriges cis/trans-Paar", columns: ["Struktur", "Konfiguration", "Emax / eV", "Lösungsfarbe", "Lichtdurchlässigkeit / %"],
            rows: paired.map((other) => { const result = SolutionColor.estimate(other.spectrum); return [identity(other), other.settings.configuration, fmt(data.curveMaximum(other.spectrum)?.energy), result ? data.color(result.rgb) : "nicht verfügbar", result ? fmt(100 * result.luminance, 1) : "nicht verfügbar"]; })});
          const second = SolutionColor.estimate(partner.spectrum), distance = color && second ? data.colorDistance(color.rgb, second.rgb) : null;
          if (distance != null) {
            colorComparisonRecord = {first_id: m.id, second_id: partner.id, first_rgb: color.rgb, second_rgb: second.rgb, cie76_distance: distance, reference_white: "D65", gamut: "clipped_sRGB", color_assumption: "fixed_absorbance_scale_no_concentration_or_path_length"};
            reportSections.push({title: "cis/trans-Farbabstand", paragraphs: [`Farbabstand der berechneten Farben: ${fmt(distance, 1)}. Größere Werte bedeuten größere Modellabstände, keine proportional empfundenen Unterschiede.`]});
          }
        } else reportSections.push({title: "cis/trans-Vergleich", paragraphs: ["Kein eindeutig zuordenbares cis/trans-Paar mit abgeschlossenen Minimumsuchen und Spektren gespeichert. Berechnen Sie beide Konfigurationen desselben Substitutionsmusters."]});
      }
      const sources = [m, source(m), data.partner(m, context.state.molecules, step === "spectrum")].filter(Boolean);
      methodSections = [{title: "Weitere Angaben zum Ergebnis", optional: true,
        paragraphs: [...(step === "spectrum" && spectrum ? [data.outputMethods[0], ...(colorComparisonRecord ? [data.outputMethods[1]] : [])] : [])],
        columns: ["Struktur", "Gespeicherte Kennung"], rows: sources.map((other) => [recordLabel(other), other.id])}];
      display("accessible-context", methodSections);
      display("result-report-content", reportSections);
      updateQuery();
      this.reportSections = reportSections;
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
