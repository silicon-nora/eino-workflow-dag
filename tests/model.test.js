import { EinoWorkflowDAGModel as Model } from "../src/model.js";

if (!Model) {
  console.error("FAIL: EinoWorkflowDAGModel not exported");
  process.exit(1);
}

function assert(cond, msg) {
  if (!cond) {
    console.error("FAIL:", msg);
    process.exit(1);
  }
}

// isGraphNode：仅 kind===graph；空 graph 合法；不读 component
assert(Model.isGraphNode({ kind: "graph" }) === true, "empty graph node");
assert(Model.isGraphNode({ kind: "graph", graph: { nodes: [], edges: [] } }) === true, "empty graph field");
assert(Model.isGraphNode({ kind: "io", component: "Workflow", graph: {} }) === false, "no component heuristic");
assert(Model.isGraphNode({ kind: "subgraph", component: "Workflow", graph: {} }) === false, "old subgraph kind");
assert(Model.isGraphNode({ component: "Workflow", graph: { nodes: [] } }) === false, "component alone");

// nodeRef：输入协议只认 id；key 仅存在于渲染后的节点数据
assert(Model.nodeRef({ id: "a", key: "k" }) === "a", "id wins");
assert(Model.nodeRef({ key: "k" }) === "", "legacy key input is ignored");

var fixture = {
  version: 2,
  nodes: [
    { id: "a", kind: "io", name: "A", status: "success", cost_ms: 10, metrics: { segment: "alpha" } },
    {
      id: "g",
      kind: "graph",
      name: "G",
      status: "success",
      cost_ms: 50,
      graph: {
        nodes: [
          { id: "c1", kind: "cpu", name: "C1", status: "success", cost_ms: 20, metrics: { is_cached: true } },
          { id: "c2", kind: "cpu", name: "C2", status: "success", cost_ms: 30 }
        ],
        edges: [
          { from: "c1", to: "c2" },
          { from: "c2", toParent: "a", kind: "context" }
        ]
      }
    },
    { id: "b", kind: "io", name: "B", status: "success", cost_ms: 5 }
  ],
  edges: [
    { from: "a", to: "g" },
    { from: "g", to: "b" },
    { from: "a", to: "b", entry: "pin_internal" },
    { from: "g", toParent: "b" }
  ]
};

var collapsed = Model.buildVisibleGraph(fixture, {});
assert(collapsed.nodes.length === 3, "collapsed node count");
assert(collapsed.nodes.every(function (n) { return !n.expanded; }), "all collapsed");
var aNode = collapsed.nodes.filter(function (n) { return n.id === "a"; })[0];
assert(aNode && aNode.metrics && aNode.metrics.segment === "alpha", "metrics passthrough on leaf");
var gNode = collapsed.nodes.filter(function (n) { return n.id === "g"; })[0];
assert(gNode && gNode.subgraph && gNode.expandable, "g is expandable graph");
assert(collapsed.edges.length === 3, "collapsed edges: a→g, g→b, a→b (entry ignored)");
assert(collapsed.edges.every(function (e) {
  return e.to !== "g/c1" && e.to !== "g/c2" && e.from.indexOf("/") < 0;
}), "no internal anchors when collapsed");

var expanded = Model.buildVisibleGraph(fixture, { g: true });
assert(expanded.nodes.length === 5, "expanded: 3 root + 2 inner");
var c1 = expanded.nodes.filter(function (n) { return n.id === "g/c1"; })[0];
assert(c1 && c1.metrics && c1.metrics.is_cached === true, "nested metrics passthrough");
var outerToG = expanded.edges.filter(function (e) { return e.from === "a" && e.to === "g"; });
assert(outerToG.length === 1, "external edge anchors wrapper g");
var inner = expanded.edges.filter(function (e) { return e.from === "g/c1" && e.to === "g/c2"; });
assert(inner.length === 1, "internal edge from graph.edges");
assert(!expanded.edges.some(function (e) { return e.toParent || e.entry; }), "no legacy fields on edges");
assert(!expanded.edges.some(function (e) {
  return e.from === "g/c2" && e.to === "a";
}), "toParent ignored");

