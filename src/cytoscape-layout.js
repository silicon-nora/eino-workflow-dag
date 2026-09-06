import { axisProfile } from "./axis-profile.js";
import { createKeyMap } from "./key-map.js";
import { normalizeLayoutEngine } from "./layout-engine.js";

let WorkflowDAGRules = null;
let WorkflowDAGLayoutEngine = normalizeLayoutEngine();

  /* ---------- Cytoscape layout adapter ---------- */

  function assign(tgt) {
    for (var i = 1; i < arguments.length; i++) {
      var src = arguments[i] || {};
      Object.keys(src).forEach(function (k) {
        tgt[k] = src[k];
      });
    }
    return tgt;
  }

  var getPos = function getPos(ele, options) {
    var dims = ele.layoutDimensions(options);
    var parent = ele.parent();
    var k = ele.scratch("einoWorkflowDAG");
    var p = { x: k.x, y: k.y };
    while (parent.nonempty()) {
      var kp = parent.scratch("einoWorkflowDAG");
      p.x += kp.x || 0;
      p.y += kp.y || 0;
      parent = parent.parent();
    }
    p.x += dims.w / 2;
    p.y += dims.h / 2;
    return p;
  };

  var makeNode = function makeNode(node, options) {
    var k = { _cyEle: node, id: node.id() };
    if (options.nodeLayoutOptions) {
      k.layoutOptions = options.nodeLayoutOptions(node);
    }
    if (!node.isParent()) {
      var dims = node.layoutDimensions(options);
      var p = node.position();
      k.x = p.x - dims.w / 2;
      k.y = p.y - dims.h / 2;
      k.width = dims.w;
      k.height = dims.h;
    }
    node.scratch("einoWorkflowDAG", k);
    return k;
  };

  var makeEdge = function makeEdge(edge, options) {
    var k = {
      _cyEle: edge,
      id: edge.id(),
      source: edge.data("source"),
      target: edge.data("target"),
    };
    if (options && typeof options.edgeLayoutOptions === "function") {
      var edgeOpts = options.edgeLayoutOptions(edge);
      if (edgeOpts) k.layoutOptions = edgeOpts;
    } else {
      var fromData = edge.data("layoutOptions");
      if (fromData) k.layoutOptions = fromData;
    }
    edge.scratch("einoWorkflowDAG", k);
    return k;
  };

  /** Keep same-parent edges in their compound for nested-layer ordering. */
  var makeGraph = function makeGraph(nodes, edges, options) {
    var layoutNodes = [];
    var layoutEdges = [];
    var elementLookup = createKeyMap();
    var graph = { id: "root", children: [], edges: [] };
    var i;
    for (i = 0; i < nodes.length; i++) {
      var nk = makeNode(nodes[i], options);
      layoutNodes.push(nk);
      elementLookup[nodes[i].id()] = nk;
    }
    for (i = 0; i < edges.length; i++) {
      var ek = makeEdge(edges[i], options);
      layoutEdges.push(ek);
      elementLookup[edges[i].id()] = ek;
    }
    for (i = 0; i < layoutNodes.length; i++) {
      var k = layoutNodes[i];
      var n = k._cyEle;
      if (!n.isChild()) graph.children.push(k);
      else {
        var parentK = elementLookup[n.parent().id()];
        parentK.children = parentK.children || [];
        parentK.children.push(k);
      }
    }
    for (i = 0; i < layoutEdges.length; i++) {
      var eK = layoutEdges[i];
      var eCy = eK._cyEle;
      var parentSrc = eCy.source().parent();
      var parentTgt = eCy.target().parent();
      if (
        parentSrc.nonempty() &&
        parentTgt.nonempty() &&
        parentSrc.same(parentTgt)
      ) {
        var pk = elementLookup[parentSrc.id()];
        pk.edges = pk.edges || [];
        pk.edges.push(eK);
      } else {
        graph.edges.push(eK);
      }
    }
    graph._elementLookup = elementLookup;
    return graph;
  };

  var fmtEndpoint = function fmtEndpoint(dx, dy) {
    return dx.toFixed(2) + "px " + dy.toFixed(2) + "px";
  };

  var projectOntoLine = function projectOntoLine(a, b, p) {
    var dx = b.x - a.x;
    var dy = b.y - a.y;
    var len2 = dx * dx + dy * dy;
    if (len2 < 0.001) return { w: 0.5, d: 0 };
    var w = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
    var cross = dx * (p.y - a.y) - dy * (p.x - a.x);
    return { w: w, d: cross / Math.sqrt(len2) };
  };

  /** Apply absolute orthogonal route points as Cytoscape segments. */
  var applyAbsRouteToCy = function applyAbsRouteToCy(
    edge,
    absPoints,
    sourceCenter,
    targetCenter,
  ) {
    var rules = WorkflowDAGRules;
    var points = absPoints;
    if (rules && typeof rules.simplifyOrthogonalPoints === "function") {
      points = rules.simplifyOrthogonalPoints(absPoints);
    }
    if (!points || points.length < 2) return;
    var startPoint = points[0];
    var endPoint = points[points.length - 1];
    var bends = points.slice(1, points.length - 1);
    var sourceEndpoint = fmtEndpoint(
      startPoint.x - sourceCenter.x,
      startPoint.y - sourceCenter.y,
    );
    var targetEndpoint = fmtEndpoint(
      endPoint.x - targetCenter.x,
      endPoint.y - targetCenter.y,
    );
    if (bends.length === 0) {
      edge.style({
        "curve-style": "segments",
        "source-endpoint": sourceEndpoint,
        "target-endpoint": targetEndpoint,
        "edge-distances": "endpoints",
        "segment-weights": "0.5",
        "segment-distances": "0",
      });
      return;
    }
    var segmentWeights = [];
    var segmentDistances = [];
    for (var i = 0; i < bends.length; i++) {
      var proj = projectOntoLine(startPoint, endPoint, bends[i]);
      segmentWeights.push(Number(proj.w.toFixed(6)));
      segmentDistances.push(
        Number((Math.abs(proj.d) < 0.05 ? 0 : proj.d).toFixed(3)),
      );
    }
    edge.style({
      "curve-style": "segments",
      "source-endpoint": sourceEndpoint,
      "target-endpoint": targetEndpoint,
      "edge-distances": "endpoints",
      "segment-weights": segmentWeights.join(" "),
      "segment-distances": segmentDistances.join(" "),
    });
  };

  var applyPositionsToGraph = function applyPositionsToGraph(graph, absPos) {
    var origin = { x: 0, y: 0 };
    var walk = function (node, parentAbs) {
      var abs = absPos && absPos[node.id];
      if (abs) {
        node.width = abs.width;
        node.height = abs.height;
        node.x = abs.x - parentAbs.x;
        node.y = abs.y - parentAbs.y;
      }
      var kids = node.children || [];
      var selfAbs = abs || parentAbs;
      for (var i = 0; i < kids.length; i++) walk(kids[i], selfAbs);
    };
    var children = (graph && graph.children) || [];
    for (var c = 0; c < children.length; c++) walk(children[c], origin);
  };

  var WorkflowDAGCytoscapeLayout = function WorkflowDAGCytoscapeLayout(options) {
    var cy = options.cy;
    this.options = assign(
      {},
      {
        nodeDimensionsIncludeLabels: false,
        fit: true,
        padding: 20,
        animate: false,
        animateFilter: function () {
          return true;
        },
        animationDuration: 500,
        transform: function (node, pos) {
          return pos;
        },
        ready: undefined,
        stop: undefined,
        nodeLayoutOptions: undefined,
        edgeLayoutOptions: undefined,
        layoutConfig: {},
        visibleGraph: undefined,
      },
      options,
    );
    this.options.layoutConfig = assign(
      {
        aspectRatio: cy.width() / cy.height(),
      },
      this.options.layoutConfig,
    );
  };

  WorkflowDAGCytoscapeLayout.prototype.run = function run() {
    var layout = this;
    var options = this.options;
    var eles = options.eles;
    var nodes = eles.nodes();
    var edges = eles.edges();
    var engine = WorkflowDAGLayoutEngine;
    var rules = WorkflowDAGRules;
    if (!rules) throw new Error("WorkflowDAGRules are unavailable");
    var visible = options.visibleGraph;
    if (!visible) throw new Error("visibleGraph is required");

    var profileFromOpts =
      options.axisProfile ||
      axisProfile(options.layoutConfig && options.layoutConfig.direction);

    var laid = engine.layout(visible, {
      direction: profileFromOpts.direction,
    });
    var graph = makeGraph(nodes, edges, options);
    graph.layoutOptions = options.layoutConfig;
    graph._axisProfile = profileFromOpts;
    applyPositionsToGraph(graph, laid.positions);

    if (typeof rules.onGraphBuilt === "function") {
      rules.onGraphBuilt(graph);
    }
    if (typeof rules.afterPass2 === "function") {
      rules.afterPass2(graph);
    }

    // 先落叶子坐标，compound 才会按子节点+padding 算出真正的 position()
    nodes
      .filter(function (n) {
        return !n.isParent();
      })
      .layoutPositions(layout, options, function (n) {
        return getPos(n, options);
      });

    /**
     * 边 endpoint 相对 Cy 当前 position()（展开 Graph 是子节点包围盒中心）。
     * 必须在 layoutPositions 之后取——包围盒中心与 Cy compound 中心
     * 差几像素时，水平直线会被画成正交折线。
     */
    var lookup = graph._elementLookup || {};
    edges.forEach(function (edge) {
      var layoutEdge = lookup[edge.id()];
      if (!layoutEdge) return;
      var abs = layoutEdge._flowAbsRoute;
      if (!abs || abs.length < 2) return;
      applyAbsRouteToCy(
        edge,
        abs,
        edge.source().position(),
        edge.target().position(),
      );
    });

    return this;
  };

  WorkflowDAGCytoscapeLayout.prototype.stop = function stop() {
    return this;
  };
  WorkflowDAGCytoscapeLayout.prototype.destroy = function destroy() {
    return this;
  };

  export function registerWorkflowDAGLayout(cytoscape, rules, layoutEngine) {
    if (!cytoscape) return;
    WorkflowDAGRules = rules;
    WorkflowDAGLayoutEngine = normalizeLayoutEngine(layoutEngine);
    cytoscape("layout", "eino-workflow-dag", WorkflowDAGCytoscapeLayout);
  }
