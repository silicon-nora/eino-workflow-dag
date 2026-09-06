/**
 * Eino Workflow DAG — public renderer API.
 */
import { normalizeDirection } from "./axis-profile.js";
import {
  listThemes,
  normalizeTheme,
  registerTheme,
} from "./theme.js";
import { mountRenderer } from "./runtime.js";




export const EinoWorkflowDAG = {
    mount: mountRenderer,
    normalizeDirection: normalizeDirection,
    normalizeTheme: normalizeTheme,
    listThemes: listThemes,
    registerTheme: registerTheme,
};
export const registerWorkflowDAGTheme = EinoWorkflowDAG.registerTheme;
export default EinoWorkflowDAG;
