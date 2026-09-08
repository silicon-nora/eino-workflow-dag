import { createKeyMap, toPlainRecord } from "./key-map.js";

/**
 * Eino Workflow DAG — recursive layered layout.
 * 每个已展开 Graph 独立 layoutLayer，冻结成定宽高盒子交给父层。
 * 每个 Graph 层按 Level 0…N 建立稳定轨道；同层同 Level 始终共用一个交叉轴坐标。
 * Framework agnostic: no Cytoscape dependency and no external layout engine.
 */
const runtime = {};

(function (global) {
  "use strict";

  var LEAF_W = 220;
  var LEAF_H = 64;
  var PAD = { top: 29, right: 24, bottom: 24, left: 24 };
  var ZERO_PAD = { top: 0, right: 0, bottom: 0, left: 0 };
  var SPACE_ROOT = { nodeNode: 56, betweenLayers: 48 };
  var SPACE_COMPOUND = { nodeNode: 64, betweenLayers: 56 };
  var DIRS = { RIGHT: 1, LEFT: 1, DOWN: 1, UP: 1 };

  function normalizeDirection(d) {
    if (typeof d === "string" && DIRS[d]) return d;
    return "RIGHT";
  }

  function axisProfile(direction) {
    var dir = normalizeDirection(direction);
    if (dir === "LEFT") {
      return {
        direction: dir,
        axis: "x",
        cross: "y",
        forwardSign: -1,
      };
    }
    if (dir === "DOWN") {
      return {
        direction: dir,
        axis: "y",
        cross: "x",
        forwardSign: 1,
      };
    }
    if (dir === "UP") {
      return {
        direction: dir,
        axis: "y",
        cross: "x",
        forwardSign: -1,
      };
    }
    return {
      direction: "RIGHT",
      axis: "x",
      cross: "y",
      forwardSign: 1,
    };
  }

  function nodesOf(visible, parentId) {
    var out = [];
    var list = (visible && visible.nodes) || [];
    for (var i = 0; i < list.length; i++) {
      var p = list[i].parent || null;
      if (p === parentId) out.push(list[i]);
    }
    return out;
  }

  function edgesOf(visible, byId) {
    var out = [];
    var list = (visible && visible.edges) || [];
    for (var i = 0; i < list.length; i++) {
      var e = list[i];
      if (e && byId[e.from] && byId[e.to] && e.from !== e.to) out.push(e);
    }
    return out;
  }

  function mainSize(it, profile) {
    return profile.axis === "x" ? it.width : it.height;
  }

  function crossSize(it, profile) {
    return profile.cross === "x" ? it.width : it.height;
  }

  function mainCoord(it, profile) {
    return profile.axis === "x" ? it.x : it.y;
  }

  function setMainCoord(it, profile, v) {
    if (profile.axis === "x") it.x = v;
    else it.y = v;
  }

  function crossCoord(it, profile) {
    return profile.cross === "x" ? it.x : it.y;
  }

  function setCrossCoord(it, profile, v) {
    if (profile.cross === "x") it.x = v;
    else it.y = v;
  }

  function crossCenter(it, profile) {
    return crossCoord(it, profile) + crossSize(it, profile) / 2;
  }

  function setCrossCenter(it, profile, c) {
    setCrossCoord(it, profile, c - crossSize(it, profile) / 2);
  }

  function assignLayers(items, edges) {
    var layer = createKeyMap();
    var indeg = createKeyMap();
    var outs = createKeyMap();
    var i;
    for (i = 0; i < items.length; i++) {
      layer[items[i].id] = 0;
      indeg[items[i].id] = 0;
      outs[items[i].id] = [];
    }
    for (i = 0; i < edges.length; i++) {
      var e = edges[i];
      if (indeg[e.to] == null || outs[e.from] == null) continue;
      outs[e.from].push(e.to);
      indeg[e.to] += 1;
    }
    var q = [];
    for (i = 0; i < items.length; i++) {
      if (indeg[items[i].id] === 0) q.push(items[i].id);
    }
    var qi = 0;
    while (qi < q.length) {
      var u = q[qi++];
      var next = outs[u] || [];
      for (var n = 0; n < next.length; n++) {
        var v = next[n];
        if (layer[u] + 1 > layer[v]) layer[v] = layer[u] + 1;
        indeg[v] -= 1;
        if (indeg[v] === 0) q.push(v);
      }
    }
    return layer;
  }

  function localWaist(it, nest, profile) {
    var pad = (nest && nest.pad) || ZERO_PAD;
    var mid = (nest && nest.contentMid) || {
      x: it.width / 2,
      y: it.height / 2,
    };
    if (profile.cross === "x") return pad.left + mid.x;
    return pad.top + mid.y;
  }

  function waistCross(it, nest, profile) {
    if (!it.frozen || !nest) return crossCenter(it, profile);
    return crossCoord(it, profile) + localWaist(it, nest, profile);
  }

  function setWaistCross(it, nest, profile, target) {
    setCrossCoord(it, profile, target - localWaist(it, nest, profile));
  }

  /**
   * Compute graph-local Level rails around Level 0. Topology-only slots choose
   * a stable side for every higher Level; measured bounds then determine the
   * collision-free distance on that side.
   */
  function packByRailLevels(items, edges, nested, profile, spacing) {
    var gap = spacing.nodeNode;
    var groups = createKeyMap();
    var itemById = createKeyMap();
    var i;
    for (i = 0; i < items.length; i++) {
      var lv = Number.isInteger(items[i].level) && items[i].level >= 0
        ? items[i].level
        : 0;
      items[i].level = lv;
      itemById[items[i].id] = items[i];
      if (!groups[lv]) groups[lv] = [];
      groups[lv].push(items[i]);
    }
    var levels = Object.keys(groups)
      .map(function (x) {
        return +x;
      })
      .sort(function (a, b) {
        return a - b;
      });

    var rails = createKeyMap();
    var railSlots = createKeyMap();
    var occupiedMin = 0;
    var occupiedMax = 0;
    var positiveLevels = 0;
    var negativeLevels = 0;
    for (var li = 0; li < levels.length; li++) {
      var level = levels[li];
      var members = groups[levels[li]];
      var minOffset = Infinity;
      var maxOffset = -Infinity;
      for (var j = 0; j < members.length; j++) {
        var member = members[j];
        var anchor = member.frozen
          ? localWaist(member, nested[member.id], profile)
          : crossSize(member, profile) / 2;
        minOffset = Math.min(minOffset, -anchor);
        maxOffset = Math.max(maxOffset, crossSize(member, profile) - anchor);
      }
      var rail = 0;
      if (li === 0) {
        occupiedMin = minOffset;
        occupiedMax = maxOffset;
        railSlots[level] = 0;
      } else {
        var positiveRail = occupiedMax + gap - minOffset;
        var negativeRail = occupiedMin - gap - maxOffset;
        var connectedSlots = [];
        for (var ei = 0; ei < edges.length; ei++) {
          var edge = edges[ei];
          var source = itemById[edge.from];
          var target = itemById[edge.to];
          if (!source || !target) continue;
          if (source.level === level && railSlots[target.level] != null) {
            connectedSlots.push(railSlots[target.level]);
          } else if (
            target.level === level &&
            railSlots[source.level] != null
          ) {
            connectedSlots.push(railSlots[source.level]);
          }
        }
        var positiveSlot = positiveLevels + 1;
        var negativeSlot = -(negativeLevels + 1);
        var score = function score(candidate) {
          var distance = 0;
          for (var ri = 0; ri < connectedSlots.length; ri++) {
            distance += Math.abs(candidate - connectedSlots[ri]);
          }
          var nextMin = Math.min(-negativeLevels, candidate);
          var nextMax = Math.max(positiveLevels, candidate);
          return distance + (nextMax - nextMin) * 0.5;
        };
        var positiveScore = score(positiveSlot);
        var negativeScore = score(negativeSlot);
        var slot;
        if (negativeScore < positiveScore - 1e-6) {
          slot = negativeSlot;
        } else if (positiveScore < negativeScore - 1e-6) {
          slot = positiveSlot;
        } else {
          slot = negativeLevels < positiveLevels ? negativeSlot : positiveSlot;
        }
        railSlots[level] = slot;
        rail = slot < 0 ? negativeRail : positiveRail;
        if (slot < 0) negativeLevels += 1;
        else positiveLevels += 1;
        occupiedMin = Math.min(occupiedMin, rail + minOffset);
        occupiedMax = Math.max(occupiedMax, rail + maxOffset);
      }
      rails[level] = rail;
      for (j = 0; j < members.length; j++) {
        member = members[j];
        if (member.frozen) {
          setWaistCross(member, nested[member.id], profile, rail);
          member._waistC = rail;
        } else {
          setCrossCenter(member, profile, rail);
        }
      }
    }
  }

  function placeFlatLayer(items, edges, nested, profile, spacing) {
    if (!items.length) return;
    var layerOf = assignLayers(items, edges);
    var incoming = createKeyMap();
    var itemById = createKeyMap();
    var i;
    for (i = 0; i < items.length; i++) {
      items[i]._layer = layerOf[items[i].id] || 0;
      items[i]._order = i;
      incoming[items[i].id] = [];
      itemById[items[i].id] = items[i];
    }
    for (i = 0; i < edges.length; i++) {
      var edge = edges[i];
      if (!itemById[edge.from] || !incoming[edge.to]) continue;
      incoming[edge.to].push(edge.from);
    }

    /**
     * Advance each branch from its direct predecessors. Complete cross-axis
     * bounds are separated by packByRailLevels, so different Levels may share
     * main-axis space without inheriting the widest Graph in a topology layer.
     */
    var ordered = items.slice().sort(function (a, b) {
      return a._layer - b._layer || a._order - b._order;
    });
    for (i = 0; i < ordered.length; i++) {
      var item = ordered[i];
      var start = 0;
      var predecessors = incoming[item.id] || [];
      for (var pi = 0; pi < predecessors.length; pi++) {
        var predecessor = itemById[predecessors[pi]];
        if (!predecessor) continue;
        start = Math.max(
          start,
          mainCoord(predecessor, profile) +
            mainSize(predecessor, profile) +
            spacing.betweenLayers,
        );
      }
      setMainCoord(item, profile, start);
    }

    for (i = 0; i < items.length; i++) {
      var it0 = items[i];
      if (!Number.isInteger(it0.level) || it0.level < 0) it0.level = 0;
      setCrossCenter(it0, profile, 0);
    }

    for (i = 0; i < items.length; i++) {
      if (nested[items[i].id]) items[i]._nest = nested[items[i].id];
      if (items[i].frozen) {
        items[i]._waistC = waistCross(items[i], nested[items[i].id], profile);
      }
    }
    packByRailLevels(items, edges, nested, profile, spacing);

    if (profile.forwardSign < 0) {
      var maxEnd = 0;
      for (i = 0; i < items.length; i++) {
        var end = mainCoord(items[i], profile) + mainSize(items[i], profile);
        if (end > maxEnd) maxEnd = end;
      }
      for (i = 0; i < items.length; i++) {
        setMainCoord(
          items[i],
          profile,
          maxEnd - mainCoord(items[i], profile) - mainSize(items[i], profile),
        );
      }
    }
  }

  function measureItems(items) {
    var minX = Infinity;
    var minY = Infinity;
    var maxX = -Infinity;
    var maxY = -Infinity;
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      if (it.x < minX) minX = it.x;
      if (it.y < minY) minY = it.y;
      if (it.x + it.width > maxX) maxX = it.x + it.width;
      if (it.y + it.height > maxY) maxY = it.y + it.height;
    }
    if (!items.length || !isFinite(minX)) {
      return { minX: 0, minY: 0, width: LEAF_W, height: LEAF_H };
    }
    return {
      minX: minX,
      minY: minY,
      width: maxX - minX,
      height: maxY - minY,
    };
  }

  function shiftToOrigin(items) {
    var b = measureItems(items);
    for (var i = 0; i < items.length; i++) {
      items[i].x -= b.minX;
      items[i].y -= b.minY;
    }
  }

  function emptyLayout(wrapPad) {
    return {
      items: [],
      nested: createKeyMap(),
      size: { width: LEAF_W, height: LEAF_H },
      contentMid: { x: LEAF_W / 2, y: LEAF_H / 2 },
      pad: wrapPad ? PAD : ZERO_PAD,
    };
  }

  function layoutLayer(visible, parentId, profile, spacing, wrapPad) {
    var nodes = nodesOf(visible, parentId);
    if (!nodes.length) return emptyLayout(wrapPad);

    var byVis = createKeyMap();
    var i;
    for (i = 0; i < nodes.length; i++) byVis[nodes[i].id] = nodes[i];
    var edges = edgesOf(visible, byVis);

    var nested = createKeyMap();
    for (i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      if (n.expanded && n.subgraph) {
        nested[n.id] = layoutLayer(
          visible,
          n.id,
          profile,
          SPACE_COMPOUND,
          true,
        );
      }
    }

    var items = [];
    for (i = 0; i < nodes.length; i++) {
      var node = nodes[i];
      var nest = nested[node.id];
      items.push({
        id: node.id,
        width: nest ? nest.size.width : LEAF_W,
        height: nest ? nest.size.height : LEAF_H,
        x: 0,
        y: 0,
        frozen: !!nest,
        level: node.level != null ? node.level : 0,
      });
    }

    placeFlatLayer(items, edges, nested, profile, spacing);
    shiftToOrigin(items);
    var bbox = measureItems(items);
    var pad = wrapPad ? PAD : ZERO_PAD;
    var contentMid = { x: bbox.width / 2, y: bbox.height / 2 };
    for (i = 0; i < items.length; i++) {
      if (items[i].level !== 0) continue;
      var rail = items[i].frozen
        ? waistCross(items[i], nested[items[i].id], profile)
        : crossCenter(items[i], profile);
      contentMid[profile.cross] = rail;
      break;
    }
    return {
      items: items,
      nested: nested,
      size: {
        width: Math.max(LEAF_W, bbox.width + pad.left + pad.right),
        height: Math.max(LEAF_H, bbox.height + pad.top + pad.bottom),
      },
      contentMid: contentMid,
      pad: pad,
    };
  }

  function flatten(laid, ox, oy, abs, railAnchors) {
    var items = (laid && laid.items) || [];
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      var x = ox + it.x;
      var y = oy + it.y;
      abs[it.id] = { x: x, y: y, width: it.width, height: it.height };
      if (it.frozen && laid.nested[it.id]) {
        var inner = laid.nested[it.id];
        var p = inner.pad || ZERO_PAD;
        var innerX = x + p.left;
        var innerY = y + p.top;
        railAnchors[it.id] = {
          x: innerX + inner.contentMid.x,
          y: innerY + inner.contentMid.y,
        };
        flatten(inner, innerX, innerY, abs, railAnchors);
      }
    }
  }

  function layoutVisibleGraph(visible, opts) {
    var profile = axisProfile(opts && opts.direction);
    var laid = layoutLayer(visible, null, profile, SPACE_ROOT, false);
    var abs = createKeyMap();
    var railAnchors = createKeyMap();
    flatten(laid, 0, 0, abs, railAnchors);
    return {
      positions: toPlainRecord(abs),
      railAnchors: toPlainRecord(railAnchors),
      profile: profile,
    };
  }

  global.WorkflowDAGLayout = {
    layoutVisibleGraph: layoutVisibleGraph,
    axisProfile: axisProfile,
    normalizeDirection: normalizeDirection,
    SPACE_ROOT: SPACE_ROOT,
    SPACE_COMPOUND: SPACE_COMPOUND,
    GRAPH_COMPOUND_PAD: PAD,
    LEAF_W: LEAF_W,
    LEAF_H: LEAF_H,
  };
})(runtime);

export const EinoWorkflowDAGLayout = runtime.WorkflowDAGLayout;
export const layoutVisibleGraph = EinoWorkflowDAGLayout.layoutVisibleGraph;
