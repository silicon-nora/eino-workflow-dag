import cytoscape from "cytoscape";
import { EinoWorkflowDAGModel } from "./model.js";
import { registerWorkflowDAGLayout } from "./cytoscape-layout.js";
import { createSubgraphOverlay } from "./overlay.js";
import { createNodeTooltip } from "./tooltip.js";
import { observeElementResize } from "./resize-observer.js";
import {
  formatDuration,
  patchCytoscapeElements,
  syncCytoscapeElements,
  toCytoscapeElements,
} from "./elements.js";
import { bindGraphInteractions } from "./interaction.js";
import { createViewportController } from "./viewport.js";
import { createEdgeStateController } from "./edge-state.js";
import {
  axisProfile,
  defaultAxisProfile,
  normalizeDirection,
} from "./axis-profile.js";
import {
  GRAPH_COMPOUND_PAD,
  WorkflowDAGRules,
} from "./routing.js";
import { createAccessibilityPresenter } from "./accessibility.js";
import {
  captureCytoscapeLayout,
  createLayoutCache,
  layoutCacheKey,
  restoreCytoscapeLayout,
} from "./layout-cache.js";
import { resolveLocale } from "./locale.js";
import { exportWorkflowDAGSVG } from "./svg-export.js";
import { createKeyMap, hasOwnKey, toPlainRecord } from "./key-map.js";
import { parseWorkflowSnapshot } from "./validation.js";
import {
  decodeNodePath,
  encodeNodePath,
  normalizeDAGSnapshot,
} from "./snapshot.js";
import { WorkflowDAGError } from "./workflow-error.js";
import { attachCytoscapeAccess } from "./cytoscape-access.js";
import {
  normalizeTheme,
  stylesheet,
  themeTokens,
} from "./theme.js";

