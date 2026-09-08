import {
  axisProfile,
  normalizeDirection,
  profileIsCrossSide,
} from "../src/axis-profile.js";
import {
  claimPreferredPortOwners,
  crossEndRatio,
  ensureAllLeafEdgePorts,
  isSameCrossRow,
  maxBendsForSides,
  pickInSideByGeometry,
  pickOutSideByGeometry,
  portLocalOnNode,
  refineAdaptiveSidePorts,
  spreadAllFixedPorts,
} from "../src/routing.js";
import {
  listThemes,
  normalizeTheme,
  registerTheme,
} from "../src/theme.js";

const Cyto = {
  axisProfile,
  claimPreferredPortOwners,
  crossEndRatio,
  ensureAllLeafEdgePorts,
  isSameCrossRow,
  listThemes,
  maxBendsForSides,
  normalizeDirection,
  normalizeTheme,
  pickInSideByGeometry,
  pickOutSideByGeometry,
  portLocalOnNode,
  profileIsCrossSide,
  refineAdaptiveSidePorts,
  registerTheme,
  spreadAllFixedPorts,
};

if (!Cyto || !Cyto.normalizeDirection || !Cyto.axisProfile) {
  console.error("FAIL: EinoWorkflowDAG.normalizeDirection/axisProfile not exported");
  process.exit(1);
}

function assert(cond, msg) {
  if (!cond) {
    console.error("FAIL:", msg);
    process.exit(1);
  }
}

assert(Cyto.normalizeDirection("RIGHT") === "RIGHT", "RIGHT");
assert(Cyto.normalizeDirection("DOWN") === "DOWN", "DOWN");
assert(Cyto.normalizeDirection("LEFT") === "LEFT", "LEFT");
assert(Cyto.normalizeDirection("UP") === "UP", "UP");
assert(Cyto.normalizeDirection("UNDEFINED") === "RIGHT", "UNDEFINED→RIGHT");
assert(Cyto.normalizeDirection("down") === "RIGHT", "case→RIGHT");
assert(Cyto.normalizeDirection(null) === "RIGHT", "null→RIGHT");

const removeTheme = Cyto.registerTheme("test-theme", {
  colors: { highlighted: "#123456" },
});
assert(Cyto.normalizeTheme("test-theme") === "test-theme", "custom theme normalized");
assert(Cyto.listThemes().includes("test-theme"), "custom theme listed");
removeTheme();
assert(Cyto.normalizeTheme("test-theme") === "classic", "custom theme cleanup");
let builtInThemeRejected = false;
try {
  Cyto.registerTheme("classic", {});
} catch (error) {
  builtInThemeRejected = error instanceof TypeError;
}
assert(builtInThemeRejected, "built-in themes cannot be replaced");

var R = Cyto.axisProfile("RIGHT");
assert(R.outSide === "EAST" && R.inSide === "WEST", "RIGHT ports");
assert(R.axis === "x" && R.cross === "y", "RIGHT axes");
assert(R.crossSides.join(",") === "NORTH,SOUTH", "RIGHT cross");
assert(R.outSides.join(",") === "EAST,NORTH,SOUTH", "RIGHT output sides");
assert(R.inSides.join(",") === "WEST,NORTH,SOUTH", "RIGHT input sides");

var D = Cyto.axisProfile("DOWN");
assert(D.outSide === "SOUTH" && D.inSide === "NORTH", "DOWN ports");
assert(D.axis === "y" && D.cross === "x", "DOWN axes");
assert(D.crossSides.join(",") === "EAST,WEST", "DOWN cross");
assert(D.outSides.join(",") === "SOUTH,EAST,WEST", "DOWN output sides");
assert(D.inSides.join(",") === "NORTH,EAST,WEST", "DOWN input sides");

var L = Cyto.axisProfile("LEFT");
assert(L.outSide === "WEST" && L.inSide === "EAST", "LEFT ports");
assert(L.outSides[0] === "WEST", "LEFT preferred output");

var U = Cyto.axisProfile("UP");
assert(U.outSide === "NORTH" && U.inSide === "SOUTH", "UP ports");

assert(Cyto.profileIsCrossSide(R, "NORTH") === true, "R cross N");
assert(Cyto.profileIsCrossSide(R, "EAST") === false, "R not cross E");
assert(Cyto.profileIsCrossSide(D, "EAST") === true, "D cross E");
assert(Cyto.profileIsCrossSide(D, "SOUTH") === false, "D not cross S");