var domainNeutral = Model.buildVisibleGraph({
  version: 2,
  nodes: [
    { id: "custom_source" },
    { id: "custom_target" }
  ],
  edges: [{ from: "custom_source", to: "custom_target" }]
}, {});
assert(domainNeutral.edges.length === 1, "arbitrary domain node ids are preserved");

var subs = Model.listSubgraphs(fixture);
assert(subs.length === 1 && subs[0].path === "g", "listSubgraphs");

// v2 节点使用 id；旧边扩展字段仍可被渲染器安全忽略
var mockish = {
  version: 2,
  nodes: [
    { id: "leaf", kind: "io", name: "L", status: "success", cost_ms: 1 },
    {
      id: "sub",
      kind: "graph",
      name: "S",
      status: "success",
      cost_ms: 2,
      component: "Workflow",
      graph: {
        nodes: [{ id: "inner", component: "Lambda", kind: "cpu", name: "I", status: "success", cost_ms: 1 }],
        edges: [
          { from: "START", to: "inner" },
          { from: "inner", to: "END" },
          { from: "inner", toParent: "leaf" }
        ]
      }
    }
  ],
  edges: [
    { from: "leaf", to: "sub", entry: "inner" },
    { from: "START", to: "leaf" },
    { from: "sub", to: "END" }
  ]
};
var mVis = Model.buildVisibleGraph(mockish, { sub: true });
assert(mVis.nodes.some(function (n) { return n.id === "sub/inner"; }), "id→path works");
assert(mVis.edges.some(function (e) { return e.from === "leaf" && e.to === "sub"; }), "entry ignored, wrapper anchor");
assert(!mVis.edges.some(function (e) { return e.to === "sub/inner"; }), "forbidden internal pin");

// 主路终点：末跳 cost=0 时 dist 平局，仍应用 >= 把汇点算进 criticalPath
var zeroSink = {
  nodes: [
    { id: "n1", kind: "io", name: "N1", status: "success", cost_ms: 100 },
    { id: "n2", kind: "llm", name: "N2", status: "success", cost_ms: 200 },
    { id: "n3", kind: "io", name: "N3", status: "success", cost_ms: 0 }
  ],
  edges: [
    { from: "n1", to: "n2" },
    { from: "n2", to: "n3" }
  ]
};
var zs = Model.buildVisibleGraph(zeroSink, {});
assert(zs.criticalPath.indexOf("n3") >= 0, "zero-cost sink on criticalPath");
assert(zs.criticalPath.indexOf("n2") >= 0, "predecessor on criticalPath");
var lastCrit = zs.edges.filter(function (e) {
  return e.from === "n2" && e.to === "n3" && e.level === 1;
});
assert(lastCrit.length === 1, "n2→n3 is level 1");

// skipped 节点不得进入主路（互斥分支未执行臂即使拓扑更长也不能 critical）
var skipBranch = {
  nodes: [
    { id: "gate", kind: "cpu", name: "G", status: "success", cost_ms: 10 },
    { id: "silent", kind: "cpu", name: "S", status: "success", cost_ms: 0 },
    { id: "a", kind: "cpu", name: "A", status: "skipped", cost_ms: 0 },
    { id: "b", kind: "llm", name: "B", status: "skipped", cost_ms: 500 },
    { id: "c", kind: "cpu", name: "C", status: "skipped", cost_ms: 0 }
  ],
  edges: [
    { from: "gate", to: "silent" },
    { from: "gate", to: "a", kind: "branch" },
    { from: "a", to: "b" },
    { from: "b", to: "c" }
  ]
};
var sb = Model.buildVisibleGraph(skipBranch, {});
assert(sb.criticalPath.indexOf("silent") >= 0, "executed arm on criticalPath");
assert(sb.criticalPath.indexOf("a") < 0, "skipped a not on criticalPath");
assert(sb.criticalPath.indexOf("b") < 0, "skipped b not on criticalPath");
assert(sb.criticalPath.indexOf("c") < 0, "skipped c not on criticalPath");
assert(
  sb.edges.some(function (e) {
    return e.from === "gate" && e.to === "silent" && e.level === 1;
  }),
  "gate→silent level 1"
);
assert(
  !sb.edges.some(function (e) {
    return e.level === 1 && (e.to === "a" || e.to === "b" || e.to === "c");
  }),
  "no level-1 edge into skipped arm"
);
assert(
  sb.edges.filter(function (e) {
    return e.to === "a" || e.from === "a" || e.to === "b" || e.from === "b";
  }).every(function (e) { return e.level >= 2; }),
  "skipped-arm edges are level≥2"
);

