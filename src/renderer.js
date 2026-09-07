/** Public renderer construction and theme API. */
import { mountRenderer } from "./runtime.js";
import { listThemes, registerTheme } from "./theme.js";

export function createWorkflowDAG(container, options) {
  return mountRenderer(container, options);
}

export const registerWorkflowDAGTheme = registerTheme;
export const listWorkflowDAGThemes = listThemes;
