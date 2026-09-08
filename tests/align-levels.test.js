import { EinoWorkflowDAGModel as Model } from "../src/model.js";
import { EinoWorkflowDAGLayout as Layout } from "../src/layout.js";

if (!Layout || typeof Layout.layoutVisibleGraph !== "function") {
  console.error("FAIL: EinoWorkflowDAGLayout.layoutVisibleGraph not exported");
  process.exit(1);
}

function assert(cond, msg) {
  if (!cond) {
    console.error("FAIL:", msg);
    process.exit(1);
  }
}

function almost(a, b, eps) {
  return Math.abs(a - b) <= (eps == null ? 1 : eps);
}

function centerY(p) {
  return p.y + p.height / 2;
}

function pos(laid, id) {
  var p = laid.positions[id];
  assert(!!p, "missing " + id);
  return p;
}

// 同一 Graph 层的 Level 0 节点必须共用一条轨道。
(function threeWayFanInLevelZeroCollinear() {
  var root = {
    version: 2,
    nodes: [
      { id: "rank", kind: "cpu", cost_ms: 10, status: "success" },
      { id: "token", kind: "cpu", cost_ms: 10, status: "success" },
      { id: "sum", kind: "cpu", cost_ms: 1, status: "success" },
      { id: "body", kind: "cpu", cost_ms: 40, status: "success" },
      { id: "fb", kind: "cpu", cost_ms: 1, status: "success" },
      { id: "merge", kind: "cpu", cost_ms: 5, status: "success" },
      { id: "llm", kind: "llm", cost_ms: 20, status: "success" }
    ],
    edges: [
      { from: "START", to: "rank" },
      { from: "rank", to: "token" },
      { from: "token", to: "sum" },
      { from: "token", to: "body" },
      { from: "token", to: "fb" },
      { from: "sum", to: "merge" },
      { from: "body", to: "merge" },
      { from: "fb", to: "merge" },
      { from: "merge", to: "llm" },
      { from: "llm", to: "END" }
    ]
  };
  var visible = Model.buildVisibleGraph(root, {});
  var laid = Layout.layoutVisibleGraph(visible, { direction: "RIGHT" });
  var rail = centerY(pos(laid, "rank"));
  ["token", "body", "merge", "llm"].forEach(function (id) {
    assert(almost(centerY(pos(laid, id)), rail), id + " on Level 0 rail");
  });
})();

// 父层轨道对齐子图的 Level 0 轨道，而不是子图包围盒中心。
(function wrapperWaistAndInnerRail() {
  var root = {
    version: 2,
    nodes: [
      { id: "left", kind: "io", cost_ms: 10, status: "success" },
      {
        id: "inner_g",
        kind: "graph",
        cost_ms: 80,
        status: "success",
        graph: {
          nodes: [
            { id: "a", kind: "cpu", cost_ms: 20, status: "success" },
            { id: "b", kind: "cpu", cost_ms: 50, status: "success" },
            { id: "side", kind: "cpu", cost_ms: 1, status: "success" }
          ],
          edges: [
            { from: "START", to: "a" },
            { from: "a", to: "b" },
            { from: "a", to: "side" },
            { from: "b", to: "END" },
            { from: "side", to: "END" }
          ]
        }
      }
    ],
    edges: [
      { from: "START", to: "left" },
      { from: "left", to: "inner_g" },
      { from: "inner_g", to: "END" }
    ]
  };
  var visible = Model.buildVisibleGraph(root, { inner_g: true });
  var laid = Layout.layoutVisibleGraph(visible, { direction: "RIGHT" });
  var a = pos(laid, "inner_g/a");
  var b = pos(laid, "inner_g/b");
  var side = pos(laid, "inner_g/side");
  assert(almost(centerY(a), centerY(b)), "inner Level 0 is collinear");
  assert(
    almost(centerY(pos(laid, "left")), centerY(a)),
    "parent rail aligns with nested Level 0"
  );
  assert(!almost(centerY(side), centerY(a)), "inner Level 1 uses another rail");
})();

console.log("OK: eino-workflow-dag-align-levels.test.js");
