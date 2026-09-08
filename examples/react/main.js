import { StrictMode, createElement, createRef } from "react";
import { createRoot } from "react-dom/client";
import { EinoWorkflowDAGReact } from "../../dist/react.js";

let dagSnapshot = {
  schemaVersion: 1,
  workflow: {
    nodes: [
      { id: "input", name: "Input", component: "Lambda" },
      { id: "answer", name: "Answer", component: "ChatModel" },
    ],
    edges: [{ from: "input", to: "answer", channels: ["control", "data"] }],
  },
  execution: {
    nodes: [
      { path: ["input"], status: "success", durationMs: 5 },
      { path: ["answer"], status: "success", durationMs: 30 },
    ],
  },
};
let direction = "RIGHT";
let locale;
let activeNodePath = ["answer"];
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
          snapshot: dagSnapshot,
          direction,
          locale,
          activeNodePath,
          style: { height: "420px" },
          interaction: { pinTooltipOnNodeClick: false },
          onReady(instance) {
            window.reactDagInstance = instance;
          },
          onNodeClick(node) {
            events.push({ type: "node", path: node.path });
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
  dagSnapshot = next;
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
  activeNodePath = next;
  render();
};
window.unmountReactDag = () => root.unmount();

render();
