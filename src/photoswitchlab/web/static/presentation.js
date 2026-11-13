/* Reuse the same controls in a linear workflow; restore their original positions. */
"use strict";
globalThis.PresentationLayout = {
  create(document) {
    if (!document.createComment) return null;
    const $ = (id) => document.getElementById(id);
    const origins = new Map();
    function move(node, destination, after = false) {
      if (!node?.parentNode || !destination) return;
      if (after ? node.parentNode === destination.parentNode && node.previousSibling === destination : node.parentNode === destination) return;
      if (!origins.has(node)) {
        const marker = document.createComment(`Original position: ${node.id}`);
        node.parentNode.insertBefore(marker, node);
        origins.set(node, marker);
      }
      if (after) destination.parentNode.insertBefore(node, destination.nextSibling);
      else destination.append(node);
    }
    function restore() {
      for (const [node, marker] of origins) if (marker.nextSibling !== node) marker.parentNode.insertBefore(node, marker.nextSibling);
    }
    return {
      apply(enabled, step) {
        $("accessible-results-summary").hidden = enabled;
        if (enabled) {
          $("accessible-results").open = true;
          move($("guide-open"), $("simple-task-access"));
          move($("guide"), $("simple-task-access"));
          move($("job-status"), $("simple-calculation-status"));
          move($("fundamentals-link"), $("simple-tools"));
          if ($("converter").open) $("converter").close?.();
          move($("converter-content"), $("simple-converter"));
          for (const key of ["build", "optimize", "spectrum"]) {
            const method = $(`method-${key}`);
            move(method, $("simple-methods"));
            method.hidden = key !== step;
          }
          move($("ts-details"), $("simple-methods"));
          const heading = step === "build" ? "Ausgewählte Startstruktur" : "Ergebnis";
          if ($("active-name").textContent !== heading) $("active-name").textContent = heading;
          if ($("structure-choice-label").textContent !== "Ausgewählte Struktur") $("structure-choice-label").textContent = "Ausgewählte Struktur";
        } else {
          restore();
          if ($("structure-choice-label").textContent !== "Gespeicherte Strukturen") $("structure-choice-label").textContent = "Gespeicherte Strukturen";
          for (const key of ["build", "optimize", "spectrum"]) $(`method-${key}`).hidden = false;
        }
      },
    };
  },
};
