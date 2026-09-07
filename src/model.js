import {
  createKeyMap,
  hasOwnKey,
  toPlainRecord,
} from "./key-map.js";

/**
 * Eino Workflow DAG — visible graph model (framework agnostic).
 *
 * Private projection consumed by the layout and Cytoscape adapter.
 * - Nested graphs use kind === "graph".
 * - Edges connect nodes within one graph layer.
 * - Public node paths are encoded before they become renderer IDs.
 * - 展开后外部边仍锚子图包装节点，内部只画 graph.edges
 *
 * Minimal protocol fixture:
 * {
 *   version: 1, nodes: [
 *     { id: "a", kind: "io", name: "A", status: "success", cost_ms: 10 },
 *     { id: "g", kind: "graph", name: "G", status: "success", cost_ms: 50,
 *       graph: { nodes: [
 *         { id: "c1", kind: "cpu", name: "C1", status: "success", cost_ms: 20 },
 *         { id: "c2", kind: "cpu", name: "C2", status: "success", cost_ms: 30 }
 *       ], edges: [
 *         { from: "c1", to: "c2" }
 *       ]}}
 *   ], edges: [
 *     { from: "a", to: "g" }
 *   ]
 * }
 */
const runtime = {};

function appendPath(prefix, id) {
  return prefix ? prefix + '/' + id : id;
}

