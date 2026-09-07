import {
  CURRENT_SCHEMA_VERSION,
  createWorkflowDAG,
  type EinoWorkflowSnapshot,
} from "eino-workflow-dag";
import {
  createCytoscapeWorkflowDAG,
  getCytoscape,
} from "eino-workflow-dag/cytoscape";
import { EinoWorkflowDAGReact } from "eino-workflow-dag/react";
import { validateWorkflowSnapshot } from "eino-workflow-dag/validation";
import { EinoWorkflowDAGVue } from "eino-workflow-dag/vue";

const snapshot: EinoWorkflowSnapshot = {
  schemaVersion: 1,
  workflow: { nodes: [], edges: [] },
};
validateWorkflowSnapshot(snapshot);
createWorkflowDAG(document.createElement("div"), { snapshot });
const advanced = createCytoscapeWorkflowDAG(document.createElement("div"), { snapshot });
getCytoscape(advanced);
void EinoWorkflowDAGReact;
void EinoWorkflowDAGVue;
void CURRENT_SCHEMA_VERSION;
