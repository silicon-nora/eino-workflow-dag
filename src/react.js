import {
  createElement,
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";
import "./styles.css";
import { EinoWorkflowDAG } from "./renderer.js";

function joinClassNames(...values) {
  return values.filter(Boolean).join(" ");
}

export const EinoWorkflowDAGReact = forwardRef(function EinoWorkflowDAGReact(
  props,
  ref,
) {
  const {
    root,
    direction = "RIGHT",
    theme = "classic",
    expanded,
    activeNodeId = null,
    pinNodeTip = true,
    autoResize = true,
    debug = false,
    additionalStyles,
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
  const mountedRootRef = useRef(null);
  const mountedDirectionRef = useRef(direction);
  const mountedThemeRef = useRef(theme);
  const mountedLocaleRef = useRef(locale);
  const mountedExpandedRef = useRef(expanded);
  const mountedActiveNodeIdRef = useRef(activeNodeId);
  latestPropsRef.current = props;

  function reportError(error) {
    const normalized = error instanceof Error ? error : new Error(String(error));
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
      const instance = EinoWorkflowDAG.mount(containerRef.current, {
        root: latest.root,
        direction: latest.direction,
        theme: latest.theme,
        expanded: latest.expanded,
        activeNodeId: latest.activeNodeId,
        pinNodeTip: latest.pinNodeTip,
        autoResize: latest.autoResize,
        debug: latest.debug,
        additionalStyles: latest.additionalStyles,
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
      mountedRootRef.current = latest.root;
      mountedDirectionRef.current = instance.getDirection();
      mountedThemeRef.current = instance.getTheme();
      mountedLocaleRef.current = latest.locale;
      mountedExpandedRef.current = latest.expanded;
      mountedActiveNodeIdRef.current = latest.activeNodeId ?? null;
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
    if (!instanceRef.current || mountedRootRef.current === root) return;
    try {
      invoke("setData", root, { preserveExpanded, fit: fitOnUpdate });
      mountedRootRef.current = root;
    } catch (error) {
      reportError(error);
    }
  }, [root, preserveExpanded, fitOnUpdate]);

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
      mountedActiveNodeIdRef.current === activeNodeId
    ) {
      return;
    }
    try {
      invoke("setActiveNodeId", activeNodeId);
      mountedActiveNodeIdRef.current = activeNodeId;
    } catch (error) {
      reportError(error);
    }
  }, [activeNodeId]);

  useImperativeHandle(
    ref,
    () => ({
      getInstance: () => instanceRef.current,
      render: (...args) => invoke("render", ...args),
      setData: (...args) => invoke("setData", ...args),
      expandAll: () => invoke("expandAll"),
      collapseAll: () => invoke("collapseAll"),
      togglePath: (...args) => invoke("togglePath", ...args),
      getExpanded: () => invoke("getExpanded"),
      setExpanded: (...args) => invoke("setExpanded", ...args),
      getActiveNodeId: () => invoke("getActiveNodeId"),
      setActiveNodeId: (...args) => invoke("setActiveNodeId", ...args),
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
      "data-theme": theme,
    },
    createElement("div", { ref: containerRef, className: "cy-root" }),
    createElement("div", {
      className: "cy-overlays",
      "aria-hidden": "true",
    }),
  );
});

export default EinoWorkflowDAGReact;