// defaultExpandedMap：主路 graph 展开，skipped graph 收起
var defExpRoot = {
  nodes: [
    { id: "gate", kind: "cpu", name: "G", status: "success", cost_ms: 5 },
    {
      id: "main_g",
      kind: "graph",
      name: "Main",
      status: "success",
      cost_ms: 100,
      graph: {
        nodes: [{ id: "inner", kind: "llm", name: "I", status: "success", cost_ms: 80 }],
        edges: []
      }
    },
    {
      id: "side_g",
      kind: "graph",
      name: "Side",
      status: "skipped",
      cost_ms: 0,
      graph: {
        nodes: [{ id: "x", kind: "cpu", name: "X", status: "skipped", cost_ms: 0 }],
        edges: []
      }
    },
    { id: "tail", kind: "cpu", name: "T", status: "success", cost_ms: 1 }
  ],
  edges: [
    { from: "gate", to: "main_g" },
    { from: "gate", to: "side_g", kind: "branch" },
    { from: "main_g", to: "tail" }
  ]
};
var defExp = Model.defaultExpandedMap(defExpRoot);
assert(defExp.main_g === true, "main path graph default expanded");
assert(!defExp.side_g, "skipped graph stays collapsed");
var defVis = Model.buildVisibleGraph(defExpRoot, defExp);
assert(
  defVis.nodes.some(function (n) { return n.id === "main_g/inner"; }),
  "inner node visible when main_g expanded by default"
);
assert(
  !defVis.nodes.some(function (n) { return n.id === "side_g/x"; }),
  "skipped graph inner not visible"
);

// 分层主线：展开 Graph 后父链仍 critical；子图内按 START→END 最长 cost
var hierRoot = {
  version: 2,
  nodes: [
    { id: "ingest", kind: "io", cost_ms: 100, status: "success" },
    { id: "branch", kind: "branch", cost_ms: 5, status: "success" },
    { id: "silent", kind: "cpu", cost_ms: 1, status: "skipped" },
    {
      id: "nested_flow",
      kind: "graph",
      cost_ms: 500,
      status: "success",
      graph: {
        nodes: [
          { id: "input_a", kind: "io", cost_ms: 30, status: "success" },
          { id: "branch_a", kind: "cpu", cost_ms: 40, status: "success" },
          { id: "split", kind: "io", cost_ms: 10, status: "success" },
          { id: "short_path", kind: "io", cost_ms: 80, status: "success" },
          { id: "long_path", kind: "io", cost_ms: 120, status: "success" },
          { id: "merge", kind: "merge", cost_ms: 5, status: "success" },
          { id: "execute", kind: "llm", cost_ms: 200, status: "success" },
          { id: "output", kind: "io", cost_ms: 5, status: "success" }
        ],
        edges: [
          { from: "START", to: "input_a" },
          { from: "START", to: "branch_a" },
          { from: "branch_a", to: "split" },
          { from: "split", to: "short_path" },
          { from: "split", to: "long_path" },
          { from: "short_path", to: "merge" },
          { from: "long_path", to: "merge" },
          { from: "input_a", to: "merge" },
          { from: "merge", to: "execute" },
          { from: "execute", to: "output" },
          { from: "output", to: "END" }
        ]
      }
    }
  ],
  edges: [
    { from: "ingest", to: "branch" },
    { from: "branch", to: "silent", kind: "branch" },
    { from: "branch", to: "nested_flow", kind: "branch" }
  ]
};
var hierCol = Model.buildVisibleGraph(hierRoot, {});
assert(
  hierCol.criticalPath.join(",") === "ingest,branch,nested_flow",
  "collapsed root criticalPath Start→End (virtual)"
);
var hierExp = Model.buildVisibleGraph(hierRoot, { nested_flow: true });
assert(
  hierExp.criticalPath.join(",") === "ingest,branch,nested_flow",
  "expanded: root criticalPath still includes nested_flow wrapper"
);
assert(
  hierExp.edges.some(function (e) {
    return e.from === "branch" && e.to === "nested_flow" && e.level === 1;
  }),
  "expanded: parent edge into Graph stays level 1"
);
assert(
  hierExp.edges.some(function (e) {
    return e.from === "nested_flow/branch_a" && e.to === "nested_flow/split" && e.level === 1;
  }),
  "expanded: inner longest branch branch_a→split is level 1"
);
assert(
  hierExp.edges.some(function (e) {
    return e.from === "nested_flow/split" && e.to === "nested_flow/long_path" && e.level === 1;
  }),
  "expanded: longer content arm split→long_path is level 1 (not short_path)"
);
assert(
  !hierExp.edges.some(function (e) {
    return e.from === "nested_flow/split" && e.to === "nested_flow/short_path" && e.level === 1;
  }),
  "expanded: shorter summary arm is level≥2"
);
assert(
  hierExp.edges.some(function (e) {
    return e.from === "nested_flow/execute" && e.to === "nested_flow/output" && e.level === 1;
  }),
  "expanded: inner path reaches output before END"
);

