import type { ComponentOptionsMixin, DefineComponent } from "vue";
import type {
  CreateWorkflowDAGOptions,
  EinoWorkflowSnapshot,
  WorkflowDAGError,
  WorkflowDAGInstance,
  WorkflowSnapshotError,
} from "./index.js";

export type EinoWorkflowDAGVueEmits = {
  ready: (instance: WorkflowDAGInstance) => void;
  "expanded-change": NonNullable<CreateWorkflowDAGOptions["onExpandedChange"]>;
  "node-click": NonNullable<CreateWorkflowDAGOptions["onNodeClick"]>;
  "edge-click": NonNullable<CreateWorkflowDAGOptions["onEdgeClick"]>;
  error: (error: WorkflowDAGError | WorkflowSnapshotError) => void;
};

export interface EinoWorkflowDAGVueProps
  extends Omit<CreateWorkflowDAGOptions, "snapshot"> {
  snapshot: EinoWorkflowSnapshot;
  preserveExpanded?: boolean;
  fitOnUpdate?: boolean;
  onReady?: EinoWorkflowDAGVueEmits["ready"];
}

export interface EinoWorkflowDAGVueRef {
  getInstance(): WorkflowDAGInstance | null;
  update: WorkflowDAGInstance["update"];
  expandAll: WorkflowDAGInstance["expandAll"];
  collapseAll: WorkflowDAGInstance["collapseAll"];
  toggle: WorkflowDAGInstance["toggle"];
  getExpanded: WorkflowDAGInstance["getExpanded"];
  setExpanded: WorkflowDAGInstance["setExpanded"];
  getActiveNodePath: WorkflowDAGInstance["getActiveNodePath"];
  setActiveNodePath: WorkflowDAGInstance["setActiveNodePath"];
  getDirection: WorkflowDAGInstance["getDirection"];
  setDirection: WorkflowDAGInstance["setDirection"];
  getTheme: WorkflowDAGInstance["getTheme"];
  setTheme: WorkflowDAGInstance["setTheme"];
  getLocale: WorkflowDAGInstance["getLocale"];
  setLocale: WorkflowDAGInstance["setLocale"];
  zoomIn: WorkflowDAGInstance["zoomIn"];
  zoomOut: WorkflowDAGInstance["zoomOut"];
  resetView: WorkflowDAGInstance["resetView"];
  listSubgraphs: WorkflowDAGInstance["listSubgraphs"];
  resize: WorkflowDAGInstance["resize"];
  exportImage: WorkflowDAGInstance["exportImage"];
  getDiagnostics: WorkflowDAGInstance["getDiagnostics"];
}

export const EinoWorkflowDAGVue: DefineComponent<
  EinoWorkflowDAGVueProps,
  EinoWorkflowDAGVueRef,
  {},
  {},
  {},
  ComponentOptionsMixin,
  ComponentOptionsMixin,
  EinoWorkflowDAGVueEmits,
  keyof EinoWorkflowDAGVueEmits
>;
export default EinoWorkflowDAGVue;
