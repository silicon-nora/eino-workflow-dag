import {
  createElement,
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";
import "./styles.css";
import { createWorkflowDAG } from "./renderer.js";
import { WorkflowDAGError } from "./workflow-error.js";

function joinClassNames(...values) {
  return values.filter(Boolean).join(" ");
}

export const EinoWorkflowDAGReact = forwardRef(function EinoWorkflowDAGReact(
  props,
  ref,
) {
  const {
    snapshot,
    direction = "RIGHT",
    theme = "classic",
    interaction,
    expanded,
    activeNodePath = null,
    pinNodeTip = true,
    autoResize = true,
    debug = false,
    ariaLabel,
    accessibilityLabelFormatter,
    keyboardNavigation = true,
    tooltipFormatter,
    nodeLabelFormatter,
    layoutCacheSize,
    preserveExpanded = true,
    fitOnUpdate = false,
    locale,
    onReady,
    onExpandedChange,
    onNodeClick,
    onEdgeClick,
    onError,
    className,
    style,
    ...divProps
  } = props;

  const containerRef = useRef(null);
  const instanceRef = useRef(null);
  const latestPropsRef = useRef(props);
  const mountedSnapshotRef = useRef(null);
  const mountedDirectionRef = useRef(direction);
  const mountedThemeRef = useRef(theme);
  const mountedLocaleRef = useRef(locale);
  const mountedExpandedRef = useRef(expanded);
  const mountedActiveNodePathRef = useRef(activeNodePath);
  latestPropsRef.current = props;

  function reportError(error) {
    const normalized =
      error?.code === "INVALID_WORKFLOW_SNAPSHOT" || error instanceof WorkflowDAGError
        ? error
        : new WorkflowDAGError(
            "REACT_ADAPTER_UPDATE_FAILED",
            error instanceof Error ? error.message : String(error),
            { cause: error },
          );
    latestPropsRef.current.onError?.(normalized);
  }

  function invoke(method, ...args) {
    const dag = instanceRef.current;
    if (!dag || typeof dag[method] !== "function") return undefined;
    return dag[method](...args);
  }

  useEffect(() => {
    if (!containerRef.current || instanceRef.current) return undefined;
    try {
      const latest = latestPropsRef.current;
      const instance = createWorkflowDAG(containerRef.current, {
        snapshot: latest.snapshot,
        direction: latest.direction,
        theme: latest.theme,
        interaction: latest.interaction,
        expanded: latest.expanded,
        activeNodePath: latest.activeNodePath,
        pinNodeTip: latest.pinNodeTip,
        autoResize: latest.autoResize,
        debug: latest.debug,
        ariaLabel: latest.ariaLabel,
        accessibilityLabelFormatter: latest.accessibilityLabelFormatter,
        keyboardNavigation: latest.keyboardNavigation,
        tooltipFormatter: latest.tooltipFormatter,
        nodeLabelFormatter: latest.nodeLabelFormatter,
        layoutCacheSize: latest.layoutCacheSize,
        locale: latest.locale,
        onExpandedChange: (value) =>
          latestPropsRef.current.onExpandedChange?.(value),
        onNodeClick: (value) => latestPropsRef.current.onNodeClick?.(value),
        onEdgeClick: (value) => latestPropsRef.current.onEdgeClick?.(value),
        onError: (error) => latestPropsRef.current.onError?.(error),
      });
      instanceRef.current = instance;
      mountedSnapshotRef.current = latest.snapshot;
      mountedDirectionRef.current = instance.getDirection();
      mountedThemeRef.current = instance.getTheme();
      mountedLocaleRef.current = latest.locale;
      mountedExpandedRef.current = latest.expanded;
      mountedActiveNodePathRef.current = latest.activeNodePath ?? null;
      latest.onReady?.(instance);
    } catch (error) {
      reportError(error);
    }

    return () => {
      instanceRef.current?.destroy();
      instanceRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!instanceRef.current || mountedSnapshotRef.current === snapshot) return;
    try {
      invoke("update", snapshot, { preserveExpanded, fit: fitOnUpdate });
      mountedSnapshotRef.current = snapshot;
    } catch (error) {
      reportError(error);
    }
  }, [snapshot, preserveExpanded, fitOnUpdate]);

  useEffect(() => {
    if (!instanceRef.current || mountedDirectionRef.current === direction) return;
    try {
      invoke("setDirection", direction);
      mountedDirectionRef.current = direction;
    } catch (error) {
      reportError(error);
    }
  }, [direction]);

  useEffect(() => {
    if (!instanceRef.current || mountedThemeRef.current === theme) return;
    try {
      invoke("setTheme", theme);
      mountedThemeRef.current = theme;
    } catch (error) {
      reportError(error);
    }
  }, [theme]);

  useEffect(() => {
    if (!instanceRef.current || mountedLocaleRef.current === locale) return;
    try {
      invoke("setLocale", locale);
      mountedLocaleRef.current = locale;
    } catch (error) {
      reportError(error);
    }
  }, [locale]);

  useEffect(() => {
    if (
      !instanceRef.current ||
      !expanded ||
      mountedExpandedRef.current === expanded
    ) {
      return;
    }
    try {
      invoke("setExpanded", expanded);
      mountedExpandedRef.current = expanded;
    } catch (error) {
      reportError(error);
    }
  }, [expanded]);

  useEffect(() => {
    if (
      !instanceRef.current ||
      mountedActiveNodePathRef.current === activeNodePath
    ) {
      return;
    }
    try {
      invoke("setActiveNodePath", activeNodePath);
      mountedActiveNodePathRef.current = activeNodePath;
    } catch (error) {
      reportError(error);
    }
  }, [activeNodePath]);

  useImperativeHandle(
    ref,
    () => ({
      getInstance: () => instanceRef.current,
      update: (...args) => invoke("update", ...args),
      expandAll: () => invoke("expandAll"),
      collapseAll: () => invoke("collapseAll"),
      toggle: (...args) => invoke("toggle", ...args),
      getExpanded: () => invoke("getExpanded"),
      setExpanded: (...args) => invoke("setExpanded", ...args),
      getActiveNodePath: () => invoke("getActiveNodePath"),
      setActiveNodePath: (...args) => invoke("setActiveNodePath", ...args),
      getDirection: () => invoke("getDirection"),
      setDirection: (...args) => invoke("setDirection", ...args),
      getTheme: () => invoke("getTheme"),
      setTheme: (...args) => invoke("setTheme", ...args),
      getLocale: () => invoke("getLocale"),
      setLocale: (...args) => invoke("setLocale", ...args),
      zoomIn: () => invoke("zoomIn"),
      zoomOut: () => invoke("zoomOut"),
      resetView: () => invoke("resetView"),
      listSubgraphs: () => invoke("listSubgraphs"),
      resize: () => invoke("resize"),
      exportImage: (...args) => invoke("exportImage", ...args),
      getDiagnostics: () => invoke("getDiagnostics"),
    }),
    [],
  );

  return createElement(
    "div",
    {
      ...divProps,
      className: joinClassNames(
        "eino-workflow-dag-react",
        "eino-workflow-dag-host",
        "cy-wrap",
        className,
      ),
      style,
      "data-theme": typeof theme === "string" ? theme : theme?.base || "classic",
    },
    createElement("div", { ref: containerRef, className: "cy-root" }),
  );
});

export default EinoWorkflowDAGReact;
