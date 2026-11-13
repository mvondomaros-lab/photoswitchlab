/* Shared result data for visual and nonvisual exploration. No network services. */
"use strict";
globalThis.AccessibleData = {
  decimal(text) {
    const value = String(text).trim();
    if (!/^[+-]?(?:\d+(?:[.,]\d+)?|[.,]\d+)$/.test(value)) return null;
    const parsed = Number(value.replace(",", "."));
    return Number.isFinite(parsed) ? parsed : null;
  },
  atomLabel(graph, index) {
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
    return `Atom ${atom.number} (${atom.element}${position ? `, ${atom.position ? "Ringposition" : "Ringbezug"} ${position}` : ""})`;
  },
  outputMethods: [
    "Kurvenabfragen: Zwischen gespeicherten Kurvenpunkten wird die relative Absorption linear interpoliert.",
    "Farbvergleich: CIE76 ist der Abstand der berechneten sRGB-Bildschirmfarben im CIE-L*a*b*-Farbraum mit D65-Referenzweiß. Größere Werte bedeuten größere Modellabstände, keine proportional empfundenen Unterschiede. Die Umrechnung begrenzt die Farben auf sRGB. Beide Farben verwenden dieselbe feste Absorbanzskalierung.",
  ],
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
    if (delta < 20) return min > 230 ? "annähernd weiß" : "annähernd grau";
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
  report(sections) {
    const escape = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"})[c]);
    const content = sections.map(({title, paragraphs = [], rows = [], optional = false}) => {
      const body =
      paragraphs.map((p) => `<p>${escape(p)}</p>`).join("") +
      (rows.length ? `<table><caption>${escape(title)}</caption><thead><tr><th scope="col">Größe oder Angabe</th><th scope="col">Wert</th></tr></thead><tbody>` + rows.map(([label, value]) => `<tr><th scope="row">${escape(label)}</th><td>${escape(value)}</td></tr>`).join("") + "</tbody></table>" : "");
      return optional ? `<details><summary>${escape(title)}</summary>${body}</details>` : `<section><h2>${escape(title)}</h2>${body}</section>`;
    }).join("");
    return `<!doctype html><html lang="de"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>PhotoSwitchLab Ergebnisbericht</title><style>body{font:1rem/1.6 system-ui,sans-serif;max-width:75ch;margin:2rem auto;padding:0 1rem;color:#192d43;background:white}h1,h2{line-height:1.3}section{margin:2rem 0}table{border-collapse:collapse;width:100%}caption{text-align:left;font-weight:600}th,td{border:1px solid #b8c4d0;padding:.5rem;text-align:left;overflow-wrap:anywhere}thead{background:#edf2f7}th[scope=row]{width:45%}@media(max-width:400px){th,td{padding:.3rem}}@media print{body{max-width:none;margin:0}}</style><main><h1>PhotoSwitchLab Ergebnisbericht</h1><p>Gespeicherte Struktur und gezielt ausgewählte Daten. Wissenschaftliche Deutungen ergänzen Sie selbst im Protokoll.</p>${content}</main></html>`;
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
    const $ = (id) => document.getElementById(id);
    const data = AccessibleData;
    const setText = (id, text) => {
      if ($(id).textContent !== text) $(id).textContent = text;
    };
    const fmt = (value, digits = 4) => Number.isFinite(value) ? value.toLocaleString("de-DE", {
      minimumFractionDigits: digits, maximumFractionDigits: digits,
    }) : "nicht verfügbar";
    const preference = $("text-preference");
    const query = new URLSearchParams(location.search).get("text");
    let saved = false;
    try { saved = localStorage.getItem("photoswitchlab.textPreferred") === "true"; } catch { /* Storage may be blocked. */ }
    preference.checked = query === "1" || (query !== "0" && saved);
    if (query === "1" || query === "0") {
      try { localStorage.setItem("photoswitchlab.textPreferred", String(preference.checked)); } catch { /* Optional persistence. */ }
    }
    const disclosurePreference = { graphical: $("accessible-results").open, text: true };
    const applyPreference = () => {
      this.prefersText = preference.checked;
      document.body.classList.toggle("text-preferred", this.prefersText);
      $("accessible-results").open = disclosurePreference[this.prefersText ? "text" : "graphical"];
    };
    applyPreference();
    preference.onchange = () => {
      disclosurePreference[this.prefersText ? "text" : "graphical"] = $("accessible-results").open;
      applyPreference();
      try { localStorage.setItem("photoswitchlab.textPreferred", String(preference.checked)); } catch { /* Optional persistence. */ }
      context.render();
      this.announce(preference.checked ? "Text und Tabellen werden bevorzugt." : "Grafische Ansicht wird bevorzugt.");
    };
    this.announce = (message) => { setText("accessible-status", message); };
    let moleculeKey = null, pointIndex = null, points = [], path = false;
    let positions = [], graph = [], csvRows = [], tableSignature = "", graphKey = null;
    let selectedTransition = null, curveQuery = null, comparison = null, comparisonSignature = "";
    let reportSections = [], colorComparisonRecord = null;
    const observations = [];
    let observationNumber = 0;
    function fillSelect(select, options, value) {
      select.replaceChildren(...options.map(([label, key]) => new Option(label, key)));
      if (value != null && [...select.options].some((option) => option.value === String(value))) select.value = value;
    }
    const measurement = () => {
      const first = Number($("atom-first").value), second = Number($("atom-second").value), third = Number($("atom-third").value);
      const atom = graph[first];
      setText("atom-neighbors", atom ? `${data.atomLabel(graph, first)}: ` +
        (atom.neighbors?.length ? atom.neighbors.map((neighbor) => {
          const bond = neighbor.bond_order === 1.5 ? "aromatische Bindung" : neighbor.bond_order === 1 ? "Einfachbindung" : neighbor.bond_order === 2 ? "Doppelbindung" : `Bindungsordnung ${fmt(neighbor.bond_order, 1)}`;
          return `${data.atomLabel(graph, neighbor.number - 1)}, ${bond}`;
        }).join("; ") : "keine gespeicherten Bindungen") + "." : "Für diese gespeicherte Struktur fehlen Atom- und Bindungsdaten. Erstellen Sie die Struktur erneut.");
      const distance = data.distance(positions, first, second);
      setText("atom-distance", graph.length ? `Abstand ${data.atomLabel(graph, first)} zu ${data.atomLabel(graph, second)}: ${fmt(distance, 1)} pm.` : "");
      setText("atom-angle", graph.length ? `Winkel ${[first, second, third].map((index) => data.atomLabel(graph, index)).join(" – ")}: ${fmt(data.angle(positions, first, second, third), 1)} °.` : "");
    };
    $("atom-first").onchange = $("atom-second").onchange = $("atom-third").onchange = () => {
      measurement();
      this.announce($("atom-distance").textContent + " " + $("atom-angle").textContent);
    };
    $("path-point").onchange = () => {
      if ($("path-point").value === "") {
        pointIndex = null;
        context.showResult();
        this.announce("Gespeicherte Struktur ausgewählt.");
        return;
      }
      pointIndex = Number($("path-point").value);
      const point = points[pointIndex], playback = context.playback();
      const i = playback.records.findIndex((p) => path ? p.image === point.image : p.step === point.step);
      if (i >= 0 && !context.state.busy) context.selectFrame(i);
      this.render();
      this.announce($("accessible-point").textContent);
    };
    $("transition-point").onchange = () => {
      selectedTransition = $("transition-point").value === "" ? null : Number($("transition-point").value);
      this.render();
      this.announce($("transition-value").textContent);
    };
    $("color-comparison").onchange = () => {
      comparison = $("color-comparison").value || null;
      this.render();
      this.announce($("color-comparison-value").textContent);
    };
    $("curve-query").onclick = () => {
      const spec = context.current()?.spectrum;
      const energy = data.decimal($("curve-energy").value);
      const value = energy == null ? null : data.absorption(spec, energy);
      curveQuery = value == null ? null : {energy, value};
      setText("curve-value", energy == null ? "Geben Sie eine Zahl mit Dezimalkomma oder Dezimalpunkt ein, zum Beispiel 3,5."
        : value == null
        ? `Geben Sie eine Energie zwischen ${fmt(spec?.energy_ev?.[0])} und ${fmt(spec?.energy_ev?.at(-1))} eV ein.`
        : `${fmt(energy)} eV · ${fmt(1239.8419843320026 / energy, 1)} nm · relative Absorption ${fmt(value)}.`);
    };
    const snapshot = (force = false) => {
      const m = context.current();
      if (!m) return null;
      const paragraphs = [$("accessible-identity").textContent, $("accessible-geometry").textContent];
      const selected = points[pointIndex];
      let hasSelection = false;
      if (selected && context.state.step === "optimize") {
        paragraphs.push($("accessible-point").textContent, $("accessible-path-note").textContent, $("accessible-azo-angles").textContent);
        hasSelection = true;
      }
      if ($("atom-explorer").open && graph.length) {
        paragraphs.push($("atom-distance").textContent, $("atom-angle").textContent);
        hasSelection = true;
      }
      if (curveQuery) {
        paragraphs.push($("curve-value").textContent);
        if (m.spectrum?.coverage_complete === false) paragraphs.push("Am oberen Rand des berechneten Energiebereichs fehlen möglicherweise Beiträge weiterer Übergänge; die Absorption kann dort unterschätzt werden.");
        hasSelection = true;
      }
      if (selectedTransition != null) { paragraphs.push($("transition-value").textContent); hasSelection = true; }
      if (colorComparisonRecord) { paragraphs.push($("color-comparison-value").textContent); hasSelection = true; }
      if (!force && !hasSelection) return null;
      return {key: JSON.stringify([m.id, paragraphs]), hasColor: !!colorComparisonRecord, hasCurve: !!curveQuery, section: {title: "Aktuelle Auswahl", paragraphs}};
    };
    const renderObservations = () => {
      setText("observations-summary", `Gemerkte Beobachtungen (${observations.length})`);
      $("clear-observations").disabled = !observations.length;
      $("observations-list").replaceChildren(...observations.map((entry) => {
        const item = document.createElement("li"), label = document.createElement("p"), remove = document.createElement("button");
        label.textContent = `${entry.section.title}: ${entry.section.paragraphs.join(" ")}`;
        remove.type = "button";
        remove.textContent = `${entry.section.title} entfernen`;
        remove.onclick = () => {
          observations.splice(observations.indexOf(entry), 1);
          renderObservations();
          $("observations-summary").focus?.();
          this.announce("Beobachtung entfernt.");
        };
        item.append(label, remove);
        return item;
      }));
    };
    $("remember-observation").onclick = () => {
      this.render();
      const entry = snapshot(true);
      if (!entry) return;
      if (observations.some((saved) => saved.key === entry.key)) {
        this.announce("Diese Auswahl ist bereits gemerkt.");
        return;
      }
      entry.section.title = `Beobachtung ${++observationNumber}`;
      observations.push(entry);
      renderObservations();
      this.announce(`${entry.section.title} für den Bericht gemerkt.`);
    };
    $("clear-observations").onclick = () => {
      observations.length = 0;
      renderObservations();
      $("observations-summary").focus?.();
      this.announce("Sammlung geleert.");
    };
    $("data-report").onclick = () => {
      this.render();
      const sections = reportSections.filter((section) => !section.selected);
      if (observations.some((entry) => entry.hasColor) && !SolutionColor.estimate(context.current()?.spectrum)) sections.push({title: "Farbvergleiche der Sammlung", paragraphs: ["Farbmodell ohne festgelegte Konzentration oder Schichtdicke."]});
      sections.push(...observations.map((entry) => entry.section));
      const current = snapshot();
      if (current && !observations.some((saved) => saved.key === current.key)) sections.push(current.section);
      const evidence = current ? [...observations, current] : observations;
      const methods = [];
      if (evidence.some((entry) => entry.hasCurve)) methods.push(data.outputMethods[0]);
      if (evidence.some((entry) => entry.hasColor)) methods.push(data.outputMethods[1]);
      if (methods.length) sections.push({title: "Methoden zur Datenausgabe", paragraphs: methods, optional: true});
      context.download(data.report(sections), context.filename("html"), "text/html;charset=utf-8");
    };
    $("data-json").onclick = () => context.download(JSON.stringify({
      molecule: context.current(), displayed_record: points[pointIndex] || null,
      optimization_records: context.records(),
      color_comparison: colorComparisonRecord,
      observations,
    }, null, 2), context.filename("json"), "application/json");
    $("data-csv").onclick = () => context.download(data.csv(csvRows), context.filename("csv"), "text/csv;charset=utf-8");
    this.render = () => {
      const m = context.current();
      $("accessible-results").hidden = !m;
      if (!m) return;
      const key = `${m.id}:${context.state.step}`;
      if (key !== moleculeKey) {
        moleculeKey = key;
        pointIndex = null;
        selectedTransition = null;
        curveQuery = null;
        comparison = null;
        setText("curve-value", "");
      }
      const labels = { initial: "Startstruktur", minimum: "Minimumstruktur", ts: "Übergangsstruktur", unconverged: "Optimierung nicht abgeschlossen" };
      const subs = (m.settings?.substituents || []).flatMap((sub, i) => sub === "H" ? [] : [`${i % 5 + 2}${i >= 5 ? "′" : ""}: ${context.substituentLabel(sub)}`]);
      const identity = `${context.label(m)} · ${labels[m.kind] || m.kind}. ${m.formula}, ${m.atom_count} Atome.`;
      const assumptions = `Substituenten: ${subs.join("; ") || "keine"}. Elektronische Energien: GFN1-xTB.${m.kind === "initial" ? " Generierte, noch nicht quantenchemisch optimierte Startstruktur." : ""}${m.converged === false ? " Optimierung nicht abgeschlossen." : ""}${m.ts_search ? m.ts_search.connectivity?.verified ? " Verbindung zwischen cis und trans bestätigt." : " Verbindung zwischen cis und trans nicht bestätigt." : ""}`;
      setText("accessible-identity", identity);
      setText("accessible-assumptions", assumptions);
      path = !!m.ts_search?.path?.length;
      points = path ? m.ts_search.path : context.records().filter((p) => Number.isFinite(p.energy_ev));
      if (context.state.live?.replay) {
        const index = points.findIndex((p) => path ? p.image === context.state.live.image : p.step === context.state.live.step);
        if (index >= 0) pointIndex = index;
      }
      if (pointIndex >= points.length) pointIndex = null;
      const selected = points[pointIndex];
      const preview = selected && context.state.step === "optimize";
      positions = preview ? selected.positions : data.coordinates(m.xyz);
      const props = preview ? { ...OptimizationProgress.geometryProperties(positions, m.geometry_definition), energy_ev: selected.energy_ev } : m.properties;
      const geometryText = `${preview ? path ? `Pfadstruktur ${pointIndex + 1}` : `Rechenschritt ${selected.step}` : "Gespeicherte Struktur"}: elektronische Energie ${fmt(props?.energy_ev)} eV; Diederwinkel C–N=N–C ${fmt(props?.dihedral_deg, 1)} °; Ringabstand ${fmt(props?.ring_distance_pm, 1)} pm.`;
      setText("accessible-geometry", geometryText);
      let azoAngles = "";
      if (m.geometry_definition) {
        const [a, b, c, d] = m.geometry_definition.dihedral_indices;
        azoAngles = `Winkel C–N=N ${fmt(data.angle(positions, a, b, c), 1)} °; Winkel N=N–C ${fmt(data.angle(positions, b, c, d), 1)} °.`;
      }
      setText("accessible-azo-angles", azoAngles);
      graph = m.atom_graph || [];
      if (graphKey !== m.id) {
        graphKey = m.id;
        const options = graph.map((_atom, i) => [data.atomLabel(graph, i), i]);
        fillSelect($("atom-first"), options, 0);
        fillSelect($("atom-second"), options, Math.min(1, graph.length - 1));
        fillSelect($("atom-third"), options, Math.min(2, graph.length - 1));
        $("atom-first").disabled = $("atom-second").disabled = $("atom-third").disabled = !graph.length;
        setText("atom-rings", m.geometry_definition ? `Diederwinkel: Atome ${m.geometry_definition.dihedral_indices.map((i) => i + 1).join("–")}. Phenylringe: ${m.geometry_definition.rings.map((ring) => ring.map((i) => i + 1).join(", ")).join("; ")}.` : "");
      }
      measurement();
      $("accessible-path").hidden = context.state.step !== "optimize" || !points.length;
      setText("accessible-path-note", path
        ? "Reaktionspfad im elektronischen Grundzustand. ΔE bezieht sich auf die erste Pfadstruktur. Die Auswahl zeigt einzelne berechnete Geometrien, keine molekulare Dynamik."
        : "Rechenschritte der Suche, keine Zeitachse. ΔE bezieht sich auf den ersten gespeicherten Suchschritt. Suchschritte einer Übergangsstruktursuche bilden noch keinen Reaktionspfad.");
      setText("energy-table-caption", path ? "Berechnete Strukturen des Reaktionspfads" : "Gespeicherte Suchschritte");
      const energyRows = points.map((p, i) => {
        const geometry = OptimizationProgress.geometryProperties(p.positions, m.geometry_definition);
        return [path ? i + 1 : p.step, p.energy_ev, p.energy_ev - points[0].energy_ev, geometry.dihedral_deg, geometry.ring_distance_pm];
      });
      const signature = JSON.stringify([m.id, energyRows, m.spectrum]);
      if (signature !== tableSignature) {
        tableSignature = signature;
        fillSelect($("path-point"), [["Gespeicherte Struktur", ""], ...energyRows.map((row, i) => [`${path ? "Pfadstruktur" : "Rechenschritt"} ${row[0]} · ${fmt(row[1])} eV`, i])], pointIndex ?? "");
        const table = (id, rows, digits) => {
          $(id).replaceChildren(...rows.map((row) => {
            const tr = document.createElement("tr");
            row.forEach((value, i) => {
              const cell = document.createElement(i ? "td" : "th");
              if (!i) cell.scope = "row";
              cell.textContent = i ? fmt(value, digits[i] ?? 4) : String(value);
              tr.append(cell);
            });
            return tr;
          }));
        };
        table("energy-table-body", energyRows, [0, 4, 4, 1, 1]);
        const spec = m.spectrum;
        table("transition-table-body", (spec?.excitations_ev || []).map((e, i) => [i + 1, e, 1239.8419843320026 / e, spec.oscillator_strengths[i]]), [0, 4, 1, 4]);
        fillSelect($("transition-point"), [["Übergang auswählen", ""], ...(spec?.excitations_ev || []).map((e, i) => [`Übergang ${i + 1} · ${fmt(e)} eV`, i])], selectedTransition ?? "");
      }
      $("path-point").value = pointIndex == null ? "" : String(pointIndex);
      setText("accessible-point", selected ? `${path ? "Pfadstruktur" : "Rechenschritt"} ${path ? pointIndex + 1 : selected.step}: E = ${fmt(selected.energy_ev)} eV; ΔE = ${fmt(selected.energy_ev - points[0].energy_ev)} eV.` : "");
      $("accessible-spectrum").hidden = !m.spectrum;
      const spec = m.spectrum;
      reportSections = [{title: "Gespeicherte Struktur", paragraphs: [identity, assumptions], rows: [
        ["Elektronische Energie / eV", fmt(m.properties?.energy_ev)],
        ["Diederwinkel C–N=N–C / °", fmt(m.properties?.dihedral_deg, 1)],
        ["Ringabstand / pm", fmt(m.properties?.ring_distance_pm, 1)],
      ]}];
      if (m.ts_search) {
        const ts = m.ts_search;
        reportSections.push({title: "Prüfung der Übergangsstruktur", paragraphs: [ts.failure_reason || ""], rows: [
          ["Optimierung abgeschlossen", m.converged ? "ja" : "nein"],
          ["Verbindung zwischen cis und trans bestätigt", ts.connectivity?.verified ? "ja" : "nein"],
          ["Imaginäre Frequenzen mit einem Betrag über 20 cm⁻¹", ts.validation?.imaginary_count ?? "noch nicht geprüft"],
          ["Betrag der imaginären Frequenz / cm⁻¹", Number.isFinite(ts.validation?.imaginary_frequency_cm1) ? fmt(Math.abs(ts.validation.imaginary_frequency_cm1), 1) : "nicht verfügbar"],
        ]});
      }
      if (preview) reportSections.push({title: "Ausgewählte Zwischenstruktur", selected: true, paragraphs: [geometryText, azoAngles, $("accessible-path-note").textContent], rows: [
        ["Schritt / Pfadstruktur", path ? pointIndex + 1 : selected.step],
        ["Elektronische Energie / eV", fmt(selected.energy_ev)],
        ["ΔE zur ersten gespeicherten Struktur der Tabelle / eV", fmt(selected.energy_ev - points[0].energy_ev)],
      ]});
      colorComparisonRecord = null;
      $("accessible-output-methods").hidden = !spec;
      setText("accessible-output-methods", spec ? data.outputMethods.join("\n\n") : "");
      if (spec) {
        $("curve-energy").min = spec.energy_ev[0];
        $("curve-energy").max = spec.energy_ev.at(-1);
        const peak = spec.absorption.indexOf(Math.max(...spec.absorption));
        setText("accessible-spectrum-summary", `Maximum im berechneten Kurvenbereich: ${fmt(spec.energy_ev[peak])} eV · ${fmt(1239.8419843320026 / spec.energy_ev[peak], 1)} nm.`);
        setText("accessible-spectrum-note", `INDO/S–CIS. Relative Absorption in willkürlichen Einheiten. Kurvenbereich ${fmt(spec.energy_ev[0])} bis ${fmt(spec.energy_ev.at(-1))} eV.${spec.coverage_complete === false ? " Am oberen Rand fehlen möglicherweise Beiträge weiterer Übergänge; die Absorption kann dort unterschätzt werden." : ""}`);
        $("transition-point").value = selectedTransition == null ? "" : String(selectedTransition);
        const transition = spec.excitations_ev[selectedTransition];
        setText("transition-value", Number.isFinite(transition) ? `Übergang ${selectedTransition + 1}: ${fmt(transition)} eV · ${fmt(1239.8419843320026 / transition, 1)} nm · Oszillatorstärke ${fmt(spec.oscillator_strengths[selectedTransition])}.` : "");
        const color = SolutionColor.estimate(spec);
        setText("accessible-color", color ? `Geschätzte Lösungsfarbe: ${data.color(color.rgb)}; gewichtete Lichtdurchlässigkeit ${fmt(100 * color.luminance, 1)} %. Farbmodell ohne festgelegte Konzentration oder Schichtdicke.` : "Keine Farbschätzung verfügbar: Das Spektrum ist unvollständig oder enthält keine auswertbaren Absorptionsdaten.");
        reportSections.push({title: "Berechnetes UV/Vis-Spektrum", paragraphs: [$("accessible-spectrum-summary").textContent, $("accessible-spectrum-note").textContent, $("accessible-color").textContent]});
        const candidates = context.state.molecules.filter((other) => other.id !== m.id && SolutionColor.estimate(other.spectrum));
        const candidateSignature = JSON.stringify([m.id, candidates.map((other) => [other.id, context.label(other)])]);
        if (candidateSignature !== comparisonSignature) {
          comparisonSignature = candidateSignature;
          fillSelect($("color-comparison"), [["Zweite Struktur auswählen", ""], ...candidates.map((other) => [context.label(other), other.id])], comparison ?? "");
        }
        $("color-comparison").disabled = !color || !candidates.length;
        const other = candidates.find((candidate) => candidate.id === comparison);
        const second = other && SolutionColor.estimate(other.spectrum);
        const distance = color && second ? data.colorDistance(color.rgb, second.rgb) : null;
        const comparisonText = distance == null ? "Wählen Sie zwei Strukturen mit auswertbarer Farbschätzung aus." :
          `${context.label(m)} (${data.color(color.rgb)}) und ${context.label(other)} (${data.color(second.rgb)}): CIE76-Farbabstand ${fmt(distance, 1)}.`;
        setText("color-comparison-value", comparisonText);
        if (distance != null) {
          colorComparisonRecord = {first_id: m.id, second_id: other.id, first_rgb: color.rgb, second_rgb: second.rgb, cie76_distance: distance, reference_white: "D65", gamut: "clipped_sRGB", color_assumption: "fixed_absorbance_scale_no_concentration_or_path_length"};
          reportSections.push({title: "Ausgewählter Farbvergleich", selected: true, paragraphs: [comparisonText], rows: [
            ["Gewichtete Lichtdurchlässigkeit der ersten Struktur / %", fmt(100 * color.luminance, 1)],
            ["Gewichtete Lichtdurchlässigkeit der zweiten Struktur / %", fmt(100 * second.luminance, 1)],
          ]});
        }
      }
      csvRows = [["structure", "kind", "data_type", "index", "energy_ev", "delta_energy_ev", "wavelength_nm", "oscillator_strength", "relative_absorption", "dihedral_deg", "ring_distance_pm"],
        [context.label(m), m.kind, "saved_geometry", "", m.properties?.energy_ev, "", "", "", "", m.properties?.dihedral_deg, m.properties?.ring_distance_pm],
        ...energyRows.map((r) => [context.label(m), m.kind, path ? "path_relative_to_first" : "search_relative_to_first", r[0], r[1], r[2], "", "", "", r[3], r[4]]),
        ...(spec?.excitations_ev || []).map((e, i) => [context.label(m), m.kind, "transition", i + 1, e, "", 1239.8419843320026 / e, spec.oscillator_strengths[i]]),
        ...(spec?.energy_ev || []).map((e, i) => [context.label(m), m.kind, "absorption_curve", i + 1, e, "", 1239.8419843320026 / e, "", spec.absorption[i]])];
      const metadata = ["GFN1-xTB", spec ? "INDO/S-CIS" : "", m.converged ?? "not_applicable", m.ts_search?.connectivity?.verified ?? "not_applicable", spec?.coverage_complete ?? "not_applicable", "fixed_absorbance_scale_no_concentration_or_path_length"];
      csvRows = csvRows.map((row, i) => [...Array.from({length: 11}, (_, j) => row[j] ?? ""), ...(i ? metadata : ["energy_method", "spectrum_method", "converged", "connectivity_verified", "spectrum_coverage_complete", "color_assumption"])]);
    };
  },
};
