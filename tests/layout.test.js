import { EinoWorkflowDAGModel as Model } from "../src/model.js";
import { EinoWorkflowDAGLayout as Layout } from "../src/layout.js";

if (!Model) {
  console.error("FAIL: EinoWorkflowDAGModel not exported");
  process.exit(1);
}
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

function center(pos, axis) {
  if (axis === "x") return pos.x + pos.width / 2;
  return pos.y + pos.height / 2;
}

function progressStart(pos, direction) {
  if (direction === "RIGHT") return pos.x;
  if (direction === "LEFT") return -(pos.x + pos.width);
  if (direction === "DOWN") return pos.y;
  return -(pos.y + pos.height);
}

function progressEnd(pos, direction) {
  if (direction === "RIGHT") return pos.x + pos.width;
  if (direction === "LEFT") return -pos.x;
  if (direction === "DOWN") return pos.y + pos.height;
  return -pos.y;
}

function posOf(laid, id) {
  var p = laid.positions[id];
  assert(!!p, "missing position " + id);
  return p;
}

function sameRail(laid, ids, axis, msg) {
  var c0 = center(posOf(laid, ids[0]), axis);
  for (var i = 1; i < ids.length; i++) {
    assert(
      almost(center(posOf(laid, ids[i]), axis), c0),
      (msg || "rail") + ": " + ids[i] + " " + center(posOf(laid, ids[i]), axis) + " != " + c0
    );
  }
}

function gapOnCross(a, b, axis) {
  var ca = center(a, axis);
  var cb = center(b, axis);
  var sa = axis === "x" ? a.width : a.height;
  var sb = axis === "x" ? b.width : b.height;
  return Math.abs(ca - cb) - (sa + sb) / 2;
}

function nestedPipeline() {
  return {
    nodes: [
      { id: "source_a", kind: "cpu", cost_ms: 0, status: "success" },
      { id: "stage_a", kind: "io", cost_ms: 0, status: "success" },
      { id: "side_a", kind: "cpu", cost_ms: 0, status: "success" },
      { id: "side_b", kind: "io", cost_ms: 1157, status: "success" },
      { id: "side_c", kind: "io", cost_ms: 96, status: "success" },
      { id: "source_b", kind: "io", cost_ms: 4096, status: "success" },
      { id: "branch_worker", kind: "llm", cost_ms: 2688, status: "success" },
      { id: "merge_inputs", kind: "merge", cost_ms: 0, status: "success" },
      { id: "transform", kind: "llm", cost_ms: 3804, status: "success" },
      { id: "validate", kind: "llm", cost_ms: 0, status: "success" },
      { id: "finalize", kind: "cpu", cost_ms: 0, status: "success" }
    ],
    edges: [
      { from: "START", to: "source_a" },
      { from: "source_a", to: "stage_a" },
      { from: "stage_a", to: "side_a" },
      { from: "stage_a", to: "side_b" },
      { from: "stage_a", to: "side_c" },
      { from: "stage_a", to: "source_b" },
      { from: "side_b", to: "branch_worker" },
      { from: "side_a", to: "branch_worker" },
      { from: "side_c", to: "branch_worker" },
      { from: "branch_worker", to: "merge_inputs" },
      { from: "source_b", to: "merge_inputs" },
      { from: "merge_inputs", to: "transform" },
      { from: "transform", to: "validate" },
      { from: "validate", to: "finalize" },
      { from: "finalize", to: "END" }
    ]
  };
}