if (!Cyto.maxBendsForSides) {
  console.error("FAIL: EinoWorkflowDAG.maxBendsForSides not exported");
  process.exit(1);
}
var maxB = Cyto.maxBendsForSides;
assert(maxB("NORTH", "SOUTH", R) === 2, "R NS→2");
assert(maxB("EAST", "WEST", R) === 2, "R EW→2");
assert(maxB("EAST", "WEST", D) === 2, "D EW→2");
assert(maxB("SOUTH", "NORTH", D) === 2, "D SN→2");

assert(typeof R.forwardSign === "number", "RIGHT forwardSign");
assert(R.forwardSign === 1 && D.forwardSign === 1, "forward +1");
assert(L.forwardSign === -1 && U.forwardSign === -1, "forward -1");

if (!Cyto.pickOutSideByGeometry || !Cyto.pickInSideByGeometry) {
  console.error("FAIL: pickOutSideByGeometry/pickInSideByGeometry not exported");
  process.exit(1);
}

function box(x, y) {
  return { x: x, y: y, width: 40, height: 40 };
}

var pickOut = Cyto.pickOutSideByGeometry;
var pickIn = Cyto.pickInSideByGeometry;

// RIGHT: tgt right → EAST；tgt left → N/S（禁 WEST）
assert(pickOut(box(0, 0), box(100, 0), R) === "EAST", "R out forward EAST");
assert(pickOut(box(0, 0), box(-100, 0), R) !== "WEST", "R out no WEST");
assert(
  R.outSides.indexOf(pickOut(box(0, 0), box(-100, 20), R)) >= 0,
  "R reverse output stays allowed",
);

// LEFT: tgt left of src → WEST；永不 EAST
assert(pickOut(box(100, 0), box(0, 0), L) === "WEST", "L out tgt-left → WEST");
assert(pickOut(box(0, 0), box(100, 0), L) !== "EAST", "L out no EAST");
assert(
  L.outSides.indexOf(pickOut(box(0, 0), box(100, 10), L)) >= 0,
  "L reverse output stays allowed",
);

// DOWN: tgt above → not NORTH（须在允许的输出侧 S/E/W）。
var downUp = pickOut(box(0, 100), box(0, 0), D);
assert(downUp !== "NORTH", "D out tgt-above not NORTH");
assert(D.outSides.indexOf(downUp) >= 0, "D output is allowed");
assert(pickOut(box(0, 0), box(0, 100), D) === "SOUTH", "D out forward SOUTH");

// UP: tgt below → not SOUTH
var upDown = pickOut(box(0, 0), box(0, 100), U);
assert(upDown !== "SOUTH", "U out tgt-below not SOUTH");
assert(U.outSides.indexOf(upDown) >= 0, "U output is allowed");
assert(pickOut(box(0, 100), box(0, 0), U) === "NORTH", "U out forward NORTH");

// In-side：RIGHT 来源在右 → 禁 EAST；LEFT 来源在左 → 禁 WEST
assert(pickIn(box(0, 0), box(100, 0), R) === "WEST", "R in upstream WEST");
assert(pickIn(box(100, 0), box(0, 0), R) !== "EAST", "R in no EAST");
assert(pickIn(box(100, 0), box(0, 0), L) === "EAST", "L in upstream EAST");
assert(pickIn(box(0, 0), box(100, 0), L) !== "WEST", "L in no WEST");
assert(pickIn(box(0, 0), box(0, 100), D) === "NORTH", "D in upstream NORTH");
assert(pickIn(box(0, 100), box(0, 0), D) !== "SOUTH", "D in no SOUTH");
assert(pickIn(box(0, 100), box(0, 0), U) === "SOUTH", "U in upstream SOUTH");
assert(pickIn(box(0, 0), box(0, 100), U) !== "NORTH", "U in no NORTH");

// 交叉边半区：出=前进半区，入=反方向半区
assert(Cyto.portLocalOnNode && Cyto.crossEndRatio, "portLocal/crossEnd exported");
assert(Cyto.crossEndRatio("out", R) > 0.5, "R out high-x");
assert(Cyto.crossEndRatio("in", R) < 0.5, "R in low-x");
assert(Cyto.crossEndRatio("out", L) < 0.5, "L out low-x（上出偏左）");
assert(Cyto.crossEndRatio("in", L) > 0.5, "L in high-x（上进偏右）");
assert(Cyto.crossEndRatio("out", D) > 0.5, "D out high-y");
assert(Cyto.crossEndRatio("in", U) > 0.5, "U in high-y（下进）");
assert(Cyto.crossEndRatio("out", U) < 0.5, "U out low-y（上出）");