// 时间相同：Graph 无论收起都按内部主路 hop 计长度，叶子链更短则让路
var hopTieRoot = {
  nodes: [
    { id: "gate", kind: "cpu", cost_ms: 0, status: "success" },
    { id: "short", kind: "io", cost_ms: 10, status: "success" },
    {
      id: "long_g",
      kind: "graph",
      cost_ms: 10,
      status: "success",
      graph: {
        nodes: [
          { id: "x", kind: "cpu", cost_ms: 1, status: "success" },
          { id: "y", kind: "cpu", cost_ms: 1, status: "success" },
          { id: "z", kind: "cpu", cost_ms: 1, status: "success" },
          { id: "side", kind: "cpu", cost_ms: 1, status: "success" }
        ],
        edges: [
          { from: "x", to: "y" },
          { from: "y", to: "z" },
          { from: "x", to: "side" }
        ]
      }
    }
  ],
  edges: [
    { from: "gate", to: "short" },
    { from: "gate", to: "long_g" }
  ]
};
var hopCol = Model.buildVisibleGraph(hopTieRoot, {});
assert(
  hopCol.criticalPath.join(",") === "gate,long_g",
  "collapsed: longer inner main path wins equal-cost tie"
);
assert(
  hopCol.criticalPath.indexOf("short") < 0,
  "collapsed: short leaf is not critical"
);
var hopExp = Model.buildVisibleGraph(hopTieRoot, { long_g: true });
assert(
  hopExp.criticalPath.join(",") === "gate,long_g",
  "expanded: parent main path unchanged"
);
assert(
  hopExp.edges.some(function (e) {
    return e.from === "long_g/x" && e.to === "long_g/y" && e.level === 1;
  }),
  "inner main x→y level 1"
);
assert(
  hopExp.edges.some(function (e) {
    return e.from === "long_g/y" && e.to === "long_g/z" && e.level === 1;
  }),
  "inner main y→z level 1"
);
assert(
  !hopExp.edges.some(function (e) {
    return e.from === "long_g/x" && e.to === "long_g/side" && e.level === 1;
  }),
  "inner side arm not level 1"
);

// 嵌套 Graph：外层 hop = 内层主路 hop（收起同样）
var nestedHopRoot = {
  nodes: [
    { id: "gate", kind: "cpu", cost_ms: 0, status: "success" },
    { id: "short", kind: "io", cost_ms: 10, status: "success" },
    {
      id: "outer_g",
      kind: "graph",
      cost_ms: 10,
      status: "success",
      graph: {
        nodes: [
          {
            id: "mid_g",
            kind: "graph",
            cost_ms: 8,
            status: "success",
            graph: {
              nodes: [
                { id: "a", kind: "cpu", cost_ms: 1, status: "success" },
                { id: "b", kind: "cpu", cost_ms: 1, status: "success" },
                { id: "c", kind: "cpu", cost_ms: 1, status: "success" }
              ],
              edges: [{ from: "a", to: "b" }, { from: "b", to: "c" }]
            }
          }
        ],
        edges: []
      }
    }
  ],
  edges: [
    { from: "gate", to: "short" },
    { from: "gate", to: "outer_g" }
  ]
};
var nestedCol = Model.buildVisibleGraph(nestedHopRoot, {});
assert(
  nestedCol.criticalPath.join(",") === "gate,outer_g",
  "collapsed nested graph still uses inner main-path hops"
);

