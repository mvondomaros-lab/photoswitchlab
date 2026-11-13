"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

// Parse the maintained templates into a small mutable tree. This tests actual
// node order/identity and restoration without substituting a second layout.
function templateDocument(path) {
  let mutations = 0;
  class Node {
    constructor(tagName, attributes = {}) {
      this.tagName = tagName;
      this.attributes = attributes;
      this.id = attributes.id;
      this.children = [];
      this.parentNode = null;
      this.hidden = "hidden" in attributes;
      this.open = "open" in attributes;
      this.value = attributes.value || "";
      this.textContent = "";
    }
    get nextSibling() { return this.parentNode?.children[this.parentNode.children.indexOf(this) + 1] || null; }
    get previousSibling() { return this.parentNode?.children[this.parentNode.children.indexOf(this) - 1] || null; }
    insertBefore(node, reference) {
      if (node === reference) return node;
      if (node.parentNode) node.parentNode.children.splice(node.parentNode.children.indexOf(node), 1);
      const index = reference ? this.children.indexOf(reference) : this.children.length;
      assert.ok(index >= 0);
      this.children.splice(index, 0, node);
      node.parentNode = this;
      mutations++;
      return node;
    }
    append(node) { this.insertBefore(node, null); }
    querySelectorAll(selector) {
      if (selector.startsWith("#")) return descendants(this).filter((node) => node.id === selector.slice(1));
      const [tag, name] = selector.split(".");
      return descendants(this).filter((node) => (!tag || node.tagName === tag) && (!name || (node.attributes.class || "").split(/\s+/).includes(name)));
    }
    querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  }
  const root = new Node("document"), stack = [root];
  const voidTags = new Set(["meta", "link", "input", "img", "br", "hr", "source"]);
  for (const token of fs.readFileSync(path, "utf8").matchAll(/<!--[\s\S]*?-->|<\/?[a-zA-Z][^>]*>/g)) {
    if (token[0].startsWith("<!--")) continue;
    const tag = token[0].match(/^<\/?([\w-]+)/)[1].toLowerCase();
    if (token[0].startsWith("</")) {
      const index = stack.findLastIndex((node) => node.tagName === tag);
      if (index > 0) stack.length = index;
      continue;
    }
    const attributes = {};
    for (const attribute of token[0].matchAll(/\s([\w-]+)(?:="([^"]*)")?/g)) attributes[attribute[1]] = attribute[2] ?? "";
    const node = new Node(tag, attributes);
    stack.at(-1).append(node);
    if (!voidTags.has(tag) && !token[0].endsWith("/>")) stack.push(node);
  }
  function descendants(node) { return node.children.flatMap((child) => [child, ...descendants(child)]); }
  root.getElementById = (id) => descendants(root).find((node) => node.id === id);
  root.createComment = () => new Node("comment");
  root.body = root.querySelector("body");
  root.body.classList = {toggle() {}};
  root.mutations = () => mutations;
  root.nodes = () => descendants(root);
  return root;
}

test("simplified app uses the original controls in linear DOM order and restores them without state loss", () => {
  const document = templateDocument("src/photoswitchlab/web/static/index.html");
  const $ = (id) => document.getElementById(id);
  const originalIds = document.nodes().filter((node) => node.id).map((node) => node.id).sort();
  const moved = ["guide-open", "guide", "job-status", "method-build", "method-optimize", "method-spectrum", "observations-collection", "data-report", "remember-observation", "fundamentals-link", "converter-open"];
  const originals = new Map(moved.map((id) => [id, {node: $(id), parent: $(id).parentNode}]));
  $("molecule-select").textContent = "Gewählte Minimumstruktur";
  $("job-status").hidden = false;
  $("job-title").textContent = "Berechnung läuft";
  const context = vm.createContext({});
  vm.runInContext(fs.readFileSync("src/photoswitchlab/web/static/presentation.js", "utf8"), context);
  const layout = context.PresentationLayout.create(document);
  layout.apply(true, "optimize");
  assert.equal($("guide-open").parentNode.id, "simple-task-access");
  assert.equal($("job-status").parentNode.id, "simple-calculation-status");
  assert.equal($("method-optimize").parentNode.id, "simple-methods");
  assert.equal($("method-optimize").hidden, false);
  assert.equal($("method-build").hidden, true);
  assert.equal($("accessible-results-summary").hidden, true);
  assert.equal($("accessible-results").open, true);
  const order = document.nodes().filter((node) => node.id).map((node) => node.id);
  for (const [before, after] of [["guide-open", "structure-library"], ["optimize", "job-status"], ["job-status", "accessible-current"], ["accessible-current", "observations-collection"], ["observations-collection", "data-report"], ["data-report", "atom-explorer"], ["atom-explorer", "method-optimize"]]) assert.ok(order.indexOf(before) < order.indexOf(after), `${before} precedes ${after}`);
  layout.captureAfter("atom-angle");
  assert.equal($("remember-observation").previousSibling, $("atom-angle"));
  const mutations = document.mutations();
  layout.apply(true, "optimize");
  assert.equal(document.mutations(), mutations); // Polling does not reparent focused controls.
  layout.apply(true, "build");
  assert.equal($("active-name").textContent, "Ausgewählte Startstruktur");
  assert.equal($("structure-choice-label").textContent, "Ausgewählte Struktur");
  assert.equal($("molecule-select").textContent, "Gewählte Minimumstruktur");
  layout.apply(false, "optimize");
  for (const [id, original] of originals) {
    assert.equal($(id), original.node, id);
    assert.equal($(id).parentNode, original.parent, id);
  }
  assert.equal($("molecule-select").textContent, "Gewählte Minimumstruktur");
  assert.equal($("job-title").textContent, "Berechnung läuft");
  assert.deepEqual(document.nodes().filter((node) => node.id).map((node) => node.id).sort(), originalIds);
  assert.equal(document.nodes().filter((node) => node.id === "structure-picker").length, 1);
});

test("simplified website moves its original compact navigation into the reading flow and restores it", () => {
  const document = templateDocument("site/template.html");
  document.currentScript = {src: "https://example.org/assets/site.js"};
  const preference = document.getElementById("text-preference");
  const listeners = new Map();
  preference.addEventListener = (type, handler) => listeners.set(type, handler);
  const sidebar = document.querySelector(".sidebar"), main = document.querySelector("main"), article = main.querySelector("article");
  const originalParent = sidebar.parentNode;
  const context = vm.createContext({document, location: {search: ""}, URL, URLSearchParams,
    localStorage: {getItem: () => null, setItem() {}}, matchMedia: () => ({matches: false})});
  const script = fs.readFileSync("site/assets/site.js", "utf8");
  vm.runInContext(script.slice(0, script.indexOf("const mobileNavigation")), context);
  preference.checked = true;
  listeners.get("change")();
  assert.equal(sidebar.parentNode, main);
  assert.equal(sidebar.nextSibling, article);
  assert.equal(sidebar.querySelector(".site-menu").open, false);
  preference.checked = false;
  listeners.get("change")();
  assert.equal(sidebar.parentNode, originalParent);
  assert.equal(sidebar.querySelector(".site-menu").open, true);
});