var LnOut = Cyto.portLocalOnNode("NORTH", 100, 40, "out", L);
var LnIn = Cyto.portLocalOnNode("NORTH", 100, 40, "in", L);
assert(LnOut.x < 50 && LnIn.x > 50, "LEFT 上出左、上进右");
var RnOut = Cyto.portLocalOnNode("NORTH", 100, 40, "out", R);
var RnIn = Cyto.portLocalOnNode("NORTH", 100, 40, "in", R);
assert(RnOut.x > 50 && RnIn.x < 50, "RIGHT 上出右、上进左");

// DOWN/UP 左右缘：上入下出 / 下入上出（轻分位，不中线硬拆）
var DeOut = Cyto.portLocalOnNode("EAST", 80, 60, "out", D);
var DeIn = Cyto.portLocalOnNode("EAST", 80, 60, "in", D);
assert(DeIn.y < DeOut.y, "DOWN 右缘上入下出");
var UeOut = Cyto.portLocalOnNode("WEST", 80, 60, "out", U);
var UeIn = Cyto.portLocalOnNode("WEST", 80, 60, "in", U);
assert(UeOut.y < UeIn.y, "UP 左缘下入上出（出在上）");

if (!Cyto.ensureAllLeafEdgePorts) {
  console.error("FAIL: WorkflowDAGRenderer.ensureAllLeafEdgePorts not exported");
  process.exit(1);
}

function cyEle(stroke, flags) {
  flags = flags || {};
  return {
    isParent: function () {
      return false;
    },
    data: function (key) {
      if (key === "level") return flags.level == null ? 0 : flags.level;
      return "";
    },
  };
}

function leaf(id, x, y) {
  return {
    id: id,
    x: x,
    y: y,
    width: 220,
    height: 64,
    _cyEle: cyEle(),
  };
}

function portSide(node, portId) {
  var ports = (node && node.ports) || [];
  for (var i = 0; i < ports.length; i++) {
    if (ports[i].id === portId) return ports[i].side;
  }
  return null;
}

function assignAdaptiveOutputs(token, peers, extraEdges) {
  token.ports = [
    {
      id: "token:east-anchor",
      _end: "out",
      _railAnchor: true,
      side: "EAST",
    },
  ];
  var children = [token].concat(peers);
  var edges = [
    {
      source: "token",
      target: "topn",
      sourcePort: "token:east-anchor",
      _cyEle: cyEle("level-zero"),
    },
  ].concat(extraEdges || []);
  var lookup = { token: token };
  var abs = { token: token };
  for (var i = 0; i < peers.length; i++) {
    lookup[peers[i].id] = peers[i];
    abs[peers[i].id] = peers[i];
  }
  var graph = {
    id: "root",
    _axisProfile: R,
    children: children,
    edges: edges,
  };
  Cyto.ensureAllLeafEdgePorts(graph, lookup, abs);
  return edges;
}

// 前向输出已占用时，优先选择朝向目标的交叉侧。
(function firstAdaptiveEdgePrefersTargetFacingCrossSide() {
  var token = leaf("token", 0, 100);
  var topn = leaf("topn", 300, 100);
  var fb = leaf("fb", 300, 250);
  var edges = assignAdaptiveOutputs(token, [topn, fb], [
    {
      source: "token",
      target: "fb",
      _cyEle: cyEle("higher-level"),
    },
  ]);
  var fbEdge = edges[1];
  assert(portSide(token, fbEdge.sourcePort) === "SOUTH", "below-right edge uses SOUTH");
})();

(function twoAdaptiveEdgesKeepFacingCrossSides() {
  var token = leaf("token", 0, 100);
  var topn = leaf("topn", 300, 100);
  var fb = leaf("fb", 300, 250);
  var sum = leaf("sum", 300, -50);
  var edges = assignAdaptiveOutputs(token, [topn, fb, sum], [
    {
      source: "token",
      target: "fb",
      _cyEle: cyEle("higher-level"),
    },
    {
      source: "token",
      target: "sum",
      _cyEle: cyEle("higher-level"),
    },
  ]);
  assert(portSide(token, edges[1].sourcePort) === "SOUTH", "first below → SOUTH");
  assert(portSide(token, edges[2].sourcePort) === "NORTH", "second above → NORTH");
})();

