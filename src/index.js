import "./styles.css";

import EinoWorkflowDAG from "./renderer.js";

/** Mount an interactive Eino workflow DAG in a DOM element. */
export function mountWorkflowDAG(container, options) {
  return EinoWorkflowDAG.mount(container, options);
}

export {
  EinoWorkflowDAG,
  registerWorkflowDAGTheme,
  default,
} from "./renderer.js";
export {
  CURRENT_DAG_VERSION,
  SUPPORTED_DAG_VERSIONS,
  assertValidDAG,
  validateDAG,
} from "./validation.js";
