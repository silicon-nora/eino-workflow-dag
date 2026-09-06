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

function workGuidanceInner() {
  return {
    nodes: [
      { id: "rank_docs", kind: "cpu", cost_ms: 0, status: "success" },
      { id: "prepare_token", kind: "io", cost_ms: 0, status: "success" },
      { id: "file_behavior", kind: "cpu", cost_ms: 0, status: "success" },
      { id: "load_summary", kind: "io", cost_ms: 1157, status: "success" },
      { id: "user_profile", kind: "io", cost_ms: 96, status: "success" },
      { id: "load_topn", kind: "io", cost_ms: 4096, status: "success" },
      { id: "llm_work_items", kind: "llm", cost_ms: 2688, status: "success" },
      { id: "prepare_card_input", kind: "merge", cost_ms: 0, status: "success" },
      { id: "llm_card", kind: "llm", cost_ms: 3804, status: "success" },
      { id: "repair", kind: "llm", cost_ms: 0, status: "success" },
      { id: "enrich", kind: "cpu", cost_ms: 0, status: "success" }
    ],
    edges: [
      { from: "START", to: "rank_docs" },
      { from: "rank_docs", to: "prepare_token" },
      { from: "prepare_token", to: "file_behavior" },
      { from: "prepare_token", to: "load_summary" },
      { from: "prepare_token", to: "user_profile" },
      { from: "prepare_token", to: "load_topn" },
      { from: "load_summary", to: "llm_work_items" },
      { from: "file_behavior", to: "llm_work_items" },
      { from: "user_profile", to: "llm_work_items" },
      { from: "llm_work_items", to: "prepare_card_input" },
      { from: "load_topn", to: "prepare_card_input" },
      { from: "prepare_card_input", to: "llm_card" },
      { from: "llm_card", to: "repair" },
      { from: "repair", to: "enrich" },
      { from: "enrich", to: "END" }
    ]
  };
}

function badCaseRoot() {
  return {
    version: 2,
    nodes: [
      { id: "discover", kind: "io", cost_ms: 10, status: "success" },
      { id: "resolve", kind: "io", cost_ms: 10, status: "success" },
      { id: "files", kind: "cpu", cost_ms: 0, status: "success" },
      { id: "heat", kind: "cpu", cost_ms: 0, status: "success" },
      { id: "intent", kind: "cpu", cost_ms: 0, status: "success" },
      {
        id: "work_guidance",
        kind: "graph",
        cost_ms: 7902,
        status: "success",
        graph: workGuidanceInner()
      },
      {
        id: "week_items",
        kind: "graph",
        cost_ms: 0,
        status: "skipped",
        graph: { nodes: [], edges: [] }
      },
      {
        id: "week_recommend",
        kind: "graph",
        cost_ms: 0,
        status: "skipped",
        graph: { nodes: [], edges: [] }
      }
    ],
    edges: [
      { from: "START", to: "discover" },
      { from: "discover", to: "resolve" },
      { from: "resolve", to: "files" },
      { from: "files", to: "heat" },
      { from: "heat", to: "intent" },
      { from: "intent", to: "work_guidance" },
      { from: "intent", to: "week_items" },
      { from: "week_items", to: "week_recommend" },
      { from: "work_guidance", to: "END" }
    ]
  };
}

var INNER_CRIT = [
  "work_guidance/rank_docs",
  "work_guidance/prepare_token",
  "work_guidance/load_topn",
  "work_guidance/prepare_card_input",
  "work_guidance/llm_card",
  "work_guidance/repair",
  "work_guidance/enrich"
];
var OUTER_CRIT = ["discover", "resolve", "files", "heat", "intent"];

(function innerCriticalCollinear() {
  var root = badCaseRoot();
  var visible = Model.buildVisibleGraph(root, { work_guidance: true });
  var laid = Layout.layoutVisibleGraph(visible, { direction: "RIGHT" });
  sameRail(laid, INNER_CRIT, "y", "inner critical Y");
})();

(function bypassYieldsRail() {
  var root = badCaseRoot();
  var visible = Model.buildVisibleGraph(root, { work_guidance: true });
  var laid = Layout.layoutVisibleGraph(visible, { direction: "RIGHT" });
  var topn = posOf(laid, "work_guidance/load_topn");
  var llm = posOf(laid, "work_guidance/llm_work_items");
  var railY = center(posOf(laid, "work_guidance/rank_docs"), "y");
  var minGap = Layout.SPACE_COMPOUND.nodeNode;
  assert(
    gapOnCross(topn, llm, "y") + 1e-6 >= minGap ||
      Math.abs(center(llm, "y") - railY) > 1,
    "bypass llm must leave the inner rail"
  );
  assert(
    !almost(center(llm, "y"), railY),
    "bypass llm_work_items must not sit on inner critical rail"
  );
  assert(
    almost(center(topn, "y"), railY),
    "load_topn stays on inner rail"
  );
})();

