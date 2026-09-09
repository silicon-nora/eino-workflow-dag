import cytoscape from "cytoscape";
import { EinoWorkflowDAGModel } from "./model.js";
import { registerWorkflowDAGLayout } from "./cytoscape-layout.js";
import { createSubgraphOverlay } from "./overlay.js";
import { createNodeTooltip, formatNodeTooltip } from "./tooltip.js";
import { observeElementResize } from "./resize-observer.js";
import {
  formatDuration,
  patchCytoscapeElements,
  syncCytoscapeElements,
  toCytoscapeElements,
} from "./elements.js";
import {
  bindGraphInteractions,
  resolveInteractionPolicy,
} from "./interaction.js";
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
  normalizeThemeInput,
  stylesheet,
  themeFingerprint,
  themeName,
  themeTokens,
} from "./theme.js";

/* ---------- Cytoscape mount / 样式 / 交互 ---------- */

  // Cytoscape compound nodes only support uniform padding. Use the top value
  // so the title overlay has five extra pixels of breathing room.
  var COMPOUND_PAD = GRAPH_COMPOUND_PAD;
  // Routing clearance remains invariant. Themes can tune only the public
  // node and layer gaps.
  var SPACE_ROOT_BASE = {
    // Edge-to-node clearance also controls the outer detour channel.
    edgeNode: 44,
    edgeEdge: 28,
    portPort: 20,
    edgeNodeBetweenLayers: 44,
    edgeEdgeBetweenLayers: 28,
  };
  var SPACE_COMPOUND_BASE = {
    edgeNode: 52,
    edgeEdge: 30,
    portPort: 22,
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
      ...(node.status == null ? {} : { status: node.status }),
      ...(node.cost_ms == null ? {} : { durationMs: node.cost_ms }),
      metrics: node.metrics || null,
      errorMessage: node.err_msg || "",
      expandable: !!node.expandable,
      subgraph: !!node.subgraph,
      expanded: !!node.expanded,
      level: Number.isInteger(node.level) && node.level >= 0 ? node.level : 0,
      ...(node.parent ? { parentPath: decodeNodePath(node.parent) } : {}),
    };
  }

  function edgeChannels(kind) {
    if (!kind) return [];
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
      mappings: Array.isArray(edge.mappings) ? edge.mappings : [],
      metadata: edge.metadata == null ? null : edge.metadata,
      branchMetadata:
        edge.branchMetadata == null ? null : edge.branchMetadata,
      branchMetadataList: Array.isArray(edge.branchMetadataList)
        ? edge.branchMetadataList
        : [],
      level: Number(edge.level) || 0,
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
      levelZeroPath: visible.levelZeroPath.map(function (id) {
        return decodeNodePath(id);
      }),
      levelZeroDurationMs: visible.levelZeroDurationMs,
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

  function layoutThemeFingerprint(tokens) {
    return JSON.stringify({
      node: [tokens.node.width, tokens.node.height, tokens.node.textMaxWidth],
      spacing: tokens.spacing,
    });
  }

  /** Theme-driven styles; see THEMES for the built-in visual systems. */

  /**
   * @param {object} [profile] AxisProfile（含 direction）；缺省 RIGHT
   * @param {object} [visible] WorkflowDAGModel.buildVisibleGraph 结果
   */
  function workflowLayoutOptions(profile, visible, fit, tokens) {
    var sr = Object.assign({}, SPACE_ROOT_BASE, {
      nodeNode: tokens.spacing.nodeNode,
      betweenLayers: tokens.spacing.betweenLayers,
      fitPadding: tokens.spacing.fitPadding,
    });
    var sc = Object.assign({}, SPACE_COMPOUND_BASE, {
      nodeNode: tokens.spacing.nestedNodeNode,
      betweenLayers: tokens.spacing.nestedBetweenLayers,
    });
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
        node: {
          width: tokens.node.width,
          height: tokens.node.height,
        },
        compoundPadding: Object.assign({}, COMPOUND_PAD),
        padding: { top: 8, right: 8, bottom: 8, left: 8 },
        spacing: Object.assign({}, sr),
        nestedSpacing: Object.assign({}, sc),
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
    var themeInput = normalizeThemeInput(options.theme);
    var themeKey = themeFingerprint(themeInput);
    var tokens = themeTokens(themeInput);
    var layoutThemeKey = layoutThemeFingerprint(tokens);
    var interactionPolicy = resolveInteractionPolicy(options);
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

    var hostElement = container;
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
      "--eino-workflow-dag-tooltip-bg",
      "--eino-workflow-dag-tooltip-color",
      "--eino-workflow-dag-tooltip-border",
      "--eino-workflow-dag-tooltip-pinned-border",
      "--eino-workflow-dag-tooltip-shadow",
      "--eino-workflow-dag-tooltip-pinned-shadow",
      "--eino-workflow-dag-tooltip-radius",
      "--eino-workflow-dag-tooltip-max-width",
      "--eino-workflow-dag-tooltip-max-height",
      "--eino-workflow-dag-tooltip-font-size",
      "--eino-workflow-dag-tooltip-line-height",
      "--eino-workflow-dag-tooltip-padding-x",
      "--eino-workflow-dag-tooltip-padding-y",
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
              return callHost(
                "accessibilityLabelFormatter",
                options.accessibilityLabelFormatter,
                [summary, publicVisibleGraph(visible)],
                summary.text,
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
        var result = listeners.onError(normalized);
        if (result && typeof result.then === "function") {
          Promise.resolve(result).catch(function (listenerError) {
            if (options.debug && typeof console !== "undefined" && console.error) {
              console.error(
                "[eino-workflow-dag] onError callback failed",
                listenerError,
              );
            }
          });
        }
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

    function reportCallbackError(name, error) {
      reportError(new WorkflowDAGError(
        "RENDERER_RECOVERED",
        name + " callback failed: " + (
          error instanceof Error ? error.message : String(error)
        ),
        { recoverable: true, cause: error },
      ));
    }

    function callHost(name, callback, args, fallback) {
      try {
        return callback.apply(null, args);
      } catch (error) {
        reportCallbackError(name, error);
        return typeof fallback === "function" ? fallback() : fallback;
      }
    }

    function notifyHost(name, callback, value) {
      var result = callHost(name, callback, [value]);
      try {
        if (result && typeof result.then === "function") {
          Promise.resolve(result).catch(function (error) {
            reportCallbackError(name, error);
          });
        }
      } catch (error) {
        reportCallbackError(name, error);
      }
    }

    function graphStylesheet() {
      return stylesheet(themeInput).concat(additionalStyles);
    }

    /** 画布底色 + 实例宿主 data-theme / overlay CSS 变量（不触碰 cy layout） */
    function applyThemeChrome() {
      var tid = themeName(themeInput);
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
        wrap.style.setProperty("--eino-workflow-dag-tooltip-bg", tokens.tooltip.bg);
        wrap.style.setProperty("--eino-workflow-dag-tooltip-color", tokens.tooltip.color);
        wrap.style.setProperty("--eino-workflow-dag-tooltip-border", tokens.tooltip.borderColor);
        wrap.style.setProperty(
          "--eino-workflow-dag-tooltip-pinned-border",
          tokens.tooltip.pinnedBorderColor,
        );
        wrap.style.setProperty("--eino-workflow-dag-tooltip-shadow", tokens.tooltip.shadow);
        wrap.style.setProperty(
          "--eino-workflow-dag-tooltip-pinned-shadow",
          tokens.tooltip.pinnedShadow,
        );
        wrap.style.setProperty("--eino-workflow-dag-tooltip-radius", tokens.tooltip.radius + "px");
        wrap.style.setProperty("--eino-workflow-dag-tooltip-max-width", tokens.tooltip.maxWidth + "px");
        wrap.style.setProperty("--eino-workflow-dag-tooltip-max-height", tokens.tooltip.maxHeight + "px");
        wrap.style.setProperty("--eino-workflow-dag-tooltip-font-size", tokens.tooltip.fontSize + "px");
        wrap.style.setProperty("--eino-workflow-dag-tooltip-line-height", String(tokens.tooltip.lineHeight));
        wrap.style.setProperty("--eino-workflow-dag-tooltip-padding-x", tokens.tooltip.paddingX + "px");
        wrap.style.setProperty("--eino-workflow-dag-tooltip-padding-y", tokens.tooltip.paddingY + "px");
      }
    }

    function getTheme() {
      if (typeof themeInput === "string") return themeInput;
      return {
        base: themeInput.base,
        tokens: JSON.parse(JSON.stringify(themeInput.tokens)),
      };
    }

    function setTheme(next) {
      assertActive();
      var nextInput = normalizeThemeInput(next);
      var nextKey = themeFingerprint(nextInput);
      if (nextKey === themeKey) return;
      var previousGeometry = layoutThemeKey;
      themeInput = nextInput;
      themeKey = nextKey;
      tokens = themeTokens(themeInput);
      layoutThemeKey = layoutThemeFingerprint(tokens);
      if (cy) {
        cy.style(graphStylesheet());
      }
      applyThemeChrome();
      viewport.setFitPadding(tokens.spacing.fitPadding);
      if (previousGeometry !== layoutThemeKey) {
        layoutCache.clear();
        render();
        return;
      }
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
      render();
      notifyHost("onExpandedChange", listeners.onExpandedChange, getExpanded());
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
      var expandedChanged = !sameExpandedMap(previousExpanded, expanded);
      render({
        fit: !!(updateOptions && updateOptions.fit),
        patchData: canPatchRuntime,
      });
      if (expandedChanged) {
        notifyHost("onExpandedChange", listeners.onExpandedChange, getExpanded());
      }
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
      render();
      notifyHost("onExpandedChange", listeners.onExpandedChange, getExpanded());
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
      assertActive();
      var next = createKeyMap();
      Model.listSubgraphs(root).forEach(function (s) {
        next[s.path] = true;
      });
      if (sameExpandedMap(expanded, next)) return;
      expanded = next;
      render();
      notifyHost("onExpandedChange", listeners.onExpandedChange, getExpanded());
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
              return callHost(
                "tooltipFormatter",
                options.tooltipFormatter,
                [publicNodeData({
                  ...node,
                  key: node.key || decodeNodePath(node.id).at(-1) || "",
                  label: "",
                  title: node.title,
                })],
                function () {
                  return formatNodeTooltip(node, formatDuration, locale);
                },
              );
            }
          : null,
      pinning: interactionPolicy.pinTooltipOnNodeClick,
      locale: locale,
    });
    var viewport = createViewportController(container, {
      getCy: function () { return cy; },
      overlay: overlay,
      tooltip: tooltip,
      minZoom: MIN_ZOOM,
      maxZoom: MAX_ZOOM,
      fitPadding: tokens.spacing.fitPadding,
      zoomStep: ZOOM_STEP,
      wheelZoom: interactionPolicy.zoomOnCtrlWheel,
    });
    var edgeState = createEdgeStateController(function () { return cy; });

    function runLayout(visible, fit, cacheKey) {
      layoutGeneration += 1;
      var generation = layoutGeneration;
      if (activeLayout && typeof activeLayout.stop === "function") {
        activeLayout.stop();
      }
      // 清掉上次边几何，避免叠样式
      cy.edges().removeStyle();
      clearOverlays();
      var cached = layoutCache.get(cacheKey);
      if (cached && restoreCytoscapeLayout(cy, cached)) {
        diagnostics.layoutCacheHits += 1;
        edgeState.refresh();
        if (fit) cy.fit(undefined, tokens.spacing.fitPadding);
        viewport.afterViewSettled();
        return;
      }
      diagnostics.layoutRuns += 1;
      var layout = cy.layout(workflowLayoutOptions(profile, visible, fit, tokens));
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
            ? function (node) {
                return callHost(
                  "nodeLabelFormatter",
                  options.nodeLabelFormatter,
                  [node],
                  function () {
                    var detail = [
                      node.component || "",
                      node.durationMs == null ? "" : formatDuration(node.durationMs),
                    ].filter(Boolean).join("  ·  ");
                    var title = node.name || node.id;
                    return detail ? title + "\n" + detail : title;
                  },
                );
              }
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
        if (renderOptions.fit) cy.fit(undefined, tokens.spacing.fitPadding);
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
          userPanningEnabled: interactionPolicy.panOnDrag,
          minZoom: MIN_ZOOM,
          maxZoom: MAX_ZOOM,
        });
        interaction = bindGraphInteractions(cy, container, {
          clearEdgeHighlight: edgeState.clear,
          onEdgeClick: function (edge) {
            notifyHost("onEdgeClick", listeners.onEdgeClick, publicEdgeData(edge));
          },
          onKeyboardFocus: accessibility.focusNode,
          onNodeClick: function (node) {
            notifyHost("onNodeClick", listeners.onNodeClick, publicNodeData(node));
          },
          onViewport: viewport.onViewport,
          setEdgeHighlight: edgeState.set,
          togglePath: toggleEncodedPath,
          tooltip: tooltip,
          policy: interactionPolicy,
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
        layoutCacheKey(profile.direction, elements, additionalStyles.length > 0) + layoutThemeKey,
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
              ? tokens.canvas.bg
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
            ? tokens.canvas.bg
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
    applyThemeChrome();
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
