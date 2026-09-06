import { StrictMode, createElement, createRef } from "react";
import { createRoot } from "react-dom/client";
import { EinoWorkflowDAGReact } from "../../dist/react.js";

let dagRoot = {
  version: 2,
  nodes: [
    { id: "input", name: "Input", kind: "io", status: "success", cost_ms: 5 },
    { id: "answer", name: "Answer", kind: "llm", status: "running", cost_ms: 30 },
  ],
  edges: [{ from: "input", to: "answer" }],
};
let direction = "RIGHT";
let locale;
let activeNodeId = "answer";
const dagRef = createRef();
const events = [];
const root = createRoot(document.querySelector("#app"));

function render() {
  root.render(
    createElement(
      StrictMode,
      null,
      createElement(
        "main",
        null,
        createElement("h1", null, "Eino Workflow DAG — React"),
        createElement(EinoWorkflowDAGReact, {
          ref: dagRef,
          root: dagRoot,
          direction,
          locale,
          activeNodeId,
          style: { height: "420px" },
          pinNodeTip: false,
          onReady(instance) {
            window.reactDagInstance = instance;
          },
          onNodeClick(node) {
            events.push({ type: "node", id: node.id });
          },
          onError(error) {
            events.push({ type: "error", message: error.message });
          },
        }),
      ),
    ),
  );
}

window.reactDagEvents = events;
window.reactDagRef = dagRef;
window.setReactDagRoot = (next) => {
  dagRoot = next;
  render();
};
window.setReactDagDirection = (next) => {
  direction = next;
  render();
};
window.setReactDagLocale = (next) => {
  locale = next;
  render();
};
window.setReactDagActiveNodeId = (next) => {
  activeNodeId = next;
  render();
};
window.unmountReactDag = () => root.unmount();

render();