(function llmAlignsWithLevel2Summary() {
  var root = badCaseRoot();
  var visible = Model.buildVisibleGraph(root, { work_guidance: true });
  var laid = Layout.layoutVisibleGraph(visible, { direction: "RIGHT" });
  var llmY = center(posOf(laid, "work_guidance/llm_work_items"), "y");
  var sumY = center(posOf(laid, "work_guidance/load_summary"), "y");
  var topnY = center(posOf(laid, "work_guidance/load_topn"), "y");
  assert(almost(llmY, sumY), "level-2 llm shares rail with load_summary");
  assert(
    !almost(llmY, topnY),
    "level-2 llm must leave level-1 rail"
  );
  assert(
    gapOnCross(
      posOf(laid, "work_guidance/load_topn"),
      posOf(laid, "work_guidance/llm_work_items"),
      "y"
    ) +
      1e-6 >=
      Layout.SPACE_COMPOUND.nodeNode,
    "level-2 rail clears level-1 by nodeNode"
  );
})();

(function sameLayerCentersOnMainAxis() {
  var root = badCaseRoot();
  var visible = Model.buildVisibleGraph(root, { work_guidance: true });
  var laid = Layout.layoutVisibleGraph(visible, { direction: "RIGHT" });
  var box = posOf(laid, "work_guidance");
  var skipped = posOf(laid, "week_items");
  assert(
    almost(box.x, skipped.x),
    "same-layer bypass leaf left-aligns with frozen box"
  );
})();

(function bypassChainLeavesMainRail() {
  var root = badCaseRoot();
  var visible = Model.buildVisibleGraph(root, { work_guidance: true });
  var laid = Layout.layoutVisibleGraph(visible, { direction: "RIGHT" });
  var outerRail = center(posOf(laid, "intent"), "y");
  assert(
    !almost(center(posOf(laid, "week_recommend"), "y"), outerRail),
    "skipped recommend must not sit on outer critical rail"
  );
})();

(function optionBWaistNotInnerRail() {
  var root = badCaseRoot();
  var visible = Model.buildVisibleGraph(root, { work_guidance: true });
  var laid = Layout.layoutVisibleGraph(visible, { direction: "RIGHT" });
  var intent = posOf(laid, "intent");
  var box = posOf(laid, "work_guidance");
  var kids = INNER_CRIT.concat([
    "work_guidance/file_behavior",
    "work_guidance/load_summary",
    "work_guidance/user_profile",
    "work_guidance/llm_work_items"
  ]);
  var minY = Infinity;
  var maxY = -Infinity;
  kids.forEach(function (id) {
    var p = posOf(laid, id);
    if (p.y < minY) minY = p.y;
    if (p.y + p.height > maxY) maxY = p.y + p.height;
  });
  var waistY = (minY + maxY) / 2;
  assert(almost(center(intent, "y"), waistY), "intent center = wrapper content waist");
  sameRail(laid, OUTER_CRIT, "y", "outer critical Y");
  assert(almost(center(intent, "y"), center(posOf(laid, OUTER_CRIT[0]), "y")), "intent on outer rail");
})();

(function collapsedIsLeafOnRail() {
  var root = badCaseRoot();
  var visible = Model.buildVisibleGraph(root, {});
  var laid = Layout.layoutVisibleGraph(visible, { direction: "RIGHT" });
  var wg = posOf(laid, "work_guidance");
  assert(almost(wg.width, 220) && almost(wg.height, 64), "collapsed wrapper is leaf size");
  sameRail(laid, OUTER_CRIT.concat(["work_guidance"]), "y", "collapsed on outer rail");
})();

(function downLocksCrossX() {
  var root = badCaseRoot();
  var visible = Model.buildVisibleGraph(root, { work_guidance: true });
  var laid = Layout.layoutVisibleGraph(visible, { direction: "DOWN" });
  sameRail(laid, INNER_CRIT, "x", "DOWN inner critical X");
  sameRail(laid, OUTER_CRIT, "x", "DOWN outer critical X");
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
  sameRail(laid, ["mid/inner/a", "mid/inner/b"], "y", "innermost critical");
  var left = posOf(laid, "left");
  var midBox = posOf(laid, "mid");
  var m1 = posOf(laid, "mid/m1");
  var innerBox = posOf(laid, "mid/inner");
  var a = posOf(laid, "mid/inner/a");
  var b = posOf(laid, "mid/inner/b");
  var side = posOf(laid, "mid/inner/side");
  var innerWaist = (Math.min(a.y, b.y, side.y) + Math.max(a.y + a.height, b.y + b.height, side.y + side.height)) / 2;
  assert(almost(center(m1, "y"), innerWaist), "mid layer: m1 aligns to inner box waist");
  var midKidsMin = Math.min(m1.y, innerBox.y, a.y, b.y, side.y);
  var midKidsMax = Math.max(
    m1.y + m1.height,
    innerBox.y + innerBox.height,
    a.y + a.height,
    b.y + b.height,
    side.y + side.height
  );
  var midWaist = (midKidsMin + midKidsMax) / 2;
  assert(almost(center(left, "y"), midWaist), "root: left aligns to mid box waist");
})();