(function belowRightEdgeDoesNotStealEast() {
  var token = leaf("token", 0, 100);
  var topn = leaf("topn", 300, 100);
  var profile = leaf("profile", 300, 180);
  var edges = assignAdaptiveOutputs(token, [topn, profile], [
    {
      source: "token",
      target: "profile",
      _cyEle: cyEle("higher-level"),
    },
  ]);
  assert(portSide(token, edges[1].sourcePort) === "SOUTH", "below-right edge uses SOUTH");
  assert(portSide(token, edges[1].sourcePort) !== "EAST", "below-right must not steal EAST");
})();

function wrapper(id, x, y, w, h) {
  return {
    id: id,
    x: x,
    y: y,
    width: w,
    height: h,
    _cyEle: {
      isParent: function () {
        return true;
      },
      data: function (key) {
        if (key === "subgraph" || key === "expandable") return true;
        if (key === "stroke") return "";
        return "";
      },
    },
  };
}

(function wrapperForwardEdgeSharesEastWithAnchor() {
  var railGraph = wrapper("rail_graph", 1778, 29, 1328, 451);
  var downstream = wrapper("downstream", 3612, 221, 1051, 68);
  var alternateSink = leaf("alternateSink", 4028, 463);
  railGraph.ports = [
    {
      id: "rail_graph:east-anchor",
      _end: "out",
      _railAnchor: true,
      side: "EAST",
    },
  ];
  downstream.ports = [
    {
      id: "downstream:west-anchor",
      _end: "in",
      _railAnchor: true,
      side: "WEST",
    },
  ];
  var eRail = {
    source: "rail_graph",
    target: "downstream",
    sourcePort: "rail_graph:east-anchor",
    targetPort: "downstream:west-anchor",
    _cyEle: cyEle("level-zero"),
  };
  var eAlternate = {
    source: "rail_graph",
    target: "alternateSink",
    _adaptiveOut: true,
    _adaptiveIn: true,
    _cyEle: cyEle("higher-level"),
  };
  var lookup = {
    rail_graph: railGraph,
    downstream: downstream,
    alternateSink: alternateSink,
  };
  var graph = {
    id: "root",
    _axisProfile: R,
    children: [railGraph, downstream, alternateSink],
    edges: [eRail, eAlternate],
  };
  Cyto.refineAdaptiveSidePorts(graph, lookup);
  Cyto.ensureAllLeafEdgePorts(graph, lookup, lookup);
  assert(
    portSide(railGraph, eAlternate.sourcePort) === "EAST",
    "expanded wrapper forward edge shares EAST with the anchor"
  );
  assert(
    portSide(railGraph, eAlternate.sourcePort) !== "SOUTH",
    "wrapper must not drop a forward edge to SOUTH"
  );
  assert(
    portSide(alternateSink, eAlternate.targetPort) === "WEST",
    "alternate sink inbound stays WEST"
  );
  if (!Cyto.spreadAllFixedPorts) {
    console.error("FAIL: spreadAllFixedPorts not exported");
    process.exit(1);
  }
  Cyto.spreadAllFixedPorts(graph, lookup);
  var bpPort = null;
  var ports = railGraph.ports || [];
  for (var pi = 0; pi < ports.length; pi++) {
    if (ports[pi].id === eAlternate.sourcePort) bpPort = ports[pi];
  }
  assert(!!bpPort, "adaptive EAST port exists after spread");
  var peerLocalY = alternateSink.y + alternateSink.height / 2 - railGraph.y;
  var maxY = railGraph.height - 10;
  var expectY = Math.min(maxY, Math.max(10, peerLocalY));
  assert(
    Math.abs(bpPort.y - expectY) <= 2,
    "wrapper adaptive EAST port tracks peer Y; y=" +
      bpPort.y +
      " expect=" +
      expectY
  );
})();

(function wrapperInboundWestInsetsFromTopWhenPeerAbove() {
  var box = wrapper("wg", 200, 400, 800, 400);
  var src = leaf("sourceNode", 0, 0);
  box.ports = [
    {
      id: "wg:west-in",
      _end: "in",
      _railAnchor: false,
      _peerId: "sourceNode",
      side: "WEST",
    },
  ];
  var lookup = { wg: box, sourceNode: src };
  var graph = {
    id: "root",
    _axisProfile: R,
    children: [src, box],
    edges: [],
  };
  Cyto.spreadAllFixedPorts(graph, lookup);
  var p = box.ports[0];
  assert(p.side === "WEST", "stays WEST");
  assert(
    p.y >= 48,
    "inbound WEST insets from top corner when peer is above; y=" + p.y
  );
})();