function badCaseRoot() {
  return {
    version: 2,
    nodes: [
      { id: "ingest", kind: "io", cost_ms: 10, status: "success" },
      { id: "normalize", kind: "io", cost_ms: 10, status: "success" },
      { id: "prepare", kind: "cpu", cost_ms: 0, status: "success" },
      { id: "classify", kind: "cpu", cost_ms: 0, status: "success" },
      { id: "dispatch", kind: "cpu", cost_ms: 0, status: "success" },
      {
        id: "nested_pipeline",
        kind: "graph",
        cost_ms: 7902,
        status: "success",
        graph: nestedPipeline()
      },
      {
        id: "skipped_branch",
        kind: "graph",
        cost_ms: 0,
        status: "skipped",
        graph: { nodes: [], edges: [] }
      },
      {
        id: "skipped_tail",
        kind: "graph",
        cost_ms: 0,
        status: "skipped",
        graph: { nodes: [], edges: [] }
      }
    ],
    edges: [
      { from: "START", to: "ingest" },
      { from: "ingest", to: "normalize" },
      { from: "normalize", to: "prepare" },
      { from: "prepare", to: "classify" },
      { from: "classify", to: "dispatch" },
      { from: "dispatch", to: "nested_pipeline" },
      { from: "dispatch", to: "skipped_branch" },
      { from: "skipped_branch", to: "skipped_tail" },
      { from: "nested_pipeline", to: "END" }
    ]
  };
}

var INNER_LEVEL_ZERO = [
  "nested_pipeline/source_a",
  "nested_pipeline/stage_a",
  "nested_pipeline/source_b",
  "nested_pipeline/merge_inputs",
  "nested_pipeline/transform",
  "nested_pipeline/validate",
  "nested_pipeline/finalize"
];
var OUTER_LEVEL_ZERO = ["ingest", "normalize", "prepare", "classify", "dispatch"];

(function innerLevelZeroCollinear() {
  var root = badCaseRoot();
  var visible = Model.buildVisibleGraph(root, { nested_pipeline: true });
  var laid = Layout.layoutVisibleGraph(visible, { direction: "RIGHT" });
  sameRail(laid, INNER_LEVEL_ZERO, "y", "inner Level 0 Y");
})();

(function higherLevelUsesOwnRail() {
  var root = badCaseRoot();
  var visible = Model.buildVisibleGraph(root, { nested_pipeline: true });
  var laid = Layout.layoutVisibleGraph(visible, { direction: "RIGHT" });
  var topn = posOf(laid, "nested_pipeline/source_b");
  var llm = posOf(laid, "nested_pipeline/branch_worker");
  var railY = center(posOf(laid, "nested_pipeline/source_a"), "y");
  var minGap = Layout.SPACE_COMPOUND.nodeNode;
  assert(
    gapOnCross(topn, llm, "y") + 1e-6 >= minGap ||
      Math.abs(center(llm, "y") - railY) > 1,
    "higher-Level llm must leave the inner rail"
  );
  assert(
    !almost(center(llm, "y"), railY),
    "higher-Level branch_worker must not sit on inner Level 0 rail"
  );
  assert(
    almost(center(topn, "y"), railY),
    "source_b stays on inner rail"
  );
})();

(function llmAlignsWithLevel2Summary() {
  var root = badCaseRoot();
  var visible = Model.buildVisibleGraph(root, { nested_pipeline: true });
  var laid = Layout.layoutVisibleGraph(visible, { direction: "RIGHT" });
  var llmY = center(posOf(laid, "nested_pipeline/branch_worker"), "y");
  var sumY = center(posOf(laid, "nested_pipeline/side_b"), "y");
  var topnY = center(posOf(laid, "nested_pipeline/source_b"), "y");
  assert(almost(llmY, sumY), "level-2 llm shares rail with side_b");
  assert(
    !almost(llmY, topnY),
    "level-2 llm must leave level-1 rail"
  );
  assert(
    gapOnCross(
      posOf(laid, "nested_pipeline/source_b"),
      posOf(laid, "nested_pipeline/branch_worker"),
      "y"
    ) +
      1e-6 >=
      Layout.SPACE_COMPOUND.nodeNode,
    "level-2 rail clears level-1 by nodeNode"
  );
})();

