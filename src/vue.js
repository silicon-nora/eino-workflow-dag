import {
  defineComponent,
  h,
  mergeProps,
  onBeforeUnmount,
  onMounted,
  ref,
  shallowRef,
  watch,
} from "vue";
import "./styles.css";
import { EinoWorkflowDAG } from "./renderer.js";

function forwardedOptions(props, emit) {
  return {
    root: props.root,
    direction: props.direction,
    theme: props.theme,
    expanded: props.expanded,
    activeNodeId: props.activeNodeId,
    pinNodeTip: props.pinNodeTip,
    autoResize: props.autoResize,
    debug: props.debug,
    additionalStyles: props.additionalStyles,
    ariaLabel: props.ariaLabel,
    accessibilityLabelFormatter: props.accessibilityLabelFormatter,
    keyboardNavigation: props.keyboardNavigation,
    tooltipFormatter: props.tooltipFormatter,
    nodeLabelFormatter: props.nodeLabelFormatter,
    layoutCacheSize: props.layoutCacheSize,
    locale: props.locale,
    onExpandedChange(expanded) {
      emit("expanded-change", expanded);
    },
    onNodeClick(node) {
      emit("node-click", node);
    },
    onEdgeClick(edge) {
      emit("edge-click", edge);
    },
    onError(error) {
      emit("error", error);
    },
  };
}

export const EinoWorkflowDAGVue = defineComponent({
  name: "EinoWorkflowDAG",
  inheritAttrs: false,
  props: {
    root: { type: Object, required: true },
    direction: { type: String, default: "RIGHT" },
    theme: { type: String, default: "classic" },
    expanded: { type: Object, default: undefined },
    activeNodeId: { type: String, default: null },
    pinNodeTip: { type: Boolean, default: true },
    autoResize: { type: Boolean, default: true },
    debug: { type: Boolean, default: false },
    additionalStyles: { type: Array, default: undefined },
    ariaLabel: { type: String, default: undefined },
    accessibilityLabelFormatter: { type: Function, default: undefined },
    keyboardNavigation: { type: Boolean, default: true },
    tooltipFormatter: { type: Function, default: undefined },
    nodeLabelFormatter: { type: Function, default: undefined },
    layoutCacheSize: { type: Number, default: 12 },
    preserveExpanded: { type: Boolean, default: true },
    fitOnUpdate: { type: Boolean, default: false },
    locale: { type: Object, default: undefined },
  },
  emits: ["ready", "expanded-change", "node-click", "edge-click", "error"],
  setup(props, { attrs, emit, expose }) {
    const container = ref(null);
    const instance = shallowRef(null);

    function reportError(error) {
      emit("error", error instanceof Error ? error : new Error(String(error)));
    }

    function mount() {
      if (!container.value || instance.value) return;
      try {
        instance.value = EinoWorkflowDAG.mount(
          container.value,
          forwardedOptions(props, emit),
        );
        emit("ready", instance.value);
      } catch (error) {
        reportError(error);
      }
    }

    function destroy() {
      if (!instance.value) return;
      instance.value.destroy();
      instance.value = null;
    }

    function invoke(method, ...args) {
      const dag = instance.value;
      if (!dag || typeof dag[method] !== "function") return undefined;
      return dag[method](...args);
    }

    function invokeAndReport(method, ...args) {
      try {
        return invoke(method, ...args);
      } catch (error) {
        reportError(error);
        return undefined;
      }
    }

    watch(
      () => props.root,
      (root) => {
        invokeAndReport("setData", root, {
          preserveExpanded: props.preserveExpanded,
          fit: props.fitOnUpdate,
        });
      },
    );
    watch(() => props.direction, (direction) =>
      invokeAndReport("setDirection", direction),
    );
    watch(() => props.theme, (theme) => invokeAndReport("setTheme", theme));
    watch(
      () => props.locale,
      (locale) => invokeAndReport("setLocale", locale),
      { deep: true },
    );
    watch(
      () => props.expanded,
      (expanded) => {
        if (expanded) invokeAndReport("setExpanded", expanded);
      },
      { deep: true },
    );
    watch(() => props.activeNodeId, (activeNodeId) =>
      invokeAndReport("setActiveNodeId", activeNodeId),
    );

    onMounted(mount);
    onBeforeUnmount(destroy);

    expose({
      getInstance: () => instance.value,
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
    });

    return () =>
      h(
        "div",
        mergeProps(attrs, {
          class: [
            "eino-workflow-dag-vue",
            "eino-workflow-dag-host",
            "cy-wrap",
          ],
          "data-theme": props.theme,
        }),
        [
          h("div", { ref: container, class: "cy-root" }),
          h("div", { class: "cy-overlays", "aria-hidden": "true" }),
        ],
      );
  },
});

export default EinoWorkflowDAGVue;