(function bypassGraphHasOwnInnerRail() {
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
  sameRail(laid, ["side_g/a", "side_g/b"], "y", "bypass graph inner main");
  assert(
    Math.abs(center(posOf(laid, "side_g/a"), "y") - center(posOf(laid, "side_g/side"), "y")) > 1,
    "bypass graph inner side yields inner rail"
  );
})();

(function parallelBypassLeftAlignsWithMainBox() {
  var root = {
    version: 2,
    nodes: [
      { id: "intent", kind: "cpu", cost_ms: 10, status: "success" },
      {
        id: "work_items",
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
        id: "recommend",
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
      { id: "write", kind: "io", cost_ms: 0, status: "success" }
    ],
    edges: [
      { from: "START", to: "intent" },
      { from: "intent", to: "work_items" },
      { from: "work_items", to: "recommend" },
      { from: "work_items", to: "write" },
      { from: "recommend", to: "END" }
    ]
  };
  var visible = Model.buildVisibleGraph(root, {
    work_items: true,
    recommend: true
  });
  var laid = Layout.layoutVisibleGraph(visible, { direction: "RIGHT" });
  var rec = posOf(laid, "recommend");
  var write = posOf(laid, "write");
  var gap = Layout.SPACE_ROOT.nodeNode;
  assert(
    write.y + 1e-6 >= rec.y + rec.height + gap,
    "write sits below same-column main box + gap; write.y=" +
      write.y +
      " rec.bottom=" +
      (rec.y + rec.height)
  );
  assert(
    almost(write.x, rec.x),
    "bypass leaf left-aligns with same-column main box; write.x=" +
      write.x +
      " rec.x=" +
      rec.x
  );
})();

(function bypassPrefersClearSideOfPredColumn() {
  var root = {
    version: 2,
    nodes: [
      { id: "intent", kind: "cpu", cost_ms: 10, status: "success" },
      { id: "work_items", kind: "io", cost_ms: 100, status: "success" },
      { id: "work_guidance", kind: "io", cost_ms: 1, status: "success" },
      {
        id: "recommend",
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
      { id: "write", kind: "io", cost_ms: 0, status: "success" }
    ],
    edges: [
      { from: "START", to: "intent" },
      { from: "intent", to: "work_items" },
      { from: "intent", to: "work_guidance" },
      { from: "work_items", to: "recommend" },
      { from: "work_items", to: "write" },
      { from: "recommend", to: "END" }
    ]
  };
  var visible = Model.buildVisibleGraph(root, { recommend: true });
  var laid = Layout.layoutVisibleGraph(visible, { direction: "RIGHT" });
  var items = posOf(laid, "work_items");
  var guidance = posOf(laid, "work_guidance");
  var rec = posOf(laid, "recommend");
  var write = posOf(laid, "write");
  assert(
    center(guidance, "y") > center(items, "y"),
    "pred-column bypass still yields below the rail"
  );
  assert(
    center(write, "y") < center(rec, "y"),
    "write goes above because pred column already occupies below; write.y=" +
      write.y +
      " rec.y=" +
      rec.y
  );
  var gap = Layout.SPACE_ROOT.nodeNode;
  assert(
    almost(rec.y, write.y + write.height + gap),
    "write snaps to occupied edge + gap, not k * leaf; rec.y=" +
      rec.y +
      " expected=" +
      (write.y + write.height + gap)
  );
})();

(function bypassPrefersClearSideWhenPredColumnHasFrozenBox() {
  var root = {
    version: 2,
    nodes: [
      { id: "intent", kind: "cpu", cost_ms: 10, status: "success" },
      { id: "work_items", kind: "io", cost_ms: 100, status: "success" },
      {
        id: "work_guidance",
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
        id: "recommend",
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
      { id: "write", kind: "io", cost_ms: 0, status: "success" }
    ],
    edges: [
      { from: "START", to: "intent" },
      { from: "intent", to: "work_items" },
      { from: "intent", to: "work_guidance" },
      { from: "work_items", to: "recommend" },
      { from: "work_items", to: "write" },
      { from: "recommend", to: "END" }
    ]
  };
  var visible = Model.buildVisibleGraph(root, {
    work_guidance: true,
    recommend: true
  });
  var laid = Layout.layoutVisibleGraph(visible, { direction: "RIGHT" });
  var items = posOf(laid, "work_items");
  var guidance = posOf(laid, "work_guidance");
  var rec = posOf(laid, "recommend");
  var write = posOf(laid, "write");
  assert(
    center(guidance, "y") > center(items, "y"),
    "expanded pred-column box still yields below the rail"
  );
  assert(
    center(write, "y") < center(rec, "y"),
    "write goes above even when pred-column occupant is a frozen box; write.y=" +
      write.y +
      " rec.y=" +
      rec.y +
      " guidance.y=" +
      guidance.y
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
