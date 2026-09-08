import {
  createWorkflowDAG,
  parseWorkflowSnapshot,
  validateWorkflowSnapshot,
  type DAGLocale,
  type EinoWorkflowSnapshot,
  type NodePath,
  type ResolvedDAGLocale,
} from "../src/index.js";
import {
  createCytoscapeWorkflowDAG,
  getCytoscape,
} from "../src/cytoscape.js";
import {
  EinoWorkflowDAGVue,
  type EinoWorkflowDAGVueProps,
  type EinoWorkflowDAGVueRef,
} from "../src/vue.js";
import {
  EinoWorkflowDAGReact,
  type EinoWorkflowDAGReactProps,
  type EinoWorkflowDAGReactRef,
} from "../src/react.js";
import { h } from "vue";

const snapshot: EinoWorkflowSnapshot = {
  schemaVersion: 1,
  workflow: {
    nodes: [{ id: "model", name: "Generate", component: "ChatModel" }],
    edges: [],
  },
  execution: {
    nodes: [{ path: ["model"], status: "success", durationMs: 100 }],
  },
};
const invalidStatusSnapshot: EinoWorkflowSnapshot = {
  schemaVersion: 1,
  workflow: { nodes: [{ id: "model" }], edges: [] },
  execution: {
    nodes: [{
      path: ["model"],
      // @ts-expect-error execution status is a closed final-outcome enum
      status: "running",
      durationMs: null,
    }],
  },
};
const missingDurationSnapshot: EinoWorkflowSnapshot = {
  schemaVersion: 1,
  workflow: { nodes: [{ id: "model" }], edges: [] },
  execution: {
    // @ts-expect-error every final node outcome declares measured or null duration
    nodes: [{ path: ["model"], status: "success" }],
  },
};
void invalidStatusSnapshot;
void missingDurationSnapshot;
const activePath: NodePath = ["model"];
const container = document.createElement("div");
const instance = createWorkflowDAG(container, {
  snapshot,
  direction: "RIGHT",
  theme: {
    base: "ink",
    tokens: {
      node: { width: 240, height: 68, textMaxWidth: 216 },
      spacing: { nodeNode: 64, betweenLayers: 56 },
      tooltip: { bg: "#111827", color: "#f9fafb" },
    },
  },
  interaction: {
    expandOnNodeClick: false,
    pinTooltipOnNodeClick: false,
    zoomOnCtrlWheel: true,
  },
  activeNodePath: activePath,
  expanded: [["research"]],
  tooltipFormatter: (node) => `${node.name}: ${node.status}`,
  nodeLabelFormatter: (node) => `${node.name}: ${node.status}:L${node.level}`,
  onNodeClick: (node) => `${node.path.join("/")}:${node.id}:${node.durationMs ?? "untimed"}:L${node.level}`,
  onEdgeClick: (edge) => `${edge.source.join("/")}:${edge.mappings.length}:${edge.metadata?.owner ?? ""}:${edge.branchMetadata?.route ?? ""}:L${edge.level}`,
  onError: (error) => `${error.code}:${"recoverable" in error ? error.recoverable : false}`,
});

instance.setTheme("midnight");
instance.setTheme({
  base: "classic",
  tokens: { colors: { highlighted: "#2563eb" } },
});
instance.setLocale({ statuses: { success: "完成" } });
const resolvedLocale: ResolvedDAGLocale = instance.getLocale();
resolvedLocale.tooltip.metrics;
instance.setDirection("DOWN");
instance.setActiveNodePath(["model"]);
instance.getActiveNodePath();
instance.update(snapshot);
instance.update(snapshot, { preserveExpanded: false, fit: true });
instance.toggle(["research"]);
instance.setExpanded([["research"]]);
instance.exportImage({ format: "svg", padding: 32, maxWidth: 1200 });

const validation = validateWorkflowSnapshot(snapshot);
if (validation.valid) parseWorkflowSnapshot(snapshot);

const advanced = createCytoscapeWorkflowDAG(container, {
  snapshot,
  additionalStyles: [{ selector: 'node[kind = "llm"]', style: { "border-width": 4 } }],
});
getCytoscape(advanced)?.nodes();

const vueProps: EinoWorkflowDAGVueProps = {
  snapshot,
  direction: "DOWN",
  activeNodePath: ["model"],
  preserveExpanded: true,
  onReady: (dag) => dag.getDirection(),
  onExpandedChange: (value) => value.map((path) => path.join("/")),
  onNodeClick: (node) => node.path.join("/"),
  onEdgeClick: (edge) => edge.source.join("/"),
  onError: (error) => error.code,
};
declare const vueRef: EinoWorkflowDAGVueRef;
vueRef.update(snapshot);
vueRef.toggle(["research"]);
vueRef.getExpanded();
vueRef.setExpanded([["research"]]);
vueRef.getActiveNodePath();
vueRef.setActiveNodePath(["research", "model"]);
vueRef.getDiagnostics();
declare const vueInstance: InstanceType<typeof EinoWorkflowDAGVue>;
vueInstance.update(snapshot);
h(EinoWorkflowDAGVue, vueProps);

const reactProps: EinoWorkflowDAGReactProps = {
  snapshot,
  direction: "UP",
  activeNodePath: ["model"],
  preserveExpanded: true,
  onNodeClick: (node) => node.path.join("/"),
};
declare const reactRef: EinoWorkflowDAGReactRef;
reactRef.update(snapshot);
reactRef.toggle(["research"]);
reactRef.setActiveNodePath(null);
void EinoWorkflowDAGReact;
void reactProps;

const locale: DAGLocale = { kinds: { llm: "模型" } };
void locale;
