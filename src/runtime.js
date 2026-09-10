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
  toRenderedNodeData,
} from "./elements.js";
import {
  bindGraphInteractions,
  resolveInteractionPolicy,
} from "./interaction.js";
import { createViewportController } from "./viewport.js";
import { createEdgeStateController } from "./edge-state.js";
import {
  axisProfile,
  normalizeDirection,
} from "./axis-profile.js";
import { WorkflowDAGRules } from "./routing.js";
import { createAccessibilityPresenter } from "./accessibility.js";
import {
  captureCytoscapeLayout,
  createLayoutCache,
  restoreCytoscapeLayout,
} from "./layout-cache.js";
import { resolveLocale } from "./locale.js";
import { exportWorkflowDAGSVG } from "./svg-export.js";
import { createKeyMap, toPlainRecord } from "./key-map.js";
import { parseWorkflowSnapshot } from "./validation.js";
import {
  decodeNodePath,
  encodeNodePath,
  normalizeDAGSnapshot,
} from "./snapshot.js";
import {
  expandedMapToPaths,
  expandedPathsToMap,
  listPublicSubgraphs,
  normalizeActiveNodePath,
  normalizeExpandedMap,
  normalizeNodePath,
  publicEdgeData,
  publicVisibleGraph,
  sameExpandedMap,
  sameLocale,
} from "./runtime-public.js";
import { attachCytoscapeAccess } from "./cytoscape-access.js";
import {
  normalizeThemeInput,
  stylesheet,
  themeFingerprint,
  themeName,
  themeTokens,
} from "./theme.js";
import { workflowLayoutOptions } from "./runtime-layout.js";
import {
  createHostCallbackBoundary,
  createHostDomLifecycle,
} from "./runtime-host.js";
import {
  classifyRenderChange,
  classifyThemeChange,
  layoutGeometrySignature,
  renderGeometrySignature,
} from "./render-change.js";

/* ---------- Cytoscape mount / 样式 / 交互 ---------- */

  function ensureWorkflowLayoutRegistered() {
    var cytoLib = cytoscape;
    if (!cytoLib) throw new Error("Cytoscape is unavailable");
    try {
      registerWorkflowDAGLayout(cytoLib, WorkflowDAGRules);
    } catch (e) {
      /* 可能已注册 */
    }
  }
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
    var layoutThemeKey = layoutGeometrySignature(tokens);
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

    var hostLifecycle = createHostDomLifecycle(container);

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
    var cytoscapeHostChildren = [];
    var childrenBeforeCytoscape = null;
    var layoutGeneration = 0;
    var destroyed = false;
    var callbackBoundary = createHostCallbackBoundary({
      debug: !!options.debug,
      isDestroyed: function () { return destroyed; },
      onError: function () { return listeners.onError; },
    });
    var callHost = callbackBoundary.callHost;
    var notifyHost = callbackBoundary.notifyHost;
    var reportError = callbackBoundary.reportError;
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
    var lastRenderState = null;

    function assertActive() {
      if (destroyed) {
        throw new Error("Cannot use a destroyed workflow DAG");
      }
    }


    function graphStylesheet() {
      return stylesheet(themeInput).concat(additionalStyles);
    }

    /** 画布底色 + 实例宿主 data-theme / overlay CSS 变量（不触碰 cy layout） */

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
      var nextTokens = themeTokens(nextInput);
      var nextGeometry = layoutGeometrySignature(nextTokens);
      var change = classifyThemeChange(
        { themeSignature: themeKey, geometrySignature: layoutThemeKey },
        { themeSignature: nextKey, geometrySignature: nextGeometry },
      );
      if (change === "none") return;
      themeInput = nextInput;
      themeKey = nextKey;
      tokens = nextTokens;
      layoutThemeKey = nextGeometry;
      if (cy) {
        cy.style(graphStylesheet());
      }
      hostLifecycle.applyThemeChrome(tokens, themeName(themeInput));
      viewport.setFitPadding(tokens.spacing.fitPadding);
      if (change === "layout") {
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
                [toRenderedNodeData(node)],
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
      var geometrySignature = renderGeometrySignature({
        direction: profile.direction,
        elements: elements,
        themeGeometry: layoutThemeKey,
        geometryData: additionalStyles.length > 0
          ? "runtime"
          : typeof options.nodeLabelFormatter === "function"
            ? "labels"
            : false,
      });
      var renderChange = classifyRenderChange(lastRenderState, {
        geometrySignature: geometrySignature,
        allowDataPatch: !!(renderOptions && renderOptions.patchData),
        patchSafe: additionalStyles.length === 0,
      });
      if (
        cy &&
        renderChange === "data" &&
        patchCytoscapeElements(cy, elements)
      ) {
        lastRenderState = { geometrySignature: geometrySignature };
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
        childrenBeforeCytoscape = new Set(container.children);
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
            notifyHost(
              "onNodeClick",
              listeners.onNodeClick,
              toRenderedNodeData(node),
            );
          },
          onViewport: viewport.onViewport,
          onViewportGestureEnd: viewport.refreshRenderQuality,
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
      lastRenderState = { geometrySignature: geometrySignature };
      runLayout(
        visible,
        !renderOptions || renderOptions.fit !== false,
        geometrySignature,
      );
      if (childrenBeforeCytoscape) {
        cytoscapeHostChildren = Array.from(container.children).filter(function (child) {
          return !childrenBeforeCytoscape.has(child);
        });
        childrenBeforeCytoscape = null;
      }
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
      lastRenderState = null;
      hostLifecycle.restore(cy, cytoscapeHostChildren);
      cy = null;
      cytoscapeHostChildren = [];
      childrenBeforeCytoscape = null;
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

    // Mount transactionally and establish observation before Cytoscape mutates
    // the host, so observer setup failures leave no partially mounted renderer.
    try {
      if (options.autoResize !== false) {
        resizeObserver = observeElementResize(container, function () {
          viewport.resize({ fit: false });
        });
      }
      hostLifecycle.applyThemeChrome(tokens, themeName(themeInput));
      render();
    } catch (error) {
      destroy();
      throw error;
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