// 旁路 Graph 展开后仍有自己的内层主线（选口/锁轨都吃这条 stroke）
var bypassGraphRoot = {
  nodes: [
    { id: "gate", kind: "cpu", cost_ms: 0, status: "success" },
    { id: "main_leaf", kind: "io", cost_ms: 100, status: "success" },
    {
      id: "side_g",
      kind: "graph",
      cost_ms: 10,
      status: "success",
      graph: {
        nodes: [
          { id: "a", kind: "cpu", cost_ms: 5, status: "success" },
          { id: "b", kind: "cpu", cost_ms: 20, status: "success" },
          { id: "side", kind: "cpu", cost_ms: 1, status: "success" }
        ],
        edges: [
          { from: "a", to: "b" },
          { from: "a", to: "side" }
        ]
      }
    }
  ],
  edges: [
    { from: "gate", to: "main_leaf" },
    { from: "gate", to: "side_g" }
  ]
};
var bypassVis = Model.buildVisibleGraph(bypassGraphRoot, { side_g: true });
assert(
  bypassVis.criticalPath.join(",") === "gate,main_leaf",
  "root criticalPath stays the parent main path"
);
assert(
  bypassVis.edges.some(function (e) {
    return e.from === "gate" && e.to === "side_g" && e.level >= 2;
  }),
  "parent edge into side graph is level≥2"
);
assert(
  bypassVis.edges.some(function (e) {
    return e.from === "side_g/a" && e.to === "side_g/b" && e.level === 1;
  }),
  "side graph inner main a→b is level 1"
);
assert(
  !bypassVis.edges.some(function (e) {
    return e.from === "side_g/a" && e.to === "side_g/side" && e.level === 1;
  }),
  "side graph inner side arm is not level 1"
);

// 整图未运行（全部 skipped）：仍要有内层 level 1 供选口/锁轨；视觉不再写 inactive
var skippedGraphRoot = {
  nodes: [
    { id: "gate", kind: "cpu", cost_ms: 10, status: "success" },
    { id: "main_leaf", kind: "io", cost_ms: 100, status: "success" },
    {
      id: "side_g",
      kind: "graph",
      cost_ms: 0,
      status: "skipped",
      graph: {
        nodes: [
          { id: "a", kind: "cpu", cost_ms: 0, status: "skipped" },
          { id: "b", kind: "cpu", cost_ms: 0, status: "skipped" },
          { id: "c", kind: "cpu", cost_ms: 0, status: "skipped" },
          { id: "side", kind: "cpu", cost_ms: 0, status: "skipped" }
        ],
        edges: [
          { from: "a", to: "b" },
          { from: "b", to: "c" },
          { from: "a", to: "side" }
        ]
      }
    }
  ],
  edges: [
    { from: "gate", to: "main_leaf" },
    { from: "gate", to: "side_g" }
  ]
};
var skippedVis = Model.buildVisibleGraph(skippedGraphRoot, { side_g: true });
var skippedMain = skippedVis.edges.filter(function (e) {
  return e.from === "side_g/a" && e.to === "side_g/b";
})[0];
var skippedSide = skippedVis.edges.filter(function (e) {
  return e.from === "side_g/a" && e.to === "side_g/side";
})[0];
assert(skippedMain && skippedMain.level === 1, "unrun inner main is level 1");
assert(skippedMain && skippedMain.main === true, "unrun inner main still tagged main");
assert(skippedVis.edges.some(function (e) {
  return e.from === "side_g/b" && e.to === "side_g/c" && e.main === true;
}), "unrun inner main continues a→b→c");
assert(skippedSide && skippedSide.level >= 2, "unrun inner side arm is level≥2");
assert(!skippedSide.main, "unrun inner shorter arm is not main");

