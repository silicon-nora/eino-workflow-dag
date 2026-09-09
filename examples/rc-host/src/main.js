import {
  createCytoscapeWorkflowDAG,
  getCytoscape,
} from "eino-workflow-dag/cytoscape";
import { parseWorkflowSnapshot } from "eino-workflow-dag/validation";
import "eino-workflow-dag/styles.css";
import fixture from "./eino-snapshot.json";
import "./style.css";

const candidateVersion = "1.0.0-rc.4";
const host = document.querySelector("#dag");
const frame = document.querySelector("#canvas-frame");
const eventLog = document.querySelector("#event-log");
const scenarioName = document.querySelector("#scenario-name");
const directionName = document.querySelector("#direction-name");
const appearanceName = document.querySelector("#appearance-name");
const observationState = document.querySelector("#observation-state");

const scenarios = {
  success: {
    label: "成功主路",
    nodes: [
      { path: ["prepare"], status: "success", durationMs: 42 },
      { path: ["route"], status: "success", durationMs: 18 },
      { path: ["answer"], status: "success", durationMs: 610 },
      { path: ["answer", "invoke"], status: "success", durationMs: 520 },
      { path: ["fallback"], status: "skipped", durationMs: null },
    ],
  },
  fallback: {
    label: "回退主路",
    nodes: [
      { path: ["prepare"], status: "success", durationMs: 38 },
      { path: ["route"], status: "success", durationMs: 24 },
      { path: ["answer"], status: "skipped", durationMs: null },
      { path: ["answer", "invoke"], status: "skipped", durationMs: null },
      { path: ["fallback"], status: "success", durationMs: 780 },
    ],
  },
  failed: {
    label: "失败结果",
    nodes: [
      { path: ["prepare"], status: "success", durationMs: 36 },
      { path: ["route"], status: "success", durationMs: 20 },
      {
        path: ["answer"],
        status: "failed",
        durationMs: 430,
        errorMessage: "candidate observation failure",
      },
      {
        path: ["answer", "invoke"],
        status: "failed",
        durationMs: 390,
        errorMessage: "candidate observation failure",
      },
      { path: ["fallback"], status: "skipped", durationMs: null },
    ],
  },
  unknown: { label: "未知状态", nodes: null },
};

const appearances = {
  classic: { label: "Classic", theme: "classic" },
  ink: { label: "Ink", theme: "ink" },
  compact: {
    label: "Compact",
    theme: {
      base: "classic",
      tokens: {
        node: {
          width: 176,
          height: 52,
          textMaxWidth: 156,
          fontSize: 13,
          radius: 6,
        },
        spacing: {
          nodeNode: 36,
          betweenLayers: 34,
          nestedNodeNode: 42,
          nestedBetweenLayers: 42,
          fitPadding: 20,
        },
        tooltip: { maxWidth: 240, fontSize: 11 },
      },
    },
  },
  observatory: {
    label: "Observatory",
    theme: {
      base: "midnight",
      tokens: {
        colors: {
          highlighted: "#6fc7b7",
          hover: "#7dd3c7",
          press: "#b6ede3",
          probe: "#e3b45f",
          probeGlow: "#f0cf8b",
        },
        node: { width: 242, height: 68, textMaxWidth: 216, radius: 3 },
        spacing: {
          nodeNode: 66,
          betweenLayers: 58,
          nestedNodeNode: 72,
          nestedBetweenLayers: 64,
          fitPadding: 34,
        },
        tooltip: { radius: 3, maxWidth: 340 },
      },
    },
  },
};

let instance;
let scenario = "success";
let direction = "RIGHT";
let appearance = "classic";
let expanded = true;
let remounts = 0;
let events = [];
const interactionPolicy = {
  expandOnNodeClick: true,
  tooltipOnHover: true,
  pinTooltipOnNodeClick: false,
  highlightEdgeOnClick: true,
  clearHighlightOnCanvasClick: true,
  keyboardNavigation: true,
  panOnDrag: true,
  zoomOnCtrlWheel: true,
};

function buildSnapshot(name = scenario) {
  const next = structuredClone(fixture);
  next.metadata = {
    source: "Go Eino fixture",
    candidate: candidateVersion,
  };
  if (scenarios[name].nodes) {
    next.execution = {
      id: `rc-host-${name}`,
      nodes: structuredClone(scenarios[name].nodes),
      metadata: { observation: name },
    };
  } else {
    delete next.execution;
  }
  return parseWorkflowSnapshot(next);
}

