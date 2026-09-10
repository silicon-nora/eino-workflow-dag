const samples = {
  agent: {
    label: "Agent with nested workflow",
    note: "Every leaf reports component Lambda; kind carries the stable visual meaning.",
    snapshot: {
      schemaVersion: 1,
      workflow: {
        name: "research-assistant",
        nodes: [
          { id: "intake", name: "Normalize request", component: "Lambda", kind: "io" },
          { id: "route", name: "Choose path", component: "Lambda", kind: "branch" },
          { id: "direct", name: "Direct response", component: "Lambda", kind: "cpu" },
          {
            id: "research",
            name: "Research workflow",
            component: "Lambda",
            kind: "graph",
            workflow: {
              name: "research",
              nodes: [
                { id: "lookup", name: "Retrieve context", component: "Lambda", kind: "io" },
                { id: "rank", name: "Rank evidence", component: "Lambda", kind: "cpu" },
                { id: "draft", name: "Draft answer", component: "Lambda", kind: "llm" },
              ],
              edges: [
                { from: "start", to: "lookup", channels: ["control", "data"] },
                { from: "lookup", to: "rank", channels: ["control", "data"] },
                { from: "rank", to: "draft", channels: ["control", "data"] },
                { from: "draft", to: "end", channels: ["control", "data"] },
              ],
            },
          },
          { id: "merge", name: "Merge result", component: "Lambda", kind: "merge" },
          { id: "deliver", name: "Deliver answer", component: "Lambda", kind: "io" },
        ],
        edges: [
          { from: "start", to: "intake", channels: ["control", "data"] },
          { from: "intake", to: "route", channels: ["control", "data"] },
          { from: "route", to: "direct", channels: ["control"] },
          { from: "route", to: "research", channels: ["control"] },
          { from: "direct", to: "merge", channels: ["control", "data"] },
          { from: "research", to: "merge", channels: ["control", "data"] },
          { from: "merge", to: "deliver", channels: ["control", "data"] },
          { from: "deliver", to: "end", channels: ["control", "data"] },
        ],
        branches: [{ from: "route", targets: ["direct", "research"] }],
      },
      execution: {
        id: "run-1042",
        durationMs: 812,
        nodes: [
          { path: ["intake"], status: "success", durationMs: 14 },
          { path: ["route"], status: "success", durationMs: 7 },
          { path: ["direct"], status: "skipped", durationMs: null },
          { path: ["research"], status: "success", durationMs: 743 },
          { path: ["research", "lookup"], status: "success", durationMs: 96 },
          { path: ["research", "rank"], status: "success", durationMs: 41 },
          { path: ["research", "draft"], status: "success", durationMs: 606 },
          { path: ["merge"], status: "success", durationMs: 25 },
          { path: ["deliver"], status: "success", durationMs: 23 },
        ],
      },
      metadata: { example: "public-playground" },
    },
  },
  recovery: {
    label: "Failure and recovery",
    note: "Final execution outcomes stay separate from topology and can be updated in place.",
    snapshot: {
      schemaVersion: 1,
      workflow: {
        name: "resilient-generation",
        nodes: [
          { id: "prepare", name: "Prepare input", component: "Lambda", kind: "io" },
          { id: "primary", name: "Primary model", component: "Lambda", kind: "llm" },
          { id: "fallback", name: "Fallback model", component: "Lambda", kind: "llm" },
          { id: "select", name: "Select result", component: "Lambda", kind: "merge" },
          { id: "store", name: "Store response", component: "Lambda", kind: "io" },
        ],
        edges: [
          { from: "start", to: "prepare", channels: ["control", "data"] },
          { from: "prepare", to: "primary", channels: ["control", "data"] },
          { from: "prepare", to: "fallback", channels: ["control", "data"] },
          { from: "primary", to: "select", channels: ["control", "data"] },
          { from: "fallback", to: "select", channels: ["control", "data"] },
          { from: "select", to: "store", channels: ["control", "data"] },
          { from: "store", to: "end", channels: ["control", "data"] },
        ],
        branches: [{ from: "prepare", targets: ["primary", "fallback"] }],
      },
      execution: {
        id: "run-2048",
        durationMs: 534,
        nodes: [
          { path: ["prepare"], status: "success", durationMs: 18 },
          { path: ["primary"], status: "failed", durationMs: 311, errorMessage: "model unavailable" },
          { path: ["fallback"], status: "success", durationMs: 469 },
          { path: ["select"], status: "success", durationMs: 22 },
          { path: ["store"], status: "success", durationMs: 25 },
        ],
      },
    },
  },
  minimal: {
    label: "Minimal protocol",
    note: "The smallest useful schema-v1 document: two nodes and one typed dependency.",
    snapshot: {
      schemaVersion: 1,
      workflow: {
        nodes: [
          { id: "input", name: "Input", kind: "io" },
          { id: "model", name: "Generate", kind: "llm" },
        ],
        edges: [
          { from: "input", to: "model", channels: ["control", "data"] },
        ],
      },
    },
  },
};

