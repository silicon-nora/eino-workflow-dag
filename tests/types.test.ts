import {
  assertValidDAG,
  mountWorkflowDAG,
  validateDAG,
  type DAGData,
  type DAGLocale,
  type ResolvedDAGLocale,
} from "../src/index.js";
import { layoutVisibleGraph as layoutFromSubpath } from "../src/layout.js";
import {
  attachLayoutWorker,
  createLayoutWorkerClient,
  type LayoutWorkerClient,
} from "../src/layout-worker.js";
import { buildVisibleGraph as modelFromSubpath } from "../src/model.js";
import { validateDAG as validateFromSubpath } from "../src/validation.js";
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

const root: DAGData = {
  version: 2,
  scene: "example",
  nodes: [
    {
      id: "model",
      name: "Generate",
      kind: "llm",
      status: "success",
      cost_ms: 100,
    },
  ],
  edges: [],
};
const container = document.createElement("div");
const instance = mountWorkflowDAG(container, {
  root,
  direction: "RIGHT",
  activeNodeId: "model",
  autoResize: true,
  pinNodeTip: false,
  tooltipFormatter: (node) => `${node.title}: ${node.status}`,
  nodeLabelFormatter: (node) => `${node.name}: ${node.status}`,
  onNodeClick: (node) => `${node.id}:${node.key}`,
  onEdgeClick: (edge) => edge.source,
  onError: (error) => error.message,
  locale: {
    statuses: { running: "运行中" },
    tooltip: { status: "状态" },
  },
});

instance.setTheme("midnight");
instance.setLocale({ statuses: { success: "完成" } });
const resolvedLocale: ResolvedDAGLocale = instance.getLocale();
resolvedLocale.tooltip.metrics;
instance.setDirection("DOWN");
instance.setActiveNodeId("model");
instance.getActiveNodeId();
instance.setData(root);
instance.setData(root, { preserveExpanded: false, fit: true });
instance.exportImage({ format: "svg", padding: 32, maxWidth: 1200 });

const validation = validateDAG(root);
if (validation.valid) assertValidDAG(root);
layoutFromSubpath(modelFromSubpath(root, {}));
validateFromSubpath(root);

const workerClient: LayoutWorkerClient = createLayoutWorkerClient(
  new Worker(new URL("./layout-worker.js", import.meta.url), { type: "module" }),
  { terminateOnDestroy: true },
);
workerClient.run(modelFromSubpath(root), {
  direction: "LEFT",
  signal: new AbortController().signal,
});
workerClient.destroy();
void attachLayoutWorker;

const vueProps: EinoWorkflowDAGVueProps = {
  root,
  direction: "DOWN",
  activeNodeId: "model",
  layoutCacheSize: 8,
  preserveExpanded: true,
  onReady: (dag) => dag.getDirection(),
  onExpandedChange: (value) => Object.keys(value),
  onNodeClick: (node) => `${node.id}:${node.key}`,
  onEdgeClick: (edge) => edge.source,
  onError: (error) => error.message,
};
declare const vueRef: EinoWorkflowDAGVueRef;
vueRef.render({ fit: false });
vueRef.togglePath("research");
vueRef.getExpanded();
vueRef.setExpanded({ research: true });
vueRef.getActiveNodeId();
vueRef.setActiveNodeId("research/model");
vueRef.getDirection();
vueRef.setTheme("midnight");
vueRef.getTheme();
vueRef.setDirection("LEFT");
vueRef.getLocale();
vueRef.setLocale({ statuses: { success: "完成" } });
vueRef.zoomIn();
vueRef.zoomOut();
vueRef.listSubgraphs();
vueRef.resize();
vueRef.getDiagnostics();
declare const vueInstance: InstanceType<typeof EinoWorkflowDAGVue>;
vueInstance.setData(root);
vueInstance.setTheme("classic");
h(EinoWorkflowDAGVue, vueProps);
void EinoWorkflowDAGVue;
void vueProps;

const reactProps: EinoWorkflowDAGReactProps = {
  root,
  direction: "UP",
  activeNodeId: "model",
  preserveExpanded: true,
  onNodeClick: (node) => `${node.id}:${node.key}`,
};
declare const reactRef: EinoWorkflowDAGReactRef;
reactRef.render({ fit: false });
reactRef.togglePath("research");
reactRef.getExpanded();
reactRef.setExpanded({ research: true });
reactRef.getActiveNodeId();
reactRef.setActiveNodeId(null);
reactRef.getDirection();
reactRef.getTheme();
reactRef.getLocale();
reactRef.setLocale({ statuses: { running: "运行中" } });
reactRef.zoomIn();
reactRef.zoomOut();
reactRef.listSubgraphs();
reactRef.resize();
reactRef.getDiagnostics();
void EinoWorkflowDAGReact;
void reactProps;

const locale: DAGLocale = { kinds: { llm: "模型" } };
void locale;
