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

/**
 * Vue adapter props.
 *
 * `snapshot`, `direction`, `theme`, `locale`, `expanded`, and
 * `activeNodePath` update the mounted renderer. `preserveExpanded` and
 * `fitOnUpdate` are read on the next `snapshot` update. Renderer construction
 * options (`interaction`, its deprecated aliases, `autoResize`, `debug`,
 * accessibility options, formatters, and `layoutCacheSize`) are mount-only;
 * change the component `key` to apply new values.
 *
 * Structured reactive props should be replaced rather than mutated in place.
 * Event listeners always use the latest handler; `ready` runs once per mount.
 */
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
