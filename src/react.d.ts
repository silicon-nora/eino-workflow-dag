import type { ForwardRefExoticComponent, HTMLAttributes, RefAttributes } from "react";
import type {
  CreateWorkflowDAGOptions,
  EinoWorkflowSnapshot,
  NodePath,
  WorkflowDAGInstance,
} from "./index.js";

/**
 * React adapter props.
 *
 * `snapshot`, `direction`, `theme`, `locale`, `expanded`, and
 * `activeNodePath` update the mounted renderer. `preserveExpanded` and
 * `fitOnUpdate` are read on the next `snapshot` update. Renderer construction
 * options (`interaction`, its deprecated aliases, `autoResize`, `debug`,
 * accessibility options, formatters, and `layoutCacheSize`) are mount-only;
 * change the component `key` to apply new values.
 *
 * Structured reactive props should be replaced rather than mutated in place.
 * Callback props always use the latest handler; `onReady` runs once per mount.
 */
export interface EinoWorkflowDAGReactProps
  extends Omit<HTMLAttributes<HTMLDivElement>, "children" | "onError">,
    Omit<CreateWorkflowDAGOptions, "snapshot" | "onError"> {
  snapshot: EinoWorkflowSnapshot;
  preserveExpanded?: boolean;
  fitOnUpdate?: boolean;
  onReady?: (instance: WorkflowDAGInstance) => void;
  onError?: CreateWorkflowDAGOptions["onError"];
}

export interface EinoWorkflowDAGReactRef {
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

export type { NodePath };
export const EinoWorkflowDAGReact: ForwardRefExoticComponent<
  EinoWorkflowDAGReactProps & RefAttributes<EinoWorkflowDAGReactRef>
>;
export default EinoWorkflowDAGReact;