const elements = {
  host: document.querySelector("#dag"),
  sample: document.querySelector("#sample"),
  sampleNote: document.querySelector("#sample-note"),
  editor: document.querySelector("#snapshot-json"),
  apply: document.querySelector("#apply-json"),
  format: document.querySelector("#format-json"),
  copy: document.querySelector("#copy-json"),
  issues: document.querySelector("#issue-list"),
  validation: document.querySelector("#validation-result"),
  statusLight: document.querySelector("#status-light"),
  renderStatus: document.querySelector("#render-status"),
  renderSummary: document.querySelector("#render-summary"),
  selectedPath: document.querySelector("#selected-path"),
  layouts: document.querySelector("#metric-layouts"),
  patches: document.querySelector("#metric-patches"),
  cache: document.querySelector("#metric-cache"),
  themes: document.querySelector("#theme-controls"),
};

let api;
let instance;
let activeSnapshot;
let activeDirection = "RIGHT";
let activeTheme = "classic";

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function assetBase() {
  const configured = document
    .querySelector('meta[name="eino-workflow-dag-asset-base"]')
    ?.getAttribute("content") || "./dist/";
  return new URL(configured, document.baseURI);
}

function loadRenderer() {
  const base = assetBase();
  const stylesheet = document.createElement("link");
  stylesheet.rel = "stylesheet";
  stylesheet.href = new URL("eino-workflow-dag.css", base).href;
  document.head.append(stylesheet);

  const stylesheetReady = new Promise((resolve, reject) => {
    stylesheet.addEventListener("load", resolve, { once: true });
    stylesheet.addEventListener("error", () => reject(new Error("Unable to load the renderer stylesheet.")), { once: true });
  });
  const scriptReady = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = new URL("eino-workflow-dag.umd.js", base).href;
    script.addEventListener("load", resolve, { once: true });
    script.addEventListener("error", () => reject(new Error("Unable to load the renderer bundle.")), { once: true });
    document.head.append(script);
  });
  return Promise.all([stylesheetReady, scriptReady]);
}

function graphCounts(graph) {
  let nodes = 0;
  let edges = 0;
  for (const node of graph.nodes) {
    nodes += 1;
    if (node.workflow) {
      const nested = graphCounts(node.workflow);
      nodes += nested.nodes;
      edges += nested.edges;
    }
  }
  edges += graph.edges.length;
  return { nodes, edges };
}

function subgraphPaths(graph, prefix = []) {
  const paths = [];
  for (const node of graph.nodes) {
    if (!node.workflow) continue;
    const path = [...prefix, node.id];
    paths.push(path, ...subgraphPaths(node.workflow, path));
  }
  return paths;
}

function setRenderState(kind, title, summary) {
  elements.statusLight.className = `status-light ${kind}`;
  elements.renderStatus.textContent = title;
  if (summary !== undefined) elements.renderSummary.textContent = summary;
}

function updateDiagnostics() {
  if (!instance) return;
  const diagnostics = instance.getDiagnostics();
  elements.layouts.textContent = String(diagnostics.layoutRuns);
  elements.patches.textContent = String(diagnostics.dataPatches);
  elements.cache.textContent = String(diagnostics.layoutCacheHits);
}

function scheduleDiagnostics() {
  requestAnimationFrame(() => requestAnimationFrame(updateDiagnostics));
}

function scheduleCanvasFit() {
  requestAnimationFrame(() => requestAnimationFrame(() => {
    if (!instance) return;
    instance.resize();
    instance.resetView();
    updateDiagnostics();
  }));
}

function showIssues(errors) {
  elements.issues.replaceChildren();
  if (!errors.length) {
    elements.issues.classList.remove("visible");
    elements.validation.className = "validation-result valid";
    elements.validation.textContent = "Valid schema-v1 snapshot · rendered locally";
    return;
  }

  for (const error of errors.slice(0, 6)) {
    const item = document.createElement("li");
    item.textContent = `${error.path} · ${error.code}: ${error.message}`;
    elements.issues.append(item);
  }
  if (errors.length > 6) {
    const item = document.createElement("li");
    item.textContent = `${errors.length - 6} more issues`;
    elements.issues.append(item);
  }
  elements.issues.classList.add("visible");
  elements.validation.className = "validation-result invalid";
  elements.validation.textContent = `${errors.length} protocol issue${errors.length === 1 ? "" : "s"} · canvas unchanged`;
}

function locateNodeInEditor(path) {
  const id = path.at(-1);
  const needle = `"id": ${JSON.stringify(id)}`;
  const start = elements.editor.value.indexOf(needle);
  elements.selectedPath.textContent = path.join(" / ");
  if (start < 0) return;
  elements.editor.focus({ preventScroll: true });
  elements.editor.setSelectionRange(start, start + needle.length);
  const linesBefore = elements.editor.value.slice(0, start).split("\n").length - 1;
  elements.editor.scrollTop = Math.max(0, linesBefore * 17 - elements.editor.clientHeight / 3);
}

