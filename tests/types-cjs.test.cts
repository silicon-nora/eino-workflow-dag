import {
  CURRENT_DAG_VERSION,
  mountWorkflowDAG,
  type DAGData,
} from "eino-workflow-dag";
import { layoutVisibleGraph } from "eino-workflow-dag/layout";
import {
  attachLayoutWorker,
  createLayoutWorkerClient,
} from "eino-workflow-dag/layout-worker";
import { buildVisibleGraph } from "eino-workflow-dag/model";
import { EinoWorkflowDAGReact } from "eino-workflow-dag/react";
import { validateDAG } from "eino-workflow-dag/validation";
import { EinoWorkflowDAGVue } from "eino-workflow-dag/vue";

const root: DAGData = { version: 2, nodes: [], edges: [] };
const visible = buildVisibleGraph(root);
layoutVisibleGraph(visible);
validateDAG(root);
mountWorkflowDAG(document.createElement("div"), { root });

declare const worker: Worker;
createLayoutWorkerClient(worker).destroy();
void attachLayoutWorker;
void EinoWorkflowDAGReact;
void EinoWorkflowDAGVue;
void CURRENT_DAG_VERSION;