(function parallelBranchesAdvanceIndependently() {
  var root = badCaseRoot();
  var visible = Model.buildVisibleGraph(root, { nested_pipeline: true });
  ["RIGHT", "LEFT", "DOWN", "UP"].forEach(function (direction) {
    var laid = Layout.layoutVisibleGraph(visible, { direction: direction });
    var box = posOf(laid, "nested_pipeline");
    var skipped = posOf(laid, "skipped_branch");
    var tail = posOf(laid, "skipped_tail");
    assert(
      almost(progressStart(box, direction), progressStart(skipped, direction)),
      direction + " aligns direct branches at their input boundary"
    );
    assert(
      almost(
        progressStart(tail, direction),
        progressEnd(skipped, direction) + Layout.SPACE_ROOT.betweenLayers
      ),
      direction + " advances a branch from its own predecessor"
    );
    assert(
      progressEnd(tail, direction) < progressEnd(box, direction),
      direction + " keeps the short branch inside the expanded branch span"
    );
  });
})();

(function higherLevelChainUsesOwnRail() {
  var root = badCaseRoot();
  var visible = Model.buildVisibleGraph(root, { nested_pipeline: true });
  var laid = Layout.layoutVisibleGraph(visible, { direction: "RIGHT" });
  var outerRail = center(posOf(laid, "dispatch"), "y");
  assert(
    !almost(center(posOf(laid, "skipped_tail"), "y"), outerRail),
    "skipped downstream_graph must not sit on outer Level 0 rail"
  );
})();

(function wrapperUsesInnerLevelZeroRail() {
  var root = badCaseRoot();
  var visible = Model.buildVisibleGraph(root, { nested_pipeline: true });
  var laid = Layout.layoutVisibleGraph(visible, { direction: "RIGHT" });
  var dispatch = posOf(laid, "dispatch");
  var innerLevelZero = posOf(laid, INNER_LEVEL_ZERO[0]);
  assert(
    almost(center(dispatch, "y"), center(innerLevelZero, "y")),
    "parent rail aligns to nested Level 0"
  );
  assert(
    almost(laid.railAnchors.nested_pipeline.y, center(innerLevelZero, "y")),
    "expanded graph publishes its Level 0 rail anchor"
  );
  sameRail(laid, OUTER_LEVEL_ZERO, "y", "outer Level 0 Y");
  assert(almost(center(dispatch, "y"), center(posOf(laid, OUTER_LEVEL_ZERO[0]), "y")), "dispatch on outer rail");
})();

(function collapsedIsLeafOnRail() {
  var root = badCaseRoot();
  var visible = Model.buildVisibleGraph(root, {});
  var laid = Layout.layoutVisibleGraph(visible, { direction: "RIGHT" });
  var wg = posOf(laid, "nested_pipeline");
  assert(almost(wg.width, 220) && almost(wg.height, 64), "collapsed wrapper is leaf size");
  sameRail(laid, OUTER_LEVEL_ZERO.concat(["nested_pipeline"]), "y", "collapsed on outer rail");
})();

(function downLocksCrossX() {
  var root = badCaseRoot();
  var visible = Model.buildVisibleGraph(root, { nested_pipeline: true });
  var laid = Layout.layoutVisibleGraph(visible, { direction: "DOWN" });
  sameRail(laid, INNER_LEVEL_ZERO, "x", "DOWN inner Level 0 X");
  sameRail(laid, OUTER_LEVEL_ZERO, "x", "DOWN outer Level 0 X");
})();