function mount(snapshot) {
  instance = api.createWorkflowDAG(elements.host, {
    snapshot,
    direction: activeDirection,
    theme: activeTheme,
    expanded: subgraphPaths(snapshot.workflow),
    activeNodePath: null,
    onNodeClick(node) {
      instance.setActiveNodePath(node.path);
      locateNodeInEditor(node.path);
      scheduleDiagnostics();
    },
    onEdgeClick(edge) {
      elements.selectedPath.textContent = `${edge.source.join(" / ")} → ${edge.target.join(" / ")}`;
    },
    onExpandedChange() {
      scheduleDiagnostics();
    },
    onError(error) {
      setRenderState("invalid", "Renderer error", error.message);
    },
  });
}

function applyEditorSnapshot({ fit = true } = {}) {
  let candidate;
  try {
    candidate = JSON.parse(elements.editor.value);
  } catch (error) {
    const issue = { path: "JSON", code: "invalid_json", message: error.message };
    showIssues([issue]);
    setRenderState("invalid", "Invalid JSON", "Fix syntax to render");
    return false;
  }

  const validation = api.validateWorkflowSnapshot(candidate);
  if (!validation.valid) {
    showIssues(validation.errors);
    setRenderState("invalid", "Snapshot rejected", `${validation.errors.length} protocol issue${validation.errors.length === 1 ? "" : "s"}`);
    return false;
  }

  activeSnapshot = api.parseWorkflowSnapshot(candidate);
  if (!instance) mount(activeSnapshot);
  else instance.update(activeSnapshot, { preserveExpanded: true, fit });

  const counts = graphCounts(activeSnapshot.workflow);
  const executions = activeSnapshot.execution?.nodes?.length || 0;
  showIssues([]);
  setRenderState("valid", "Snapshot rendered", `${counts.nodes} nodes · ${counts.edges} edges · ${executions} outcomes`);
  scheduleCanvasFit();
  return true;
}

function loadSample(id) {
  const sample = samples[id];
  elements.sampleNote.textContent = sample.note;
  elements.editor.value = JSON.stringify(clone(sample.snapshot), null, 2);
  elements.selectedPath.textContent = "Click a node to locate it in the protocol";
  applyEditorSnapshot();
}

function selectPressed(container, selector, attribute, value) {
  container.querySelectorAll(selector).forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset[attribute] === value));
  });
}

function initializeThemes() {
  for (const theme of api.listWorkflowDAGThemes()) {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.theme = theme;
    button.setAttribute("aria-pressed", String(theme === activeTheme));
    button.textContent = theme[0].toUpperCase() + theme.slice(1);
    button.addEventListener("click", () => {
      activeTheme = theme;
      selectPressed(elements.themes, "[data-theme]", "theme", theme);
      instance?.setTheme(theme);
      scheduleDiagnostics();
    });
    elements.themes.append(button);
  }
}

elements.sample.addEventListener("change", () => loadSample(elements.sample.value));

document.querySelector("#direction-controls").addEventListener("click", (event) => {
  const button = event.target.closest("[data-direction]");
  if (!button) return;
  activeDirection = button.dataset.direction;
  selectPressed(document.querySelector("#direction-controls"), "[data-direction]", "direction", activeDirection);
  instance?.setDirection(activeDirection);
  scheduleDiagnostics();
});

elements.apply.addEventListener("click", () => applyEditorSnapshot());
elements.format.addEventListener("click", () => {
  try {
    elements.editor.value = JSON.stringify(JSON.parse(elements.editor.value), null, 2);
    elements.validation.textContent = "JSON formatted · apply to validate";
    elements.validation.className = "validation-result";
  } catch (error) {
    showIssues([{ path: "JSON", code: "invalid_json", message: error.message }]);
  }
});

elements.copy.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(elements.editor.value);
    elements.copy.textContent = "Copied";
    setTimeout(() => { elements.copy.textContent = "Copy JSON"; }, 1200);
  } catch {
    elements.editor.select();
    elements.validation.textContent = "Select and copy the highlighted JSON";
  }
});

elements.editor.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
    event.preventDefault();
    applyEditorSnapshot();
  }
});

document.querySelector("#expand-all").addEventListener("click", () => {
  instance?.expandAll();
  scheduleDiagnostics();
});
document.querySelector("#collapse-all").addEventListener("click", () => {
  instance?.collapseAll();
  scheduleDiagnostics();
});
document.querySelector("#fit").addEventListener("click", () => instance?.resetView());

window.playground = {
  get api() { return api; },
  get instance() { return instance; },
  get snapshot() { return activeSnapshot; },
  get ready() { return !!instance; },
  apply: applyEditorSnapshot,
};

try {
  await loadRenderer();
  api = window.EinoWorkflowDAG;
  if (!api) throw new Error("The renderer bundle did not expose its browser API.");
  initializeThemes();
  loadSample(elements.sample.value);
} catch (error) {
  showIssues([{ path: "renderer", code: "load_failed", message: error.message }]);
  setRenderState("invalid", "Renderer unavailable", "Check the built distribution files");
}