// 扇出剥轨：side_input + branch_worker 为 level 2
var fanRoot = {
  version: 2,
  nodes: [
    {
      id: "wg",
      kind: "graph",
      cost_ms: 100,
      status: "success",
      graph: {
        nodes: [
          { id: "split", kind: "io", cost_ms: 10, status: "success" },
          { id: "topn", kind: "io", cost_ms: 5000, status: "success" },
          { id: "summary", kind: "io", cost_ms: 1000, status: "success" },
          { id: "behavior", kind: "cpu", cost_ms: 50, status: "success" },
          { id: "input_a", kind: "io", cost_ms: 100, status: "success" },
          { id: "llm", kind: "llm", cost_ms: 2000, status: "success" },
          { id: "merge", kind: "merge", cost_ms: 5, status: "success" }
        ],
        edges: [
          { from: "START", to: "split" },
          { from: "split", to: "topn" },
          { from: "split", to: "summary" },
          { from: "split", to: "behavior" },
          { from: "split", to: "input_a" },
          { from: "summary", to: "llm" },
          { from: "behavior", to: "llm" },
          { from: "input_a", to: "llm" },
          { from: "topn", to: "merge" },
          { from: "llm", to: "merge" },
          { from: "merge", to: "END" }
        ]
      }
    }
  ],
  edges: [{ from: "START", to: "wg" }, { from: "wg", to: "END" }]
};
var fan = Model.buildVisibleGraph(fanRoot, { wg: true });
function fanNode(id) {
  return fan.nodes.filter(function (n) { return n.id === id; })[0];
}
assert(fanNode("wg/topn") && fanNode("wg/topn").level === 1, "topn level 1");
assert(fanNode("wg/split") && fanNode("wg/split").level === 1, "split level 1");
assert(fanNode("wg/merge") && fanNode("wg/merge").level === 1, "merge level 1");
assert(fanNode("wg/summary") && fanNode("wg/summary").level === 2, "summary level 2");
assert(fanNode("wg/llm") && fanNode("wg/llm").level === 2, "llm level 2");
assert(
  fan.edges.some(function (e) {
    return e.from === "wg/summary" && e.to === "wg/llm" && e.level === 2;
  }),
  "summary→llm is level 2 edge"
);
assert(
  fan.edges.some(function (e) {
    return e.from === "wg/split" && e.to === "wg/topn" && e.level === 1;
  }),
  "split→topn is level 1 edge"
);

// JSON-safe IDs that resemble Object prototype properties remain ordinary IDs.
var prototypeKeyRoot = {
  version: 2,
  nodes: [
    { id: "__proto__", cost_ms: 1 },
    { id: "constructor", cost_ms: 2 },
    { id: "toString", cost_ms: 3 }
  ],
  edges: [
    { from: "__proto__", to: "constructor" },
    { from: "constructor", to: "toString" }
  ]
};
var prototypeKeyVisible = Model.buildVisibleGraph(prototypeKeyRoot, {});
assert(prototypeKeyVisible.nodes.length === 3, "prototype-like node IDs are retained");
assert(prototypeKeyVisible.edges.length === 2, "prototype-like edge endpoints resolve");
assert(
  prototypeKeyVisible.criticalPath.join(",") === "__proto__,constructor,toString",
  "prototype-like IDs participate in the critical path"
);
assert(
  prototypeKeyVisible.nodes.every(function (node) { return node.level === 1; }),
  "prototype-like IDs receive numeric rail levels"
);

var producerCritical = Model.buildVisibleGraph({
  version: 2,
  nodes: [
    { id: "producer", cost_ms: 1 },
    { id: "computed", cost_ms: 100 },
  ],
  edges: [
    { from: "START", to: "producer" },
    { from: "producer", to: "END" },
    { from: "START", to: "computed" },
    { from: "computed", to: "END" },
  ],
  critical_path: ["producer"],
}, {});
assert(
  producerCritical.criticalPath.join(",") === "producer",
  "producer critical_path is authoritative when present",
);

console.log("OK: eino-workflow-dag-model protocol tests passed");