/* ---------- Cytoscape mount / 样式 / 交互 ---------- */

  // Cytoscape compound nodes only support uniform padding. Use the top value
  // so the title overlay has five extra pixels of breathing room.
  var COMPOUND_PAD = GRAPH_COMPOUND_PAD;
  // Root graph spacing. Leaf nodes remain 220×64.
  // betweenLayers controls main-axis spacing; nodeNode controls cross-axis spacing.
  var SPACE_ROOT = {
    nodeNode: 56,
    // Edge-to-node clearance also controls the outer detour channel.
    edgeNode: 44,
    edgeEdge: 28,
    portPort: 20,
    betweenLayers: 48,
    edgeNodeBetweenLayers: 44,
    edgeEdgeBetweenLayers: 28,
    fitPadding: 28,
  };
  var SPACE_COMPOUND = {
    nodeNode: 64,
    edgeNode: 52,
    edgeEdge: 30,
    portPort: 22,
    betweenLayers: 56,
    edgeNodeBetweenLayers: 52,
    edgeEdgeBetweenLayers: 28,
  };

  function ensureWorkflowLayoutRegistered() {
    var cytoLib = cytoscape;
    if (!cytoLib) throw new Error("Cytoscape is unavailable");
    try {
      registerWorkflowDAGLayout(cytoLib, WorkflowDAGRules);
    } catch (e) {
      /* 可能已注册 */
    }
  }

  function sameExpandedMap(left, right) {
    var leftKeys = Object.keys(left || {});
    var rightKeys = Object.keys(right || {});
    if (leftKeys.length !== rightKeys.length) return false;
    return leftKeys.every(function (key) {
      return hasOwnKey(right, key) && left[key] === right[key];
    });
  }

  function normalizeExpandedMap(source) {
    var normalized = createKeyMap();
    if (!source || typeof source !== "object") return normalized;
    Object.keys(source).forEach(function (path) {
      if (source[path]) normalized[path] = true;
    });
    return normalized;
  }

  function normalizeNodePath(value, name) {
    if (!Array.isArray(value) || !value.length || value.some(function (id) {
      return typeof id !== "string" || !id;
    })) {
      throw new TypeError(name + " must be a non-empty array of node IDs");
    }
    return value.slice();
  }

  function expandedPathsToMap(source) {
    var normalized = createKeyMap();
    if (!Array.isArray(source)) {
      throw new TypeError("expanded must be an array of node paths");
    }
    source.forEach(function (path) {
      normalized[encodeNodePath(normalizeNodePath(path, "expanded path"))] = true;
    });
    return normalized;
  }

  function expandedMapToPaths(source) {
    return Object.keys(source || {}).filter(function (path) {
      return source[path];
    }).map(decodeNodePath);
  }

  function normalizeActiveNodePath(value) {
    if (value == null) return null;
    return encodeNodePath(normalizeNodePath(value, "activeNodePath"));
  }

  function publicNodeData(node) {
    return {
      path: decodeNodePath(node.id),
      id: node.key,
      label: node.label || "",
      name: node.title || node.key,
      kind: node.kind || "",
      component: node.component || "",
      metadata: node.metadata || null,
      status: node.status || "",
      durationMs: node.cost_ms || 0,
      metrics: node.metrics || null,
      errorMessage: node.err_msg || "",
      expandable: !!node.expandable,
      subgraph: !!node.subgraph,
      expanded: !!node.expanded,
      ...(node.parent ? { parentPath: decodeNodePath(node.parent) } : {}),
    };
  }

  function edgeChannels(kind) {
    if (!kind || kind === "no") return [];
    return kind.split("+").filter(function (channel) {
      return channel === "control" || channel === "data" || channel === "branch";
    });
  }

  function publicEdgeData(edge) {
    return {
      id: edge.id,
      source: decodeNodePath(edge.source),
      target: decodeNodePath(edge.target),
      channels: edgeChannels(edge.kind),
      level: Number(edge.level) || 0,
      main: !!edge.main,
    };
  }

  function publicVisibleGraph(visible) {
    return {
      nodes: visible.nodes.map(function (node) {
        return publicNodeData({
          ...node,
          title: node.name,
          key: node.key,
          label: "",
          parent: node.parent,
        });
      }),
      edges: visible.edges.map(function (edge) {
        return publicEdgeData({ ...edge, source: edge.from, target: edge.to });
      }),
      highlightedPath: visible.criticalPath.map(function (id) {
        return decodeNodePath(id);
      }),
      highlightedDurationMs: visible.criticalCostMs,
    };
  }

  function listPublicSubgraphs(snapshot) {
    var result = [];
    var pending = [{ graph: snapshot.workflow, prefix: [] }];
    while (pending.length) {
      var current = pending.pop();
      var graph = current.graph;
      var prefix = current.prefix;
      graph.nodes.forEach(function (node) {
        var path = prefix.concat(node.id);
        if (node.workflow !== undefined && node.workflow !== null) {
          result.push({ path: path, name: node.name || node.id, node: node });
          pending.push({ graph: node.workflow, prefix: path });
        }
      });
    }
    return result;
  }

  function sameRecord(left, right) {
    var leftKeys = Object.keys(left || {});
    var rightKeys = Object.keys(right || {});
    if (leftKeys.length !== rightKeys.length) return false;
    return leftKeys.every(function (key) {
      return hasOwnKey(right, key) && left[key] === right[key];
    });
  }

  function sameLocale(left, right) {
    return (
      left.collapseSubgraphTitle === right.collapseSubgraphTitle &&
      sameRecord(left.kinds, right.kinds) &&
      sameRecord(left.statuses, right.statuses) &&
      sameRecord(left.tooltip, right.tooltip)
    );
  }

  /** Theme-driven styles; see THEMES for the built-in visual systems. */

  /**
   * @param {object} [profile] AxisProfile（含 direction）；缺省 RIGHT
   * @param {object} [visible] WorkflowDAGModel.buildVisibleGraph 结果
   */
  function workflowLayoutOptions(profile, visible, fit) {
    var sr = SPACE_ROOT;
    var sc = SPACE_COMPOUND;
    var p = profile || defaultAxisProfile();
    var dir = p.direction;
    return {
      // 递归 layoutLayer 排点 + 流程线计算画边
      name: "eino-workflow-dag",
      animate: false,
      fit: fit !== false,
      padding: sr.fitPadding,
      nodeDimensionsIncludeLabels: true,
      axisProfile: p,
      visibleGraph: visible,
      // Nested graph spacing; top padding reserves room for the title overlay.
      nodeLayoutOptions: function (node) {
        if (!node.isParent()) return undefined;
        var pad = COMPOUND_PAD;
        return {
          direction: dir,
          padding: Object.assign({}, pad),
          spacing: Object.assign({}, sc),
        };
      },
      layoutConfig: {
        direction: dir,
        padding: { top: 8, right: 8, bottom: 8, left: 8 },
        spacing: Object.assign({}, sr),
      },
    };
  }

  /**
   * @param {HTMLElement} container
   * @param {{ snapshot: object, direction?: 'RIGHT'|'LEFT'|'DOWN'|'UP', onExpandedChange?: Function, onError?: Function }} options
   */
