import { createKeyMap, toPlainRecord } from "./key-map.js";

/**
 * Eino Workflow DAG — recursive layered layout.
 * 每个已展开 Graph 独立 layoutLayer，冻结成定宽高盒子交给父层。
 * 本层主线叶子锁轨；旁路让轨；父层只把子图腰对齐前置主线节点（方案 B）。
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

  function indexById(items) {
    var m = createKeyMap();
    for (var i = 0; i < items.length; i++) m[items[i].id] = items[i];
    return m;
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

  function isMainEdge(e) {
    return !!(e && (e.main || e.level === 1 || e.stroke === "critical"));
  }

  function criticalSequence(items, edges) {
    var succ = createKeyMap();
    var pred = createKeyMap();
    var seen = createKeyMap();
    var i;
    for (i = 0; i < edges.length; i++) {
      var e = edges[i];
      if (!isMainEdge(e)) continue;
      succ[e.from] = e.to;
      pred[e.to] = e.from;
      seen[e.from] = true;
      seen[e.to] = true;
    }
    var start = null;
    var ids = Object.keys(seen);
    for (i = 0; i < ids.length; i++) {
      if (!pred[ids[i]]) {
        start = ids[i];
        break;
      }
    }
    if (!start && ids.length) start = ids[0];
    var seq = [];
    var guard = createKeyMap();
    for (var cur = start; cur && !guard[cur]; cur = succ[cur]) {
      guard[cur] = true;
      seq.push(cur);
    }
    return seq;
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

  function intervalOf(it, profile) {
    var lo = crossCoord(it, profile);
    return { lo: lo, hi: lo + crossSize(it, profile) };
  }

  function overlappingOcc(lo, hi, occ, gap) {
    for (var i = 0; i < occ.length; i++) {
      if (lo < occ[i].hi + gap && hi > occ[i].lo - gap) return occ[i];
    }
    return null;
  }

  function nearestFreeCenter(base, dir, s, occ, gap) {
    var c = base;
    var n;
    for (n = 0; n < 40; n++) {
      var hit = overlappingOcc(c - s / 2, c + s / 2, occ, gap);
      if (!hit) return c;
      c = dir > 0 ? hit.hi + gap + s / 2 : hit.lo - gap - s / 2;
    }
    return null;
  }

  function alignBypassLeavesToColumnStart(items, critSet, orig, profile) {
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      if (critSet[it.id] || it.frozen) continue;
      setMainCoord(it, profile, orig[it._layer]);
    }
  }

  function preferredBypassCenter(it, edges, byId, profile) {
    var vals = [];
    for (var i = 0; i < edges.length; i++) {
      if (edges[i].to !== it.id) continue;
      var src = byId[edges[i].from];
      if (!src) continue;
      vals.push(
        src.frozen
          ? waistCross(src, src._nest, profile)
          : crossCenter(src, profile),
      );
    }
    if (!vals.length) return null;
    vals.sort(function (a, b) {
      return a - b;
    });
    return vals[(vals.length - 1) >> 1];
  }

  function nodeCross(it, profile) {
    if (it.frozen && it._waistC != null) return it._waistC;
    return crossCenter(it, profile);
  }

  function predColumnSideOccupancy(bp, edges, byId, profile) {
    var plus = false;
    var minus = false;
    var tol = 8;
    var i;
    var ids = Object.keys(byId);
    for (i = 0; i < edges.length; i++) {
      if (edges[i].to !== bp.id) continue;
      var pred = byId[edges[i].from];
      if (!pred) continue;
      var rail = nodeCross(pred, profile);
      for (var j = 0; j < ids.length; j++) {
        var it = byId[ids[j]];
        if (!it || it.id === pred.id || it._layer !== pred._layer) continue;
        var c = crossCenter(it, profile);
        if (c > rail + tol) plus = true;
        else if (c < rail - tol) minus = true;
      }
    }
    return { plus: plus, minus: minus };
  }

  function pickBypassCenter(base, plus, minus, predOcc) {
    if (plus == null && minus == null) return null;
    if (plus == null) return minus;
    if (minus == null) return plus;
    if (predOcc.plus && !predOcc.minus) return minus;
    if (predOcc.minus && !predOcc.plus) return plus;
    var dp = plus - base;
    var dm = base - minus;
    if (dm < dp - 1) return minus;
    return plus;
  }

  function packBypasses(bypasses, occupied, spacing, profile, nested, opts) {
    opts = opts || {};
    var gap = spacing.nodeNode;
    var occ = [];
    var i;
    if (opts.reserveRail) {
      var rs = profile.cross === "x" ? LEAF_W : LEAF_H;
      occ.push({ lo: -rs / 2, hi: rs / 2 });
    }
    for (i = 0; i < occupied.length; i++) {
      var it = occupied[i];
      if (it.frozen) it._waistC = waistCross(it, nested[it.id], profile);
      occ.push(intervalOf(it, profile));
    }
    var byId = opts.byId || createKeyMap();
    var edges = opts.edges || [];
    for (i = 0; i < bypasses.length; i++) {
      var bp = bypasses[i];
      var s = crossSize(bp, profile);
      var prefer = preferredBypassCenter(bp, edges, byId, profile);
      var base = prefer == null ? 0 : prefer;
      var cen = pickBypassCenter(
        base,
        nearestFreeCenter(base, 1, s, occ, gap),
        nearestFreeCenter(base, -1, s, occ, gap),
        predColumnSideOccupancy(bp, edges, byId, profile),
      );
      if (cen == null) {
        var maxHi = 0;
        var k;
        for (k = 0; k < occ.length; k++) if (occ[k].hi > maxHi) maxHi = occ[k].hi;
        cen = maxHi + gap + s / 2;
      }
      setCrossCenter(bp, profile, cen);
      occ.push({ lo: cen - s / 2, hi: cen + s / 2 });
    }
  }

  /**
   * 按轨级锁交叉轴：同 level 共线；level 升序放置；level>1 相对已占用外推。
   * 仍按主轴列分别处理占用，避免跨列投影。
   */
  function packByRailLevels(items, edges, nested, profile, spacing, critSet) {
    var byId = indexById(items);
    var gap = spacing.nodeNode;
    var levelSet = createKeyMap();
    var i;
    for (i = 0; i < items.length; i++) {
      var lv = items[i].level != null ? items[i].level : critSet[items[i].id] ? 1 : 2;
      items[i].level = lv;
      levelSet[lv] = true;
    }
    var levels = Object.keys(levelSet)
      .map(function (x) {
        return +x;
      })
      .sort(function (a, b) {
        return a - b;
      });

    var maxCol = 0;
    for (i = 0; i < items.length; i++) {
      if (items[i]._layer > maxCol) maxCol = items[i]._layer;
    }
    var colItems = [];
    for (i = 0; i <= maxCol; i++) colItems[i] = [];
    for (i = 0; i < items.length; i++) colItems[items[i]._layer].push(items[i]);

    for (var c = 0; c <= maxCol; c++) {
      var col = colItems[c];
      if (!col.length) continue;
      var occ = [];
      var li;
      for (li = 0; li < levels.length; li++) {
        var L = levels[li];
        var members = [];
        var j;
        for (j = 0; j < col.length; j++) {
          if (col[j].level === L) members.push(col[j]);
        }
        if (!members.length) continue;
        var cen;
        if (L === 1) {
          cen = 0;
          for (j = 0; j < members.length; j++) {
            if (members[j].frozen && members[j]._waistC != null) {
              cen = members[j]._waistC;
              break;
            }
          }
        } else {
          var prefs = [];
          for (j = 0; j < members.length; j++) {
            var p = preferredBypassCenter(members[j], edges, byId, profile);
            if (p != null) prefs.push(p);
          }
          prefs.sort(function (a, b) {
            return a - b;
          });
          var base =
            prefs.length > 0 ? prefs[(prefs.length - 1) >> 1] : 0;
          var s = 0;
          for (j = 0; j < members.length; j++) {
            var cs = crossSize(members[j], profile);
            if (cs > s) s = cs;
          }
          var seed = members[0];
          cen = pickBypassCenter(
            base,
            nearestFreeCenter(base, 1, s, occ, gap),
            nearestFreeCenter(base, -1, s, occ, gap),
            predColumnSideOccupancy(seed, edges, byId, profile),
          );
          if (cen == null) {
            var maxHi = 0;
            for (j = 0; j < occ.length; j++) {
              if (occ[j].hi > maxHi) maxHi = occ[j].hi;
            }
            cen = maxHi + gap + s / 2;
          }
        }
        for (j = 0; j < members.length; j++) {
          var m = members[j];
          if (m.frozen && L === 1) {
            setWaistCross(m, nested[m.id], profile, cen);
            m._waistC = waistCross(m, nested[m.id], profile);
          } else if (m.frozen) {
            setCrossCenter(m, profile, cen);
            m._waistC = waistCross(m, nested[m.id], profile);
          } else {
            setCrossCenter(m, profile, cen);
          }
          occ.push(intervalOf(m, profile));
        }
      }
    }
  }

  function placeFlatLayer(items, edges, nested, profile, spacing) {
    if (!items.length) return;
    var layerOf = assignLayers(items, edges);
    var maxL = 0;
    var i;
    for (i = 0; i < items.length; i++) {
      items[i]._layer = layerOf[items[i].id] || 0;
      if (items[i]._layer > maxL) maxL = items[i]._layer;
    }
    var span = [];
    for (i = 0; i <= maxL; i++) span[i] = 0;
    for (i = 0; i < items.length; i++) {
      var Lay = items[i]._layer;
      var ms = mainSize(items[i], profile);
      if (ms > span[Lay]) span[Lay] = ms;
    }
    var orig = [0];
    for (i = 1; i <= maxL; i++) {
      orig[i] = orig[i - 1] + span[i - 1] + spacing.betweenLayers;
    }
    for (i = 0; i < items.length; i++) {
      var extra = span[items[i]._layer] - mainSize(items[i], profile);
      setMainCoord(
        items[i],
        profile,
        orig[items[i]._layer] + extra / 2,
      );
    }

    var critSeq = criticalSequence(items, edges);
    var critSet = createKeyMap();
    for (i = 0; i < critSeq.length; i++) critSet[critSeq[i]] = true;

    for (i = 0; i < items.length; i++) {
      var it0 = items[i];
      if (it0.level == null) it0.level = critSet[it0.id] ? 1 : 2;
      if (critSet[it0.id] && it0.frozen) {
        setWaistCross(it0, nested[it0.id], profile, 0);
      } else {
        setCrossCenter(it0, profile, 0);
      }
    }

    var byId = indexById(items);
    for (i = 0; i < items.length; i++) {
      if (nested[items[i].id]) items[i]._nest = nested[items[i].id];
      if (items[i].frozen) {
        items[i]._waistC = waistCross(items[i], nested[items[i].id], profile);
      }
    }
    for (i = 0; i < edges.length; i++) {
      var e = edges[i];
      if (!isMainEdge(e)) continue;
      var src = byId[e.from];
      var tgt = byId[e.to];
      if (!src || !tgt || !tgt.frozen) continue;
      var predC = src.frozen
        ? waistCross(src, nested[src.id], profile)
        : crossCenter(src, profile);
      setWaistCross(tgt, nested[tgt.id], profile, predC);
      tgt._waistC = waistCross(tgt, nested[tgt.id], profile);
    }

    alignBypassLeavesToColumnStart(items, critSet, orig, profile);
    packByRailLevels(items, edges, nested, profile, spacing, critSet);

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
        level: node.level != null ? node.level : 1,
      });
    }

    placeFlatLayer(items, edges, nested, profile, spacing);
    shiftToOrigin(items);
    var bbox = measureItems(items);
    var pad = wrapPad ? PAD : ZERO_PAD;
    return {
      items: items,
      nested: nested,
      size: {
        width: Math.max(LEAF_W, bbox.width + pad.left + pad.right),
        height: Math.max(LEAF_H, bbox.height + pad.top + pad.bottom),
      },
      contentMid: { x: bbox.width / 2, y: bbox.height / 2 },
      pad: pad,
    };
  }

  function flatten(laid, ox, oy, abs) {
    var items = (laid && laid.items) || [];
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      var x = ox + it.x;
      var y = oy + it.y;
      abs[it.id] = { x: x, y: y, width: it.width, height: it.height };
      if (it.frozen && laid.nested[it.id]) {
        var p = laid.nested[it.id].pad || ZERO_PAD;
        flatten(laid.nested[it.id], x + p.left, y + p.top, abs);
      }
    }
  }

  function layoutVisibleGraph(visible, opts) {
    var profile = axisProfile(opts && opts.direction);
    var laid = layoutLayer(visible, null, profile, SPACE_ROOT, false);
    var abs = createKeyMap();
    flatten(laid, 0, 0, abs);
    return { positions: toPlainRecord(abs), profile: profile };
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