function appendEvent(type, detail) {
  events.unshift({ type, detail, at: new Date().toLocaleTimeString("zh-CN", { hour12: false }) });
  events = events.slice(0, 8);
  eventLog.replaceChildren(
    ...events.map((event) => {
      const item = document.createElement("li");
      const kind = document.createElement("strong");
      const copy = document.createElement("span");
      const time = document.createElement("time");
      kind.textContent = event.type;
      copy.textContent = event.detail;
      time.textContent = event.at;
      item.append(kind, copy, time);
      return item;
    }),
  );
}

function mount() {
  instance = createCytoscapeWorkflowDAG(host, {
    snapshot: buildSnapshot(),
    direction,
    theme: appearances[appearance].theme,
    expanded: expanded ? [["answer"]] : [],
    interaction: { ...interactionPolicy },
    ariaLabel: "Eino workflow RC candidate observation graph",
    onExpandedChange(paths) {
      expanded = paths.some((path) => path.join("/") === "answer");
      syncExpansionButton();
      scheduleInspection();
    },
    onNodeClick(node) {
      appendEvent("node", `${node.path.join("/")} · Level ${node.level}`);
      instance.setActiveNodePath(node.path);
    },
    onEdgeClick(edge) {
      appendEvent("edge", `${edge.source.join("/")} → ${edge.target.join("/")}`);
    },
    onError(error) {
      appendEvent("error", `${error.code || "unknown"}: ${error.message}`);
      setVerdict(false, "渲染器报告了错误");
    },
  });
  scheduleInspection();
}

function remount(reason) {
  instance.destroy();
  host.replaceChildren();
  remounts += 1;
  mount();
  appendEvent("lifecycle", `${reason} · remount ${remounts}`);
}

function syncPressed(container, attribute, value) {
  container.querySelectorAll(`button[${attribute}]`).forEach((button) => {
    button.setAttribute("aria-pressed", String(button.getAttribute(attribute) === value));
  });
}

function syncExpansionButton() {
  document.querySelector("#toggle-expanded").textContent = expanded ? "收起子图" : "展开子图";
}

function setVerdict(passed, copy) {
  const verdict = document.querySelector("#verdict");
  verdict.dataset.state = passed ? "passed" : "failed";
  document.querySelector("#verdict-title").textContent = passed ? "几何正常" : "需要检查";
  document.querySelector("#verdict-copy").textContent = copy;
  document.querySelector("#health-dot").dataset.state = passed ? "passed" : "failed";
}

function inspectRoutes(cy) {
  const failures = [];
  cy.edges().filter((edge) => edge.visible()).forEach((edge) => {
    const route = edge.scratch("einoWorkflowDAG")?._flowAbsRoute || [];
    if (route.length < 2) {
      failures.push(`${edge.id()}: missing route`);
      return;
    }
    for (let index = 1; index < route.length; index += 1) {
      const previous = route[index - 1];
      const point = route[index];
      if (Math.abs(point.x - previous.x) > 1 && Math.abs(point.y - previous.y) > 1) {
        failures.push(`${edge.id()}: diagonal segment`);
      }
    }
  });
  return failures;
}

function inspect() {
  if (!instance) return;
  const cy = getCytoscape(instance);
  if (!cy) return;
  const diagnostics = instance.getDiagnostics();
  document.querySelector("#metric-layout").textContent = diagnostics.layoutRuns;
  document.querySelector("#metric-cache").textContent = diagnostics.layoutCacheHits;
  document.querySelector("#metric-patches").textContent = diagnostics.dataPatches;
  document.querySelector("#metric-remounts").textContent = remounts;

  const nodes = cy.nodes().filter((node) => node.visible()).map((node) => ({
    path: Array.isArray(node.data("path")) ? node.data("path").join("/") : node.id(),
    level: node.data("level"),
    x: Math.round(node.position("x")),
    y: Math.round(node.position("y")),
  })).sort((left, right) => left.level - right.level || left.path.localeCompare(right.path));
  document.querySelector("#node-count").textContent = `${nodes.length} nodes`;
  document.querySelector("#coordinate-body").replaceChildren(
    ...nodes.map((node) => {
      const row = document.createElement("tr");
      for (const value of [node.path, node.level, node.x, node.y]) {
        const cell = document.createElement("td");
        cell.textContent = value;
        row.append(cell);
      }
      return row;
    }),
  );

  const routeFailures = inspectRoutes(cy);
  const invalidLevels = nodes.filter((node) => !Number.isInteger(node.level) || node.level < 0);
  const passed = routeFailures.length === 0 && invalidLevels.length === 0;
  setVerdict(
    passed,
    passed
      ? `${nodes.length} 个节点 · 所有可见边保持正交`
      : `${routeFailures.length + invalidLevels.length} 项异常`,
  );
  observationState.textContent = passed ? "布局已稳定" : "发现几何异常";
}

