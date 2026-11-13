/* Shared result data for visual and nonvisual exploration. No network services. */
"use strict";
globalThis.AccessibleData = {
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
  csv(rows) {
    return rows.map((row) => row.map((value) => {
      const text = value == null ? "" : String(value);
      return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
    }).join(",")).join("\r\n");
  },
};

globalThis.AccessibilityView = {
  prefersText: false,
  showGraphics: false,
  initialize(context) {
    const $ = (id) => document.getElementById(id);
    const data = AccessibleData;
    const fmt = (value, digits = 4) => Number.isFinite(value) ? value.toLocaleString("de-DE", {
      minimumFractionDigits: digits, maximumFractionDigits: digits,
    }) : "nicht verfügbar";
    const preference = $("text-preference");
    const query = new URLSearchParams(location.search).get("text");
    let saved = false;
    try { saved = localStorage.getItem("photoswitchlab.textPreferred") === "true"; } catch { /* Storage may be blocked. */ }
    preference.checked = query === "1" || (query !== "0" && saved);
    const applyPreference = () => {
      this.prefersText = preference.checked;
      document.body.classList.toggle("text-preferred", this.prefersText);
      if (this.prefersText) $("accessible-results").open = true;
    };
    applyPreference();
    $("text-show-graphics").onchange = () => {
      this.showGraphics = $("text-show-graphics").checked;
      document.body.classList.toggle("show-graphics", this.showGraphics);
      context.render();
    };
    preference.onchange = () => {
      applyPreference();
      try { localStorage.setItem("photoswitchlab.textPreferred", String(preference.checked)); } catch { /* Optional persistence. */ }
      context.render();
      this.announce(preference.checked ? "Text und Tabellen werden bevorzugt." : "Grafische Ansicht wird bevorzugt.");
    };
    this.announce = (message) => { $("accessible-status").textContent = message; };
    let moleculeKey = null, pointIndex = null, points = [], path = false;
    let positions = [], graph = [], csvRows = [], tableSignature = "", graphKey = null;
    function fillSelect(select, options, value) {
      select.replaceChildren(...options.map(([label, key]) => new Option(label, key)));
      if (value != null && [...select.options].some((option) => option.value === String(value))) select.value = value;
    }
    const measurement = () => {
      const first = Number($("atom-first").value), second = Number($("atom-second").value), third = Number($("atom-third").value);
      const atom = graph[first];
      $("atom-neighbors").textContent = atom ? `Atom ${atom.number} (${atom.element}): ` +
        (atom.neighbors?.length ? atom.neighbors.map((neighbor) => {
          const other = graph[neighbor.number - 1];
          const bond = neighbor.bond_order === 1.5 ? "aromatische Bindung" : neighbor.bond_order === 1 ? "Einfachbindung" : neighbor.bond_order === 2 ? "Doppelbindung" : `Bindungsordnung ${fmt(neighbor.bond_order, 1)}`;
          return `Atom ${neighbor.number} (${other?.element || ""}), ${bond}`;
        }).join("; ") : "keine gespeicherten Bindungen") + "." : "Für diese gespeicherte Struktur fehlen Atom- und Bindungsdaten. Erstellen Sie die Struktur erneut.";
      const distance = data.distance(positions, first, second);
      $("atom-distance").textContent = graph.length ? `Abstand Atom ${first + 1} zu Atom ${second + 1}: ${fmt(distance, 1)} pm.` : "";
      $("atom-angle").textContent = graph.length ? `Winkel Atom ${first + 1}–${second + 1}–${third + 1}: ${fmt(data.angle(positions, first, second, third), 1)} °.` : "";
    };
    $("atom-first").onchange = $("atom-second").onchange = $("atom-third").onchange = measurement;
    $("path-point").onchange = () => {
      if ($("path-point").value === "") {
        pointIndex = null;
        context.showResult();
        return;
      }
      pointIndex = Number($("path-point").value);
      const point = points[pointIndex], playback = context.playback();
      const i = playback.records.findIndex((p) => path ? p.image === point.image : p.step === point.step);
      if (i >= 0 && !context.state.busy) context.selectFrame(i);
      this.render();
    };
    $("curve-query").onclick = () => {
      const spec = context.current()?.spectrum;
      const energy = $("curve-energy").valueAsNumber;
      const value = data.absorption(spec, energy);
      $("curve-value").textContent = value == null
        ? `Geben Sie eine Energie zwischen ${fmt(spec?.energy_ev?.[0])} und ${fmt(spec?.energy_ev?.at(-1))} eV ein.`
        : `${fmt(energy)} eV · ${fmt(1239.8419843320026 / energy, 1)} nm · relative Absorption ${fmt(value)} (linear zwischen gespeicherten Kurvenpunkten interpoliert).`;
    };
    $("data-json").onclick = () => context.download(JSON.stringify({
      molecule: context.current(), displayed_record: points[pointIndex] || null,
      optimization_records: context.records(),
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
        $("curve-value").textContent = "";
      }
      const labels = { initial: "Startstruktur", minimum: "Minimumstruktur", ts: "Übergangsstruktur", unconverged: "Optimierung nicht abgeschlossen" };
      const subs = (m.settings?.substituents || []).flatMap((sub, i) => sub === "H" ? [] : [`${i % 5 + 2}${i >= 5 ? "′" : ""}: ${context.substituentLabel(sub)}`]);
      $("accessible-identity").textContent = `${context.label(m)} · ${labels[m.kind] || m.kind}. ${m.formula}, ${m.atom_count} Atome. Substituenten: ${subs.join("; ") || "keine"}. Elektronische Energien: GFN1-xTB.${m.kind === "initial" ? " Generierte, noch nicht quantenchemisch optimierte Startstruktur." : ""}${m.converged === false ? " Optimierung nicht abgeschlossen." : ""}${m.ts_search ? m.ts_search.connectivity?.verified ? " Verbindung zwischen cis und trans bestätigt." : " Verbindung zwischen cis und trans nicht bestätigt." : ""}`;
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
      $("accessible-geometry").textContent = `${preview ? path ? `Pfadstruktur ${pointIndex + 1}` : `Rechenschritt ${selected.step}` : "Gespeicherte Struktur"}: elektronische Energie ${fmt(props?.energy_ev)} eV; Diederwinkel C–N=N–C ${fmt(props?.dihedral_deg, 1)} °; Ringabstand ${fmt(props?.ring_distance_pm, 1)} pm.`;
      if (m.geometry_definition) {
        const [a, b, c, d] = m.geometry_definition.dihedral_indices;
        $("accessible-geometry").textContent += ` Winkel C–N=N ${fmt(data.angle(positions, a, b, c), 1)} °; Winkel N=N–C ${fmt(data.angle(positions, b, c, d), 1)} °.`;
      }
      graph = m.atom_graph || [];
      if (graphKey !== m.id) {
        graphKey = m.id;
        const options = graph.map((atom, i) => [`Atom ${atom.number} (${atom.element}${atom.position ? `, Ringposition ${atom.position}` : ""})`, i]);
        fillSelect($("atom-first"), options, 0);
        fillSelect($("atom-second"), options, Math.min(1, graph.length - 1));
        fillSelect($("atom-third"), options, Math.min(2, graph.length - 1));
        $("atom-first").disabled = $("atom-second").disabled = $("atom-third").disabled = !graph.length;
        $("atom-rings").textContent = m.geometry_definition ? `Diederwinkel: Atome ${m.geometry_definition.dihedral_indices.map((i) => i + 1).join("–")}. Phenylringe: ${m.geometry_definition.rings.map((ring) => ring.map((i) => i + 1).join(", ")).join("; ")}.` : "";
      }
      measurement();
      $("accessible-path").hidden = context.state.step !== "optimize" || !points.length;
      $("accessible-path-note").textContent = path
        ? "Reaktionspfad im elektronischen Grundzustand. ΔE bezieht sich auf die erste Pfadstruktur. Die Auswahl zeigt einzelne berechnete Geometrien, keine molekulare Dynamik."
        : "Rechenschritte der Suche, keine Zeitachse. ΔE bezieht sich auf den ersten gespeicherten Suchschritt. Suchschritte einer Übergangsstruktursuche bilden noch keinen Reaktionspfad.";
      $("energy-table-caption").textContent = path ? "Berechnete Strukturen des Reaktionspfads" : "Gespeicherte Suchschritte";
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
      }
      $("path-point").value = pointIndex == null ? "" : String(pointIndex);
      $("accessible-point").textContent = selected ? `${path ? "Pfadstruktur" : "Rechenschritt"} ${path ? pointIndex + 1 : selected.step}: E = ${fmt(selected.energy_ev)} eV; ΔE = ${fmt(selected.energy_ev - points[0].energy_ev)} eV.` : "";
      $("accessible-spectrum").hidden = !m.spectrum;
      const spec = m.spectrum;
      if (spec) {
        $("curve-energy").min = spec.energy_ev[0];
        $("curve-energy").max = spec.energy_ev.at(-1);
        $("accessible-spectrum-note").textContent = `INDO/S–CIS. Relative Absorption in willkürlichen Einheiten. Kurvenbereich ${fmt(spec.energy_ev[0])} bis ${fmt(spec.energy_ev.at(-1))} eV.${spec.coverage_complete === false ? " Am oberen Rand fehlen möglicherweise Beiträge weiterer Übergänge; die Absorption kann dort unterschätzt werden." : ""}`;
        const color = SolutionColor.estimate(spec);
        $("accessible-color").textContent = color ? `Geschätzte Lösungsfarbe: ${data.color(color.rgb)}. Vereinfachte Farbbezeichnung aus der berechneten Bildschirmfarbe. Modellvorhersage mit fester Absorbanzskalierung; keine Lösung mit festgelegter Konzentration oder Schichtdicke.` : "Keine Farbschätzung verfügbar: Das Spektrum ist unvollständig oder enthält keine auswertbaren Absorptionsdaten.";
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