export function mountRenderer(container, options) {
    ensureWorkflowLayoutRegistered();
    var Model = EinoWorkflowDAGModel;
    if (!Model) throw new Error("EinoWorkflowDAGModel is unavailable");
    if (!container) throw new Error("A container element is required");
    if (!options) throw new TypeError("options are required");
    parseWorkflowSnapshot(options.snapshot);

    var publicSnapshot = options.snapshot;
    var normalizedSnapshot = normalizeDAGSnapshot(publicSnapshot);
    var root = normalizedSnapshot.root;
    var profile = axisProfile(normalizeDirection(options.direction));
    var themeId = normalizeTheme(options.theme);
    var activeNodeKey = normalizeActiveNodePath(options.activeNodePath);
    var expanded = options.expanded
      ? expandedPathsToMap(options.expanded)
      : Model.defaultExpandedMap
        ? normalizeExpandedMap(Model.defaultExpandedMap(root))
        : createKeyMap();

    function assertExpandablePaths(next) {
      var available = createKeyMap();
      Model.listSubgraphs(root).forEach(function (subgraph) {
        available[subgraph.path] = true;
      });
      Object.keys(next).forEach(function (path) {
        if (!available[path]) {
          throw new RangeError(
            "Unknown expandable workflow path " + JSON.stringify(decodeNodePath(path)),
          );
        }
      });
    }

    assertExpandablePaths(expanded);

    var hostElement = container.parentElement;
    var addedHostClass = false;
    var hadHostTheme = false;
    var previousHostTheme = null;
    var previousContainerBackground = {
      value: container.style.getPropertyValue("background"),
      priority: container.style.getPropertyPriority("background"),
    };
    var hostStyleProperties = [
      "--eino-workflow-dag-title-bg",
      "--eino-workflow-dag-title-color",
      "--eino-workflow-dag-title-hover-bg",
      "--eino-workflow-dag-title-hover-border",
      "--eino-workflow-dag-title-font",
    ];
    var previousHostStyles = createKeyMap();
    if (hostElement && hostElement.classList) {
      addedHostClass = !hostElement.classList.contains("eino-workflow-dag-host");
      hostElement.classList.add("eino-workflow-dag-host");
      hadHostTheme = hostElement.hasAttribute("data-theme");
      previousHostTheme = hostElement.getAttribute("data-theme");
      hostStyleProperties.forEach(function (property) {
        previousHostStyles[property] = {
          value: hostElement.style.getPropertyValue(property),
          priority: hostElement.style.getPropertyPriority(property),
        };
      });
    }

    var ZOOM_STEP = 1.2;
    var MIN_ZOOM = 0.45;
    var MAX_ZOOM = 2.0;
    var FIT_PADDING = 28;

    var cy = null;
    var locale = resolveLocale(options.locale);
    var overlay = createSubgraphOverlay(container, toggleEncodedPath, {
      collapseSubgraphTitle: locale.collapseSubgraphTitle,
    });
    var listeners = {
      onExpandedChange:
        typeof options.onExpandedChange === "function"
          ? options.onExpandedChange
          : function () {},
      onNodeClick:
        typeof options.onNodeClick === "function"
          ? options.onNodeClick
          : function () {},
      onEdgeClick:
        typeof options.onEdgeClick === "function"
          ? options.onEdgeClick
          : function () {},
      onError:
        typeof options.onError === "function"
          ? options.onError
          : function () {},
    };
    var resizeObserver = null;
    var interaction = null;
    var activeLayout = null;
    var layoutGeneration = 0;
    var destroyed = false;
    var additionalStyles = Array.isArray(options.additionalStyles)
      ? options.additionalStyles.slice()
      : [];
    var accessibility = createAccessibilityPresenter(container, {
      ariaLabel: options.ariaLabel,
      labelFormatter:
        typeof options.accessibilityLabelFormatter === "function"
          ? function (summary, visible) {
              return options.accessibilityLabelFormatter(
                summary,
                publicVisibleGraph(visible),
              );
            }
          : null,
    });
    var layoutCache = createLayoutCache(options.layoutCacheSize);
    var diagnostics = {
      dataPatches: 0,
      topologySyncs: 0,
      layoutRuns: 0,
      layoutCacheHits: 0,
    };

    function assertActive() {
      if (destroyed) {
        throw new Error("Cannot use a destroyed workflow DAG");
      }
    }

    function reportError(error) {
      var normalized = error instanceof WorkflowDAGError
        ? error
        : new WorkflowDAGError(
            "RENDERER_RECOVERED",
            error instanceof Error ? error.message : String(error),
            { recoverable: true, cause: error },
          );
      try {
        listeners.onError(normalized);
      } catch (listenerError) {
        if (options.debug && typeof console !== "undefined" && console.error) {
          console.error(
            "[eino-workflow-dag] onError callback failed",
            listenerError,
          );
        }
      }
      if (options.debug && typeof console !== "undefined" && console.error) {
        console.error("[eino-workflow-dag] renderer recovered from an error", normalized);
      }
    }

    function graphStylesheet() {
      return stylesheet(themeId).concat(additionalStyles);
    }

    /** 画布底色 + .cy-wrap data-theme / overlay CSS 变量（不触碰 cy layout） */
    function applyThemeChrome(id) {
      var tid = normalizeTheme(id);
      var tokens = themeTokens(tid);
      container.style.background = tokens.canvas.bg;
      var wrap = hostElement;
      if (wrap && wrap.classList) {
        wrap.setAttribute("data-theme", tid);
        wrap.style.setProperty("--eino-workflow-dag-title-bg", tokens.overlay.titleBg);
        wrap.style.setProperty("--eino-workflow-dag-title-color", tokens.overlay.titleColor);
        wrap.style.setProperty(
          "--eino-workflow-dag-title-hover-bg",
          tokens.overlay.titleHoverBg,
        );
        wrap.style.setProperty(
          "--eino-workflow-dag-title-hover-border",
          tokens.overlay.titleHoverBorder,
        );
        if (tokens.overlay.titleFont) {
          wrap.style.setProperty(
            "--eino-workflow-dag-title-font",
            tokens.overlay.titleFont,
          );
        } else {
          wrap.style.removeProperty("--eino-workflow-dag-title-font");
        }
      }
    }

    function getTheme() {
      return themeId;
    }

    function setTheme(next) {
      assertActive();
      next = normalizeTheme(next);
      if (next === themeId) return;
      themeId = next;
      if (cy) {
        // 只换 stylesheet，保留边 segments / layout / expanded
        cy.style(graphStylesheet());
      }
      applyThemeChrome(themeId);
      viewport.sync();
    }

    function getLocale() {
      return {
        kinds: toPlainRecord(locale.kinds),
        statuses: toPlainRecord(locale.statuses),
        tooltip: toPlainRecord(locale.tooltip),
        collapseSubgraphTitle: locale.collapseSubgraphTitle,
      };
    }

    function setLocale(next) {
      assertActive();
      var resolved = resolveLocale(next);
      if (sameLocale(locale, resolved)) return;
      locale = resolved;
      overlay.setCollapseSubgraphTitle(locale.collapseSubgraphTitle);
      tooltip.setLocale(locale);
      render({ fit: false, patchData: true });
    }

    function setDirection(next) {
      assertActive();
      var nextProfile = axisProfile(normalizeDirection(next));
      if (nextProfile.direction === profile.direction) return;
      profile = nextProfile;
      render();
    }

    function getExpanded() {
      return expandedMapToPaths(expanded);
    }

    function setExpanded(next) {
      assertActive();
      var normalized = expandedPathsToMap(next);
      assertExpandablePaths(normalized);
      if (sameExpandedMap(expanded, normalized)) return;
      expanded = normalized;
      listeners.onExpandedChange(getExpanded());
      render();
    }

    function resolveActiveNode() {
      if (!cy || !activeNodeKey) return null;
      var exact = cy.getElementById(activeNodeKey);
      if (exact && exact.length === 1 && exact.isNode()) return exact;
      return null;
    }

    function syncActiveNode() {
      if (!cy) return;
      cy.nodes(".active-node").removeClass("active-node");
      var active = resolveActiveNode();
      if (active) active.addClass("active-node");
    }

    function getActiveNodePath() {
      return activeNodeKey ? decodeNodePath(activeNodeKey) : null;
    }

    function setActiveNodePath(next) {
      assertActive();
      next = normalizeActiveNodePath(next);
      if (next === activeNodeKey) return;
      activeNodeKey = next;
      syncActiveNode();
    }

    /** Replace runtime DAG data while keeping the current interaction state. */
    function update(nextPublicSnapshot, updateOptions) {
      assertActive();
      parseWorkflowSnapshot(nextPublicSnapshot);
      var nextSnapshot = normalizeDAGSnapshot(nextPublicSnapshot);
      var nextRoot = nextSnapshot.root;

      var previousExpanded = expanded;
      var keepExpanded = !updateOptions || updateOptions.preserveExpanded !== false;
      if (keepExpanded) {
        var available = createKeyMap();
        Model.listSubgraphs(nextRoot).forEach(function (subgraph) {
          available[subgraph.path] = true;
        });
        var nextExpanded = createKeyMap();
        Object.keys(expanded).forEach(function (path) {
          if (expanded[path] && available[path]) nextExpanded[path] = true;
        });
        expanded = nextExpanded;
      } else {
        expanded = Model.defaultExpandedMap
          ? Model.defaultExpandedMap(nextRoot)
          : createKeyMap();
      }

      root = nextRoot;
      publicSnapshot = nextPublicSnapshot;
      var canPatchRuntime =
        normalizedSnapshot.layoutKey === nextSnapshot.layoutKey;
      normalizedSnapshot = nextSnapshot;
      if (!sameExpandedMap(previousExpanded, expanded)) {
        listeners.onExpandedChange(getExpanded());
      }
      render({
        fit: !!(updateOptions && updateOptions.fit),
        patchData: canPatchRuntime,
      });
    }

    function toggleEncodedPath(path) {
      var next = createKeyMap();
      Object.keys(expanded).forEach(function (k) {
        next[k] = expanded[k];
      });
      if (next[path]) delete next[path];
      else next[path] = true;
      if (sameExpandedMap(expanded, next)) return;
      expanded = next;
      listeners.onExpandedChange(getExpanded());
      render();
    }

    function toggle(path) {
      assertActive();
      var encoded = encodeNodePath(normalizeNodePath(path, "node path"));
      var candidate = createKeyMap();
      candidate[encoded] = true;
      assertExpandablePaths(candidate);
      toggleEncodedPath(encoded);
    }

    function expandAll() {
      var next = createKeyMap();
      Model.listSubgraphs(root).forEach(function (s) {
        next[s.path] = true;
      });
      if (sameExpandedMap(expanded, next)) return;
      expanded = next;
      listeners.onExpandedChange(getExpanded());
      render();
    }

    function collapseAll() {
      setExpanded([]);
    }

    function clearOverlays() {
      overlay.clear();
    }

    var tooltip = createNodeTooltip(container, {
      formatDuration: formatDuration,
      formatter:
        typeof options.tooltipFormatter === "function"
          ? function (node) {
              return options.tooltipFormatter(publicNodeData({
                ...node,
                key: node.key || decodeNodePath(node.id).at(-1) || "",
                label: "",
                title: node.title,
              }));
            }
          : null,
      pinning: options.pinNodeTip !== false,
      locale: locale,
    });
    var viewport = createViewportController(container, {
      getCy: function () { return cy; },
      overlay: overlay,
      tooltip: tooltip,
      minZoom: MIN_ZOOM,
      maxZoom: MAX_ZOOM,
      fitPadding: FIT_PADDING,
      zoomStep: ZOOM_STEP,
    });
    var edgeState = createEdgeStateController(function () { return cy; });

    function runLayout(visible, fit, cacheKey) {
      layoutGeneration += 1;
      var generation = layoutGeneration;
      if (activeLayout && typeof activeLayout.stop === "function") {
        activeLayout.stop();
      }
      // 清掉上次边几何 bypass，避免叠样式
      cy.edges().removeStyle();
      clearOverlays();
      var cached = layoutCache.get(cacheKey);
      if (cached && restoreCytoscapeLayout(cy, cached)) {
        diagnostics.layoutCacheHits += 1;
        edgeState.refresh();
        if (fit) cy.fit(undefined, FIT_PADDING);
        viewport.afterViewSettled();
        return;
      }
      diagnostics.layoutRuns += 1;
      var layout = cy.layout(workflowLayoutOptions(profile, visible, fit));
      activeLayout = layout;
      layout.one("layoutstop", function () {
        if (destroyed || generation !== layoutGeneration || !cy) return;
        activeLayout = null;
        layoutCache.set(cacheKey, captureCytoscapeLayout(cy));
        edgeState.refresh();
        viewport.afterViewSettled();
        if (options.debug && typeof console !== "undefined" && console.debug) {
          console.debug(
            "[eino-workflow-dag] layoutstop nodes/edges",
            cy.nodes().length,
            cy.edges().length,
          );
        }
      });
      try {
        layout.run();
      } catch (err) {
        if (generation !== layoutGeneration || destroyed || !cy) return;
        activeLayout = null;
        reportError(err);
        cy.layout({ name: "grid", fit: true, padding: 24 }).run();
        viewport.afterViewSettled();
      }
    }

    function render(renderOptions) {
      assertActive();
      var visible = Model.buildVisibleGraph(root, expanded);
      var elements = toCytoscapeElements(visible, {
        locale: locale,
        nodeLabelFormatter:
          typeof options.nodeLabelFormatter === "function"
            ? options.nodeLabelFormatter
            : null,
      });
      if (
        cy &&
        renderOptions &&
        renderOptions.patchData &&
        additionalStyles.length === 0 &&
        patchCytoscapeElements(cy, elements)
      ) {
        diagnostics.dataPatches += 1;
        accessibility.update(visible);
        edgeState.refresh();
        syncActiveNode();
        if (renderOptions.fit) cy.fit(undefined, FIT_PADDING);
        viewport.afterViewSettled();
        tooltip.refresh(cy);
        if (interaction) interaction.refreshKeyboardFocus();
        return visible;
      }
      accessibility.update(visible);
      if (options.debug && typeof console !== "undefined" && console.debug) {
        console.debug(
          "[eino-workflow-dag] elements nodes/edges",
          elements.filter(function (e) {
            return e.group === "nodes";
          }).length,
          elements.filter(function (e) {
            return e.group === "edges";
          }).length,
        );
      }
      if (!cy) {
        cy = cytoscape({
          container: container,
          elements: elements,
          style: graphStylesheet(),
          layout: { name: "null" },
          autoungrabify: true,
          autounselectify: true,
          boxSelectionEnabled: false,
          // Bare wheel events scroll the page; Ctrl+wheel zoom is bound by viewport.
          userZoomingEnabled: false,
          userPanningEnabled: true,
          minZoom: MIN_ZOOM,
          maxZoom: MAX_ZOOM,
        });
        interaction = bindGraphInteractions(cy, container, {
          clearEdgeHighlight: edgeState.clear,
          onEdgeClick: function (edge) {
            listeners.onEdgeClick(publicEdgeData(edge));
          },
          onKeyboardFocus: accessibility.focusNode,
          onNodeClick: function (node) {
            listeners.onNodeClick(publicNodeData(node));
          },
          onViewport: viewport.onViewport,
          setEdgeHighlight: edgeState.set,
          togglePath: toggleEncodedPath,
          tooltip: tooltip,
          keyboardNavigation: options.keyboardNavigation !== false,
        });
        viewport.bind();
      } else {
        var syncResult = syncCytoscapeElements(cy, elements);
        if (syncResult.topologyChanged) diagnostics.topologySyncs += 1;
      }
      if (interaction) interaction.refreshKeyboardFocus();
      syncActiveNode();
      runLayout(
        visible,
        !renderOptions || renderOptions.fit !== false,
        layoutCacheKey(profile.direction, elements, additionalStyles.length > 0),
      );
      return visible;
    }

    function destroy() {
      if (destroyed) return;
      destroyed = true;
      layoutGeneration += 1;
      if (activeLayout && typeof activeLayout.stop === "function") {
        activeLayout.stop();
        activeLayout = null;
      }
      if (interaction) {
        interaction.destroy();
        interaction = null;
      }
      viewport.destroy();
      if (resizeObserver) {
        resizeObserver.disconnect();
        resizeObserver = null;
      }
      tooltip.destroy();
      overlay.destroy();
      accessibility.destroy();
      layoutCache.clear();
      if (cy) {
        cy.destroy();
        cy = null;
      }
      if (previousContainerBackground.value) {
        container.style.setProperty(
          "background",
          previousContainerBackground.value,
          previousContainerBackground.priority,
        );
      } else {
        container.style.removeProperty("background");
      }
      if (hostElement && hostElement.classList) {
        if (hadHostTheme) hostElement.setAttribute("data-theme", previousHostTheme);
        else hostElement.removeAttribute("data-theme");
        hostStyleProperties.forEach(function (property) {
          var previous = previousHostStyles[property];
          if (previous && previous.value) {
            hostElement.style.setProperty(
              property,
              previous.value,
              previous.priority,
            );
          }
          else hostElement.style.removeProperty(property);
        });
        if (addedHostClass) hostElement.classList.remove("eino-workflow-dag-host");
      }
    }

    function resize() {
      assertActive();
      viewport.resize({ fit: true });
    }

    /** Export the current Cytoscape rendering without blocking large graphs. */
    function exportImage(exportOptions) {
      assertActive();
      var requested = exportOptions || {};
      var format =
        requested.format === "jpeg"
          ? "jpeg"
          : requested.format === "svg"
            ? "svg"
            : "png";
      if (format === "svg") {
        return exportWorkflowDAGSVG(cy, {
          full: requested.full,
          background:
            requested.background === undefined
              ? themeTokens(themeId).canvas.bg
              : requested.background,
          scale: requested.scale,
          maxWidth: requested.maxWidth,
          maxHeight: requested.maxHeight,
          padding: requested.padding,
        });
      }
      var imageOptions = {
        output: "blob-promise",
        full: requested.full !== false,
        bg:
          requested.background === undefined
            ? themeTokens(themeId).canvas.bg
            : requested.background,
      };
      ["scale", "maxWidth", "maxHeight", "quality"].forEach(function (key) {
        if (requested[key] !== undefined) imageOptions[key] = requested[key];
      });
      if (format === "jpeg") return cy.jpg(imageOptions);
      delete imageOptions.quality;
      return cy.png(imageOptions);
    }

    // 初始
    applyThemeChrome(themeId);
    render();
    if (options.autoResize !== false) {
      resizeObserver = observeElementResize(container, function () {
        viewport.resize({ fit: false });
      });
    }

    return attachCytoscapeAccess({
      update: update,
      expandAll: expandAll,
      collapseAll: collapseAll,
      toggle: toggle,
      getExpanded: getExpanded,
      setExpanded: setExpanded,
      getActiveNodePath: getActiveNodePath,
      setActiveNodePath: setActiveNodePath,
      getDirection: function () {
        return profile.direction;
      },
      setDirection: setDirection,
      getTheme: getTheme,
      setTheme: setTheme,
      getLocale: getLocale,
      setLocale: setLocale,
      zoomIn: function () {
        assertActive();
        viewport.zoomIn();
      },
      zoomOut: function () {
        assertActive();
        viewport.zoomOut();
      },
      resetView: function () {
        assertActive();
        viewport.resetView();
      },
      listSubgraphs: function () {
        return listPublicSubgraphs(publicSnapshot);
      },
      resize: resize,
      exportImage: exportImage,
      getDiagnostics: function () {
        return Object.assign({ cachedLayouts: layoutCache.size() }, diagnostics);
      },
      destroy: destroy,
    }, function () { return cy; });
  }