if (!Cyto.claimPreferredPortOwners || !Cyto.refineAdaptiveSidePorts) {
  console.error("FAIL: Level port planning exports are unavailable");
  process.exit(1);
}

(function claimPreferredPortOwnersUsesLevelThenDistance() {
  var behavior = leaf("behavior", 0, 100);
  var summary = leaf("summary", 0, 280);
  var auxiliary = leaf("auxiliary", 0, -80);
  var llm = leaf("llm", 360, 100);
  var eBeh = {
    source: "behavior",
    target: "llm",
    _cyEle: cyEle("higher-level"),
  };
  var eSum = {
    source: "summary",
    target: "llm",
    _cyEle: cyEle("higher-level"),
  };
  var ePor = {
    source: "auxiliary",
    target: "llm",
    _cyEle: cyEle("higher-level"),
  };
  var abs = {
    behavior: behavior,
    summary: summary,
    auxiliary: auxiliary,
    llm: llm,
  };
  var owners = Cyto.claimPreferredPortOwners([eBeh, eSum, ePor], abs, R);
  assert(owners.inOwner.llm === eBeh, "same-row inbound owns WEST");
  assert(Cyto.isSameCrossRow(behavior, llm, R), "behavior/llm same row");
  assert(!Cyto.isSameCrossRow(summary, llm, R), "summary not same row");
})();

(function llmFanInBelowUsesSouthWhenWestTaken() {
  var behavior = leaf("behavior", 0, 100);
  var summary = leaf("summary", 0, 280);
  var auxiliary = leaf("auxiliary", 0, -80);
  var llm = leaf("llm", 360, 100);
  var eBeh = {
    source: "behavior",
    target: "llm",
    _adaptiveOut: true,
    _adaptiveIn: true,
    _cyEle: cyEle("higher-level"),
  };
  var eSum = {
    source: "summary",
    target: "llm",
    _adaptiveOut: true,
    _adaptiveIn: true,
    _cyEle: cyEle("higher-level"),
  };
  var ePor = {
    source: "auxiliary",
    target: "llm",
    _adaptiveOut: true,
    _adaptiveIn: true,
    _cyEle: cyEle("higher-level"),
  };
  var lookup = {
    behavior: behavior,
    summary: summary,
    auxiliary: auxiliary,
    llm: llm,
  };
  var graph = {
    id: "root",
    _axisProfile: R,
    children: [behavior, summary, auxiliary, llm],
    edges: [eBeh, eSum, ePor],
  };
  Cyto.refineAdaptiveSidePorts(graph, lookup);
  assert(portSide(llm, eBeh.targetPort) === "WEST", "aligned inbound keeps WEST");
  assert(portSide(llm, eSum.targetPort) === "SOUTH", "below inbound uses SOUTH");
  assert(portSide(llm, ePor.targetPort) === "NORTH", "above inbound uses NORTH");
})();

(function lowerLevelOwnsWest() {
  var behavior = leaf("behavior", 0, 100);
  var summary = leaf("summary", 0, 280);
  var llm = leaf("llm", 360, 100);
  var eBeh = {
    source: "behavior",
    target: "llm",
    _cyEle: cyEle("inactive", { level: 0 }),
  };
  var eSum = {
    source: "summary",
    target: "llm",
    _adaptiveOut: true,
    _adaptiveIn: true,
    _cyEle: cyEle("inactive", { level: 1 }),
  };
  var owners = Cyto.claimPreferredPortOwners(
    [eBeh, eSum],
    { behavior: behavior, summary: summary, llm: llm },
    R
  );
  assert(owners.inOwner.llm === eBeh, "lower-Level inbound owns WEST slot");
  llm.ports = [{
    id: "llm:west-anchor",
    x: 0,
    y: llm.height / 2,
    side: "WEST",
    _end: "in",
    _railAnchor: true,
  }];
  eBeh.targetPort = "llm:west-anchor";
  var lookup = { behavior: behavior, summary: summary, llm: llm };
  var graph = {
    id: "root",
    _axisProfile: R,
    children: [behavior, summary, llm],
    edges: [eBeh, eSum],
  };
  Cyto.refineAdaptiveSidePorts(graph, lookup);
  assert(portSide(llm, eSum.targetPort) === "SOUTH", "higher-Level inbound uses SOUTH");
})();

console.log("OK eino-workflow-dag-axis-profile.test.js");
