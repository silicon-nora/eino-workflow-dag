import type cytoscape from "cytoscape";
import type { CreateWorkflowDAGOptions, WorkflowDAGInstance } from "./index.js";

export interface CytoscapeWorkflowDAGOptions extends CreateWorkflowDAGOptions {
  additionalStyles?: readonly cytoscape.StylesheetJsonBlock[];
}

export function createCytoscapeWorkflowDAG(
  container: HTMLElement,
  options: CytoscapeWorkflowDAGOptions,
): WorkflowDAGInstance;
export function getCytoscape(instance: WorkflowDAGInstance): cytoscape.Core | null;