(function nestedTwoLevels() {
  var root = {
    version: 2,
    nodes: [
      { id: "left", kind: "io", cost_ms: 10, status: "success" },
      {
        id: "mid",
        kind: "graph",
        cost_ms: 50,
        status: "success",
        graph: {
          nodes: [
            { id: "m1", kind: "cpu", cost_ms: 5, status: "success" },
            {
              id: "inner",
              kind: "graph",
              cost_ms: 40,
              status: "success",
              graph: {
                nodes: [
                  { id: "a", kind: "cpu", cost_ms: 10, status: "success" },
                  { id: "b", kind: "cpu", cost_ms: 20, status: "success" },
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
            { from: "START", to: "m1" },
            { from: "m1", to: "inner" },
            { from: "inner", to: "END" }
          ]
        }
      }
    ],
    edges: [
      { from: "START", to: "left" },
      { from: "left", to: "mid" },
      { from: "mid", to: "END" }
    ]
  };
  var visible = Model.buildVisibleGraph(root, { mid: true, "mid/inner": true });
  var laid = Layout.layoutVisibleGraph(visible, { direction: "RIGHT" });
  sameRail(laid, ["mid/inner/a", "mid/inner/b"], "y", "innermost Level 0");
  var left = posOf(laid, "left");
  var midBox = posOf(laid, "mid");
  var m1 = posOf(laid, "mid/m1");
  var innerBox = posOf(laid, "mid/inner");
  var a = posOf(laid, "mid/inner/a");
  var b = posOf(laid, "mid/inner/b");
  var side = posOf(laid, "mid/inner/side");
  assert(almost(center(m1, "y"), center(a, "y")), "mid layer aligns to nested Level 0");
  assert(almost(center(left, "y"), center(m1, "y")), "root aligns to nested Level 0");
})();

(function higherLevelGraphHasOwnInnerRail() {
  var root = {
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
  var visible = Model.buildVisibleGraph(root, { side_g: true });
  var laid = Layout.layoutVisibleGraph(visible, { direction: "RIGHT" });
  sameRail(laid, ["side_g/a", "side_g/b"], "y", "nested graph Level 0");
  assert(
    Math.abs(center(posOf(laid, "side_g/a"), "y") - center(posOf(laid, "side_g/side"), "y")) > 1,
    "higher-Level graph inner side yields inner rail"
  );
})();

(function parallelLevelsShareInputBoundary() {
  var root = {
    version: 2,
    nodes: [
      { id: "dispatch", kind: "cpu", cost_ms: 10, status: "success" },
      {
        id: "level_zero_graph",
        kind: "graph",
        cost_ms: 100,
        status: "success",
        graph: {
          nodes: [
            { id: "a", kind: "cpu", cost_ms: 10, status: "success" },
            { id: "b", kind: "cpu", cost_ms: 10, status: "success" },
            { id: "side", kind: "cpu", cost_ms: 1, status: "success" },
            { id: "side2", kind: "cpu", cost_ms: 1, status: "success" }
          ],
          edges: [
            { from: "START", to: "a" },
            { from: "a", to: "b" },
            { from: "a", to: "side" },
            { from: "a", to: "side2" },
            { from: "b", to: "END" },
            { from: "side", to: "END" },
            { from: "side2", to: "END" }
          ]
        }
      },
      {
        id: "downstream_graph",
        kind: "graph",
        cost_ms: 50,
        status: "success",
        graph: {
          nodes: [
            { id: "r1", kind: "cpu", cost_ms: 20, status: "success" },
            { id: "r2", kind: "cpu", cost_ms: 20, status: "success" },
            { id: "r3", kind: "cpu", cost_ms: 20, status: "success" }
          ],
          edges: [
            { from: "START", to: "r1" },
            { from: "r1", to: "r2" },
            { from: "r2", to: "r3" },
            { from: "r3", to: "END" }
          ]
        }
      },
      { id: "higher_level_sink", kind: "io", cost_ms: 0, status: "success" }
    ],
    edges: [
      { from: "START", to: "dispatch" },
      { from: "dispatch", to: "level_zero_graph" },
      { from: "level_zero_graph", to: "downstream_graph" },
      { from: "level_zero_graph", to: "higher_level_sink" },
      { from: "downstream_graph", to: "END" }
    ]
  };
  var visible = Model.buildVisibleGraph(root, {
    level_zero_graph: true,
    downstream_graph: true
  });
  var laid = Layout.layoutVisibleGraph(visible, { direction: "RIGHT" });
  var rec = posOf(laid, "downstream_graph");
  var higher_level_sink = posOf(laid, "higher_level_sink");
  var gap = Layout.SPACE_ROOT.nodeNode;
  assert(
    gapOnCross(rec, higher_level_sink, "y") + 1e-6 >= gap,
    "higher_level_sink clears the same-column Level 0 box on either side"
  );
  assert(
    almost(higher_level_sink.x, rec.x),
    "parallel Levels share their input boundary"
  );
})();

(function joinWaitsForFurthestPredecessor() {
  var root = {
    version: 2,
    nodes: [
      { id: "source", kind: "cpu", cost_ms: 1, status: "success" },
      {
        id: "wide_branch",
        kind: "graph",
        cost_ms: 10,
        status: "success",
        graph: {
          nodes: [
            { id: "a", kind: "cpu", cost_ms: 1, status: "success" },
            { id: "b", kind: "cpu", cost_ms: 1, status: "success" },
            { id: "c", kind: "cpu", cost_ms: 1, status: "success" }
          ],
          edges: [
            { from: "START", to: "a" },
            { from: "a", to: "b" },
            { from: "b", to: "c" },
            { from: "c", to: "END" }
          ]
        }
      },
      { id: "short_branch", kind: "io", cost_ms: 1, status: "success" },
      { id: "join", kind: "merge", cost_ms: 1, status: "success" }
    ],
    edges: [
      { from: "START", to: "source" },
      { from: "source", to: "wide_branch" },
      { from: "source", to: "short_branch" },
      { from: "wide_branch", to: "join" },
      { from: "short_branch", to: "join" },
      { from: "join", to: "END" }
    ]
  };
  var visible = Model.buildVisibleGraph(root, { wide_branch: true });
  ["RIGHT", "LEFT", "DOWN", "UP"].forEach(function (direction) {
    var laid = Layout.layoutVisibleGraph(visible, { direction: direction });
    var wide = posOf(laid, "wide_branch");
    var short = posOf(laid, "short_branch");
    var join = posOf(laid, "join");
    var expected =
      Math.max(
        progressEnd(wide, direction),
        progressEnd(short, direction)
      ) + Layout.SPACE_ROOT.betweenLayers;
    assert(
      almost(progressStart(join, direction), expected),
      direction + " places a join after its furthest predecessor"
    );
  });
})();

(function levelsStayGloballyOrdered() {
  var root = {
    version: 2,
    nodes: [
      { id: "dispatch", kind: "cpu", cost_ms: 10, status: "success" },
      { id: "level_zero_graph", kind: "io", cost_ms: 100, status: "success" },
      { id: "nested_pipeline", kind: "io", cost_ms: 1, status: "success" },
      {
        id: "downstream_graph",
        kind: "graph",
        cost_ms: 50,
        status: "success",
        graph: {
          nodes: [
            { id: "r1", kind: "cpu", cost_ms: 20, status: "success" },
            { id: "r2", kind: "cpu", cost_ms: 20, status: "success" },
            { id: "r3", kind: "cpu", cost_ms: 20, status: "success" }
          ],
          edges: [
            { from: "START", to: "r1" },
            { from: "r1", to: "r2" },
            { from: "r2", to: "r3" },
            { from: "r3", to: "END" }
          ]
        }
      },
      { id: "higher_level_sink", kind: "io", cost_ms: 0, status: "success" }
    ],
    edges: [
      { from: "START", to: "dispatch" },
      { from: "dispatch", to: "level_zero_graph" },
      { from: "dispatch", to: "nested_pipeline" },
      { from: "level_zero_graph", to: "downstream_graph" },
      { from: "level_zero_graph", to: "higher_level_sink" },
      { from: "downstream_graph", to: "END" }
    ]
  };
  var visible = Model.buildVisibleGraph(root, { downstream_graph: true });
  ["RIGHT", "LEFT", "DOWN", "UP"].forEach(function (direction) {
    var laid = Layout.layoutVisibleGraph(visible, { direction: direction });
    var axis = direction === "RIGHT" || direction === "LEFT" ? "y" : "x";
    var items = posOf(laid, "level_zero_graph");
    var sideNode = posOf(laid, "nested_pipeline");
    var rec = posOf(laid, "downstream_graph");
    var higher_level_sink = posOf(laid, "higher_level_sink");
    var levelZeroRail = center(items, axis);
    assert(
      (center(sideNode, axis) - levelZeroRail) *
          (center(higher_level_sink, axis) - levelZeroRail) <
        0,
      direction + " distributes higher Levels across both sides of Level 0"
    );
    var gap = Layout.SPACE_ROOT.nodeNode;
    assert(
      gapOnCross(rec, higher_level_sink, axis) + 1e-6 >= gap,
      direction + " preserves the configured gap between Level bands"
    );
  });
})();

(function levelsStayOrderedWithFrozenBox() {
  var root = {
    version: 2,
    nodes: [
      { id: "dispatch", kind: "cpu", cost_ms: 10, status: "success" },
      { id: "level_zero_graph", kind: "io", cost_ms: 100, status: "success" },
      {
        id: "nested_pipeline",
        kind: "graph",
        cost_ms: 1,
        status: "success",
        graph: {
          nodes: [
            { id: "g1", kind: "cpu", cost_ms: 10, status: "success" },
            { id: "g2", kind: "cpu", cost_ms: 10, status: "success" },
            { id: "side", kind: "io", cost_ms: 1, status: "success" }
          ],
          edges: [
            { from: "START", to: "g1" },
            { from: "g1", to: "g2" },
            { from: "g1", to: "side" },
            { from: "g2", to: "END" }
          ]
        }
      },
      {
        id: "downstream_graph",
        kind: "graph",
        cost_ms: 50,
        status: "success",
        graph: {
          nodes: [
            { id: "r1", kind: "cpu", cost_ms: 20, status: "success" },
            { id: "r2", kind: "cpu", cost_ms: 20, status: "success" }
          ],
          edges: [
            { from: "START", to: "r1" },
            { from: "r1", to: "r2" },
            { from: "r2", to: "END" }
          ]
        }
      },
      { id: "higher_level_sink", kind: "io", cost_ms: 0, status: "success" }
    ],
    edges: [
      { from: "START", to: "dispatch" },
      { from: "dispatch", to: "level_zero_graph" },
      { from: "dispatch", to: "nested_pipeline" },
      { from: "level_zero_graph", to: "downstream_graph" },
      { from: "level_zero_graph", to: "higher_level_sink" },
      { from: "downstream_graph", to: "END" }
    ]
  };
  var visible = Model.buildVisibleGraph(root, {
    nested_pipeline: true,
    downstream_graph: true
  });
  var laid = Layout.layoutVisibleGraph(visible, { direction: "RIGHT" });
  var items = posOf(laid, "level_zero_graph");
  var sideNode = posOf(laid, "nested_pipeline");
  var rec = posOf(laid, "downstream_graph");
  var higher_level_sink = posOf(laid, "higher_level_sink");
  assert(
    !almost(center(sideNode, "y"), center(items, "y")),
    "expanded pred-column box uses a distinct higher-Level rail"
  );
  assert(
    !almost(center(higher_level_sink, "y"), center(rec, "y")),
    "higher Level remains distinct when another column contains a frozen box"
  );
  assert(
    (center(sideNode, "y") - center(items, "y")) *
        (center(higher_level_sink, "y") - center(rec, "y")) <
      0,
    "expanded boxes still allow Level rails on both sides"
  );
})();

(function supportsPrototypeLikeNodeIds() {
  var root = {
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
  var laid = Layout.layoutVisibleGraph(Model.buildVisibleGraph(root, {}), {
    direction: "RIGHT"
  });
  assert(Object.hasOwn(laid.positions, "__proto__"), "__proto__ position retained");
  assert(Object.hasOwn(laid.positions, "constructor"), "constructor position retained");
  assert(Object.hasOwn(laid.positions, "toString"), "toString position retained");
  assert(
    posOf(laid, "__proto__").x < posOf(laid, "constructor").x &&
      posOf(laid, "constructor").x < posOf(laid, "toString").x,
    "prototype-like IDs preserve layered ordering"
  );
})();

console.log("OK: eino-workflow-dag-layout.test.js");