(function (global) {
  'use strict';

  /** Return the graph-local node ID. */
  function nodeRef(n) {
    if (!n) return '';
    if (n.id != null && n.id !== '') return String(n.id);
    return '';
  }

  function isGraphNode(n) {
    return !!(n && n.kind === 'graph');
  }

  function listSubgraphs(graph, prefix, out) {
    out = out || [];
    (graph.nodes || []).forEach(function (n) {
      var id = nodeRef(n);
      if (!id) return;
      var path = appendPath(prefix, id);
      if (isGraphNode(n)) {
        out.push({ path: path, name: n.name || n.original_id || id, node: n });
        if (n.graph) listSubgraphs(n.graph, path, out);
      }
    });
    return out;
  }

  function nodeById(nodes, id) {
    for (var i = 0; i < nodes.length; i++) {
      if (nodes[i].id === id) return nodes[i];
    }
    return null;
  }

  /**
   * 同层边 → 可见边。禁止 toParent / entry 语义；锚点即 from/to 本身（可为 graph 包装节点）。
   */
  function materializeEdges(rawEdges, nodes) {
    var out = [];
    var seq = 0;
    (rawEdges || []).forEach(function (e) {
      if (!e || !e.from || !e.to || e.from === e.to) return;
      if (e.toParent || e.to_parent) return;
      if (!nodeById(nodes, e.from) || !nodeById(nodes, e.to)) return;
      out.push({
        id: 'e' + (seq++) + '_' + e.from + '__' + e.to,
        from: e.from,
        to: e.to,
        kind: e.kind || ''
      });
    });
    return out;
  }

  var VIRT_START = '__START__';
  var VIRT_END = '__END__';

  function edgeKey(from, to) {
    return JSON.stringify([from, to]);
  }

  /**
   * Graph 的 hop 权重：无论收起都按它自己主路的 hop 计；无内层则 1。
   */
  function graphHopWeight(node) {
    if (!isGraphNode(node) || !node.graph) return 1;
    var inner = longestPathStartToEnd(node.graph);
    var innerHops = inner && inner.hops != null ? inner.hops : 0;
    return Math.max(1, innerHops);
  }

  function declaredCriticalPath(graph) {
    if (!graph || !Array.isArray(graph.critical_path) || !graph.critical_path.length) {
      return null;
    }
    var nodes = createKeyMap();
    (graph.nodes || []).forEach(function (node) {
      var id = nodeRef(node);
      if (id) nodes[id] = node;
    });
    var seen = createKeyMap();
    var path = [];
    var costMs = 0;
    var hops = 0;
    for (var i = 0; i < graph.critical_path.length; i++) {
      var id = graph.critical_path[i];
      var node = nodes[id];
      if (!node || seen[id]) return null;
      if (i > 0) {
        var previous = path[i - 1];
        var connected = (graph.edges || []).some(function (edge) {
          return edge && edge.kind !== 'no' && edge.from === previous && edge.to === id;
        });
        if (!connected) return null;
      }
      seen[id] = true;
      path.push(id);
      costMs += node.cost_ms || 0;
      hops += graphHopWeight(node);
    }
    return { path: path, costMs: costMs, hops: hops, prev: createKeyMap() };
  }

  /**
   * 单层主线：必须从 START 到 END 的最长 cost 路（DAG DP）。
   * - 有 START/END 边则用之；否则虚拟 START→入度0、出度0→END
   * - kind=graph 本层只用包装节点 cost_ms（不摊平子节点，避免双计）
   * - 平局 hop：叶子=1，Graph=max(1, 内层主路 hop)（与是否展开无关）
   * - skipped 默认不可达；整层无非 skipped 路时按拓扑回退
   * @returns {{ path: string[], costMs: number, hops: number, prev: object }}
   */
  function longestPathStartToEnd(graph) {
    return declaredCriticalPath(graph) || longestPathCore(graph, false);
  }

  function longestPathCore(graph, allowSkipped) {
    var empty = { path: [], costMs: 0, hops: 0, prev: createKeyMap() };
    if (!graph) return empty;

    var cost = createKeyMap();
    var skipped = createKeyMap();
    var hopOf = createKeyMap();
    var ids = [];
    (graph.nodes || []).forEach(function (n) {
      var id = nodeRef(n);
      if (!id || id === 'START' || id === 'END') return;
      ids.push(id);
      cost[id] = n.cost_ms || 0;
      skipped[id] = n.status === 'skipped';
      hopOf[id] = graphHopWeight(n);
    });
    if (!ids.length) return empty;

    var realEdges = [];
    var hasStartEdge = false;
    var hasEndEdge = false;
    (graph.edges || []).forEach(function (e) {
      if (!e || !e.from || !e.to || e.toParent || e.to_parent) return;
      if (e.from === 'START') {
        hasStartEdge = true;
        if (e.to !== 'END' && cost[e.to] != null) {
          realEdges.push({ from: VIRT_START, to: e.to });
        }
        return;
      }
      if (e.to === 'END') {
        hasEndEdge = true;
        if (e.from !== 'START' && cost[e.from] != null) {
          realEdges.push({ from: e.from, to: VIRT_END });
        }
        return;
      }
      if (cost[e.from] == null || cost[e.to] == null) return;
      realEdges.push({ from: e.from, to: e.to });
    });

    var indeg = createKeyMap();
    var outdeg = createKeyMap();
    ids.forEach(function (id) {
      indeg[id] = 0;
      outdeg[id] = 0;
    });
    realEdges.forEach(function (e) {
      if (e.from === VIRT_START || e.to === VIRT_END) return;
      indeg[e.to] += 1;
      outdeg[e.from] += 1;
    });

    if (!hasStartEdge) {
      ids.forEach(function (id) {
        if (indeg[id] === 0 && (allowSkipped || !skipped[id])) {
          realEdges.push({ from: VIRT_START, to: id });
        }
      });
    }
    if (!hasEndEdge) {
      ids.forEach(function (id) {
        if (outdeg[id] === 0 && (allowSkipped || !skipped[id])) {
          realEdges.push({ from: id, to: VIRT_END });
        }
      });
    }

    cost[VIRT_START] = 0;
    cost[VIRT_END] = 0;
    hopOf[VIRT_START] = 0;
    hopOf[VIRT_END] = 0;
    skipped[VIRT_START] = false;
    skipped[VIRT_END] = false;

    var allIds = [VIRT_START].concat(ids).concat([VIRT_END]);
    var outs = createKeyMap();
    var indegAll = createKeyMap();
    allIds.forEach(function (id) {
      outs[id] = [];
      indegAll[id] = 0;
    });
    realEdges.forEach(function (e) {
      if (outs[e.from] == null || outs[e.to] == null) return;
      outs[e.from].push(e.to);
      indegAll[e.to] += 1;
    });

    var dist = createKeyMap();
    var hops = createKeyMap();
    var prev = createKeyMap();
    allIds.forEach(function (id) {
      dist[id] = -1;
      hops[id] = -1;
      prev[id] = null;
    });
    dist[VIRT_START] = 0;
    hops[VIRT_START] = 0;

    var indegLeft = createKeyMap();
    allIds.forEach(function (id) { indegLeft[id] = indegAll[id]; });
    var queue = [];
    allIds.forEach(function (id) {
      if (indegLeft[id] === 0) queue.push(id);
    });
    var order = [];
    while (queue.length) {
      var u = queue.shift();
      order.push(u);
      (outs[u] || []).forEach(function (v) {
        indegLeft[v] -= 1;
        if (indegLeft[v] === 0) queue.push(v);
      });
    }
    if (order.length < allIds.length) {
      allIds.forEach(function (id) {
        if (order.indexOf(id) < 0) order.push(id);
      });
    }

    order.forEach(function (u) {
      if (dist[u] < 0) return;
      if (skipped[u] && !allowSkipped) return;
      (outs[u] || []).forEach(function (v) {
        if (skipped[v] && !allowSkipped) return;
        var cand = dist[u] + cost[v];
        var candHops = hops[u] + (hopOf[v] || 0);
        if (cand > dist[v] || (cand === dist[v] && candHops > hops[v])) {
          dist[v] = cand;
          hops[v] = candHops;
          prev[v] = u;
        }
      });
    });

    if (dist[VIRT_END] < 0) {
      if (!allowSkipped) return longestPathCore(graph, true);
      return empty;
    }

    var path = [];
    for (var cur = prev[VIRT_END]; cur && cur !== VIRT_START; cur = prev[cur]) {
      path.push(cur);
    }
    path.reverse();
    return {
      path: path,
      costMs: dist[VIRT_END],
      hops: hops[VIRT_END] > 0 ? hops[VIRT_END] : 0,
      prev: prev
    };
  }

  /** Remove excluded nodes before computing the next path. */
  function graphWithoutExcluded(graph, exclude) {
    exclude = exclude || createKeyMap();
    var nodes = [];
    (graph.nodes || []).forEach(function (n) {
      var id = nodeRef(n);
      if (!id || id === 'START' || id === 'END') return;
      if (exclude[id]) return;
      nodes.push(n);
    });
    var keep = createKeyMap();
    nodes.forEach(function (n) {
      keep[nodeRef(n)] = true;
    });
    var edges = [];
    (graph.edges || []).forEach(function (e) {
      if (!e || !e.from || !e.to || e.toParent || e.to_parent) return;
      if (e.kind === 'no') return;
      var fromOk =
        e.from === 'START' || e.from === 'END' || keep[e.from];
      var toOk = e.to === 'START' || e.to === 'END' || keep[e.to];
      if (!fromOk || !toOk) return;
      if (e.from === 'START' && e.to === 'END') return;
      edges.push(e);
    });
    return { nodes: nodes, edges: edges };
  }

  /**
   * 本层剥轨：剩余图上反复跑最长 cost 路 → level 1…N。
   * @returns {{ nodeLevel: object, edgeLevel: object, path: string[], costMs: number }}
   */
  function assignLayerRailLevels(graph) {
    var nodeLevel = createKeyMap();
    var edgeLevel = createKeyMap();
    var exclude = createKeyMap();
    var rootPath = [];
    var rootCost = 0;
    var level = 1;
    var guard = 0;
    var maxNodes = ((graph && graph.nodes) || []).length + 2;

    while (guard++ < maxNodes) {
      var sub = graphWithoutExcluded(graph, exclude);
      if (!sub.nodes.length) break;
      var info = level === 1
        ? longestPathStartToEnd(graph)
        : longestPathStartToEnd(sub);
      var path = info.path || [];
      if (!path.length) break;
      if (level === 1) {
        rootPath = path.slice();
        rootCost = info.costMs || 0;
      }
      var i;
      for (i = 0; i < path.length; i++) {
        nodeLevel[path[i]] = level;
        exclude[path[i]] = true;
      }
      for (i = 0; i < path.length - 1; i++) {
        edgeLevel[edgeKey(path[i], path[i + 1])] = level;
      }
      level += 1;
    }

    // 孤立残留：按已标入边来源的最小 level+1
    var changed = true;
    var spin = 0;
    while (changed && spin++ < maxNodes) {
      changed = false;
      (graph.nodes || []).forEach(function (n) {
        var id = nodeRef(n);
        if (!id || id === 'START' || id === 'END' || nodeLevel[id] != null) return;
        var best = null;
        (graph.edges || []).forEach(function (e) {
          if (!e || e.to !== id || e.toParent || e.to_parent) return;
          if (e.from === 'START') {
            best = best == null ? 1 : Math.min(best, 1);
            return;
          }
          if (nodeLevel[e.from] == null) return;
          var cand = nodeLevel[e.from] + 1;
          best = best == null ? cand : Math.min(best, cand);
        });
        if (best == null) return;
        nodeLevel[id] = best;
        changed = true;
      });
    }
    (graph.nodes || []).forEach(function (n) {
      var id = nodeRef(n);
      if (!id || id === 'START' || id === 'END') return;
      if (nodeLevel[id] == null) nodeLevel[id] = level;
    });

    return {
      nodeLevel: nodeLevel,
      edgeLevel: edgeLevel,
      path: rootPath,
      costMs: rootCost
    };
  }

  /**
   * 分层轨级：每个 Graph 独立剥 level 1…N。
   * 已展开子 Graph 无论是否在父 level 1 上，都再标自己的轨级。
   * criticalPath 仍为根级 level 1 路径（含 Graph 包装框）。
   * 边/节点写 level；main = (level===1)；不再写 critical/bypass/inactive stroke。
   */
  function annotateHierarchicalStrokes(root, expanded, visibleNodes, edges) {
    expanded = expanded || createKeyMap();
    var nodeLevelAbs = createKeyMap();
    var edgeLevelAbs = createKeyMap();
    var rootInfo = { path: [], costMs: 0 };

    function walkLayer(graph, prefix, collectRoot) {
      var peeled = assignLayerRailLevels(graph || { nodes: [], edges: [] });
      if (collectRoot) {
        rootInfo = {
          path: (peeled.path || []).map(function (localId) {
            return appendPath(prefix, localId);
          }),
          costMs: peeled.costMs || 0
        };
      }
      Object.keys(peeled.nodeLevel).forEach(function (localId) {
        var abs = appendPath(prefix, localId);
        nodeLevelAbs[abs] = peeled.nodeLevel[localId];
      });
      Object.keys(peeled.edgeLevel).forEach(function (key) {
        var parts = JSON.parse(key);
        var a = appendPath(prefix, parts[0]);
        var b = appendPath(prefix, parts[1]);
        edgeLevelAbs[edgeKey(a, b)] = peeled.edgeLevel[key];
      });
      var list = (graph && graph.nodes) || [];
      for (var j = 0; j < list.length; j++) {
        var node = list[j];
        if (!isGraphNode(node)) continue;
        var localId = nodeRef(node);
        if (!localId) continue;
        var gpath = appendPath(prefix, localId);
        if (!hasOwnKey(expanded, gpath) || !expanded[gpath]) continue;
        walkLayer(node.graph || { nodes: [], edges: [] }, gpath, false);
      }
    }

    walkLayer(root || { nodes: [], edges: [] }, '', true);

    (visibleNodes || []).forEach(function (n) {
      if (!n || !n.id) return;
      n.level = nodeLevelAbs[n.id] != null ? nodeLevelAbs[n.id] : 1;
    });

    (edges || []).forEach(function (e) {
      if (e.kind === 'no') {
        e.level = 0;
        e.main = false;
        delete e.stroke;
        return;
      }
      var key = edgeKey(e.from, e.to);
      var lv = edgeLevelAbs[key];
      if (lv == null) {
        var lf = nodeLevelAbs[e.from];
        var lt = nodeLevelAbs[e.to];
        if (lf != null && lt != null) lv = Math.max(lf, lt);
        else if (lf != null) lv = lf;
        else if (lt != null) lv = lt;
        else lv = 2;
      }
      e.level = lv;
      e.main = lv === 1;
      delete e.stroke;
    });

    return {
      criticalPath: rootInfo.path || [],
      criticalCostMs: rootInfo.costMs || 0
    };
  }

  /**
   * @param {object} root private renderer projection
   * @param {object} expanded path -> true
   * @returns {{ nodes: object[], edges: object[], criticalPath: string[], criticalCostMs: number }}
   */
  function buildVisibleGraph(root, expanded) {
    expanded = expanded || createKeyMap();
    var nodes = [];
    var rawEdges = [];

    function walk(graph, prefix, parentId) {
      if (!graph) return;
      var idOf = createKeyMap();

      (graph.nodes || []).forEach(function (n) {
        var localId = nodeRef(n);
        if (!localId) return;
        var path = appendPath(prefix, localId);
        idOf[localId] = path;

        var isSub = isGraphNode(n);
        if (isSub && hasOwnKey(expanded, path) && expanded[path]) {
          nodes.push({
            id: path,
            key: n.original_id || localId,
            name: n.name || n.original_id || localId,
            parent: parentId || null,
            kind: n.kind || 'graph',
            component: n.component || '',
            metadata: n.metadata || null,
            status: n.status || 'success',
            cost_ms: n.cost_ms || 0,
            metrics: n.metrics || null,
            err_msg: n.err_msg || '',
            expandable: true,
            subgraph: true,
            expanded: true
          });
          // 空 / 缺省 graph = 合法空子图
          walk(n.graph || { nodes: [], edges: [] }, path, path);
        } else {
          nodes.push({
            id: path,
            key: n.original_id || localId,
            name: n.name || n.original_id || localId,
            parent: parentId || null,
            kind: n.kind || (isSub ? 'graph' : 'io'),
            component: n.component || '',
            metadata: n.metadata || null,
            status: n.status || 'success',
            cost_ms: n.cost_ms || 0,
            metrics: n.metrics || null,
            err_msg: n.err_msg || '',
            expandable: isSub,
            subgraph: isSub,
            expanded: false
          });
        }
      });

      (graph.edges || []).forEach(function (e) {
        if (!e) return;
        if (e.toParent || e.to_parent) return;
        var from = e.from;
        var to = e.to;
        if (!from || !to) return;
        if (from === 'START' || to === 'END' || (from === 'START' && to === 'END')) return;

        var fromPath = idOf[from];
        var toPath = idOf[to];
        // 仅同层：两端必须是本层节点 id（可为 kind=graph 包装节点）
        if (!fromPath || !toPath) return;

        rawEdges.push({
          from: fromPath,
          to: toPath,
          kind: e.kind || ''
        });
      });
    }

    walk(root, '', null);
    var edges = materializeEdges(rawEdges, nodes);

    var pathInfo = annotateHierarchicalStrokes(root, expanded, nodes, edges);
    return {
      nodes: nodes,
      edges: edges,
      criticalPath: pathInfo.criticalPath,
      criticalCostMs: pathInfo.criticalCostMs
    };
  }

  /**
   * 首次渲染默认展开：主路上的子 Graph 展开；skipped / 旁路收起。
   * Uses the critical path computed with all subgraphs collapsed.
   */
  function defaultExpandedMap(root) {
    var next = createKeyMap();
    if (!root) return toPlainRecord(next);
    var collapsed = buildVisibleGraph(root, createKeyMap());
    var critical = createKeyMap();
    (collapsed.criticalPath || []).forEach(function (id) {
      critical[id] = true;
    });
    listSubgraphs(root, '', []).forEach(function (s) {
      if (!s || !s.path || !s.node) return;
      if (s.node.status === 'skipped') return;
      if (critical[s.path]) next[s.path] = true;
    });
    return toPlainRecord(next);
  }

  global.WorkflowDAGModel = {
    buildVisibleGraph: buildVisibleGraph,
    defaultExpandedMap: defaultExpandedMap,
    listSubgraphs: function (root) { return listSubgraphs(root, '', []); },
    isGraphNode: isGraphNode,
    nodeRef: nodeRef
  };
})(runtime);

export const EinoWorkflowDAGModel = runtime.WorkflowDAGModel;
export const buildVisibleGraph = EinoWorkflowDAGModel.buildVisibleGraph;
export const defaultExpandedMap = EinoWorkflowDAGModel.defaultExpandedMap;
export const listSubgraphs = EinoWorkflowDAGModel.listSubgraphs;
export const isGraphNode = EinoWorkflowDAGModel.isGraphNode;
export const nodeRef = EinoWorkflowDAGModel.nodeRef;