function scheduleInspection() {
  observationState.textContent = "重新计算中";
  requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(inspect)));
}

document.querySelector("#scenario-controls").addEventListener("click", (event) => {
  const button = event.target.closest("button[data-scenario]");
  if (!button) return;
  scenario = button.dataset.scenario;
  syncPressed(document.querySelector("#scenario-controls"), "data-scenario", scenario);
  scenarioName.textContent = scenarios[scenario].label;
  instance.update(buildSnapshot(), { preserveExpanded: true, fit: true });
  appendEvent("update", scenarios[scenario].label);
  scheduleInspection();
});

document.querySelector("#direction-controls").addEventListener("click", (event) => {
  const button = event.target.closest("button[data-direction]");
  if (!button) return;
  direction = button.dataset.direction;
  syncPressed(document.querySelector("#direction-controls"), "data-direction", direction);
  directionName.textContent = direction;
  instance.setDirection(direction);
  instance.resetView();
  appendEvent("direction", direction);
  scheduleInspection();
});

document.querySelector("#appearance-controls").addEventListener("click", (event) => {
  const button = event.target.closest("button[data-appearance]");
  if (!button || !appearances[button.dataset.appearance]) return;
  appearance = button.dataset.appearance;
  syncPressed(
    document.querySelector("#appearance-controls"),
    "data-appearance",
    appearance,
  );
  appearanceName.textContent = appearances[appearance].label;
  instance.setTheme(appearances[appearance].theme);
  appendEvent("theme", appearances[appearance].label);
  scheduleInspection();
});

document.querySelector("#interaction-controls").addEventListener("change", (event) => {
  const input = event.target.closest("input[data-interaction]");
  if (!input || !(input.dataset.interaction in interactionPolicy)) return;
  interactionPolicy[input.dataset.interaction] = input.checked;
  remount(`${input.dataset.interaction} ${input.checked ? "on" : "off"}`);
});

document.querySelector("#toggle-expanded").addEventListener("click", () => {
  expanded = !expanded;
  instance.setExpanded(expanded ? [["answer"]] : []);
  syncExpansionButton();
  appendEvent("subgraph", expanded ? "expanded" : "collapsed");
  scheduleInspection();
});

document.querySelector("#toggle-width").addEventListener("click", () => {
  frame.classList.toggle("is-compact");
  document.querySelector("#toggle-width").textContent = frame.classList.contains("is-compact")
    ? "恢复宽容器"
    : "切换窄容器";
  window.setTimeout(() => {
    instance.resize();
    instance.resetView();
    appendEvent("resize", frame.classList.contains("is-compact") ? "compact" : "wide");
    scheduleInspection();
  }, 260);
});

document.querySelector("#remount").addEventListener("click", () => {
  remount("manual");
});

document.querySelector("#fit").addEventListener("click", () => {
  instance.resetView();
  appendEvent("viewport", "fit");
  scheduleInspection();
});

document.querySelector("#clear-events").addEventListener("click", () => {
  events = [];
  eventLog.innerHTML = '<li class="empty">点击节点或边以检查回调</li>';
});

window.rcHost = {
  version: candidateVersion,
  get instance() { return instance; },
  get cy() { return instance ? getCytoscape(instance) : null; },
  get state() {
    return {
      scenario,
      direction,
      appearance,
      expanded,
      remounts,
      interaction: { ...interactionPolicy },
    };
  },
  inspect,
};

mount();
