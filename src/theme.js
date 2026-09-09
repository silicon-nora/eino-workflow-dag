import { GRAPH_COMPOUND_PAD } from "./geometry-config.js";
import { mergePlainRecords } from "./key-map.js";

const COMPOUND_PAD_CY = GRAPH_COMPOUND_PAD.top;

var THEMES = {
    classic: {
      canvas: { bg: "#f4f6f8" },
      colors: {
        ink: "#1a2332",
        steel: "#3d4f63",
        quiet: "#8b96a3",
        conduit: "#4a5d72",
        highlighted: "#d97706",
        signal: "#b42318",
        warning: "#9a6700",
        paper: "#ffffff",
        slate: "#5c6b7a",
        terminalBg: "#eef1f4",
        terminalBorder: "#7d8a96",
        llmBg: "#e3f2ec",
        llmBorder: "#2d7a62",
        branchBg: "#f3efe6",
        branchBorder: "#8a7348",
        subBg: "#e4eef7",
        subBorder: "#3d6a8c",
        parentBg: "#e8edf2",
        parentBorder: "#c5ced8",
        failBg: "#fceeee",
        warnBg: "#fff8c5",
        hover: "#2f5f82",
        press: "#1e4a6b",
        // 交互高亮：探针青，与静态 Level 配色区分。
        probe: "#0e7490",
        probeGlow: "#22d3ee",
      },
      node: {
        width: 220,
        height: 64,
        textMaxWidth: 200,
        shape: "round-rectangle",
        borderWidth: 1.25,
        radius: 8,
        fontSize: 16,
        textColor: "#1a2332",
      },
      edge: {
        width: 1.75,
        highlightedWidth: 2.25,
        arrowScale: 0.95,
        secondaryStyle: "dashed",
        secondaryDashPattern: [7, 3.5],
      },
      overlay: {
        titleBg: "rgba(228, 238, 247, 0.95)",
        titleColor: "#3d4f63",
        titleHoverBg: "rgba(220, 232, 244, 0.98)",
        titleHoverBorder: "#3d6a8c",
      },
      tooltip: {
        bg: "rgba(255, 255, 255, 0.97)",
        color: "#1f2328",
        borderColor: "#d0d7de",
        pinnedBorderColor: "#3d6a8c",
        shadow: "0 4px 16px rgba(31, 35, 40, 0.14)",
        pinnedShadow: "0 4px 16px rgba(47, 95, 130, 0.22)",
        radius: 8,
        maxWidth: 300,
        maxHeight: 260,
        fontSize: 12,
        lineHeight: 1.45,
        paddingX: 10,
        paddingY: 8,
      },
      spacing: {
        nodeNode: 56,
        betweenLayers: 48,
        nestedNodeNode: 64,
        nestedBetweenLayers: 56,
        fitPadding: 28,
      },
    },
    /**
     * ink — 冷色硫酸纸 + 碳素笔线稿；主链靛蓝湿墨（非纯黑/非橙）。
     * Vellum #eceff2 · Carbon #1a1f24 · Indigo #1e3a5f · Dilute cinnabar #8f2f2f
     */
    ink: {
      canvas: { bg: "#eceff2" },
      colors: {
        ink: "#1a1f24",
        steel: "#2c333c",
        quiet: "#6b7280",
        conduit: "#9aa3ad",
        highlighted: "#1e3a5f",
        signal: "#8f2f2f",
        warning: "#7a5d21",
        paper: "#fbfcfd",
        slate: "#1a1f24",
        terminalBg: "#f4f6f8",
        terminalBorder: "#3d4450",
        llmBg: "#fbfcfd",
        llmBorder: "#3d5a4c",
        branchBg: "#fbfcfd",
        branchBorder: "#5c5346",
        subBg: "#f4f6f8",
        subBorder: "#1a1f24",
        parentBg: "#e4e8ed",
        parentBorder: "#b0b8c2",
        failBg: "#f7ecec",
        warnBg: "#f7f1df",
        hover: "#1e3a5f",
        press: "#152a45",
        probe: "#243b55",
        probeGlow: "#6b8cae",
      },
      node: {
        shape: "round-rectangle",
        borderWidth: 1.1,
        radius: 2,
        fontSize: 15.5,
        fontWeight: 500,
        fontFamily:
          '"IBM Plex Sans", "Source Han Sans SC", "Noto Sans SC", system-ui, sans-serif',
        textColor: "#1a1f24",
        textOutlineWidth: 0,
        pressBlacken: 0.08,
        parentOpacity: 0.55,
      },
      edge: {
        width: 1.35,
        highlightedWidth: 2.75,
        arrowScale: 0.9,
        secondaryStyle: "dotted",
        secondaryDashPattern: [1.5, 3.5],
        highlightedUnderlay: false,
      },
      overlay: {
        titleBg: "rgba(251, 252, 253, 0.96)",
        titleColor: "#1a1f24",
        titleHoverBg: "rgba(236, 239, 242, 0.98)",
        titleHoverBorder: "#1e3a5f",
        titleFont:
          '"IBM Plex Sans", "Source Han Sans SC", "Noto Sans SC", system-ui, sans-serif',
      },
    },
    /**
     * midnight — 观测台夜景：铜质主链 + 星光字，拒绝赛博酸色。
     * Void #080b10 · Panel #121820 · Starlight #c8d0d8 · Copper #c4893a · Dust rose #c45c6a
     */
    midnight: {
      canvas: { bg: "#080b10" },
      colors: {
        ink: "#c8d0d8",
        steel: "#8b9aab",
        quiet: "#5c6b7a",
        conduit: "#3d4f5f",
        highlighted: "#c4893a",
        signal: "#c45c6a",
        warning: "#d9a441",
        paper: "#121820",
        slate: "#5a6a7a",
        terminalBg: "#0e141c",
        terminalBorder: "#6a7a8a",
        llmBg: "#101c18",
        llmBorder: "#5a8f7b",
        branchBg: "#1a1610",
        branchBorder: "#a67c3a",
        subBg: "#0e1520",
        subBorder: "#6a8499",
        parentBg: "#06080c",
        parentBorder: "#2a3540",
        failBg: "#1a1014",
        warnBg: "#211a0d",
        hover: "#c4893a",
        press: "#e0a85c",
        probe: "#a8c5d4",
        probeGlow: "#6a8a9a",
      },
      node: {
        shape: "round-rectangle",
        borderWidth: 1.35,
        radius: 6,
        fontSize: 15,
        fontWeight: 500,
        fontFamily:
          '"JetBrains Mono", "SF Mono", "Cascadia Code", ui-monospace, monospace',
        textColor: "#c8d0d8",
        textOutlineWidth: 2,
        textOutlineColor: "#080b10",
        pressBlacken: 0.22,
        parentOpacity: 0.82,
      },
      edge: {
        width: 1.6,
        highlightedWidth: 2.4,
        arrowScale: 1,
        secondaryStyle: "dashed",
        secondaryDashPattern: [5, 4],
        highlightedUnderlay: true,
      },
      overlay: {
        titleBg: "rgba(18, 24, 32, 0.92)",
        titleColor: "#c8d0d8",
        titleHoverBg: "rgba(24, 32, 42, 0.96)",
        titleHoverBorder: "#c4893a",
        titleFont:
          '"JetBrains Mono", "SF Mono", "Cascadia Code", ui-monospace, monospace',
      },
      tooltip: {
        bg: "rgba(18, 24, 32, 0.96)",
        color: "#e6edf3",
        borderColor: "#3d4a5c",
        pinnedBorderColor: "#6a8a9a",
        shadow: "0 4px 16px rgba(0, 0, 0, 0.35)",
        pinnedShadow: "0 4px 16px rgba(0, 0, 0, 0.42)",
      },
    },
  };
Object.setPrototypeOf(THEMES, null);

const TOKEN_FIELDS = {
  canvas: { bg: "string" },
  colors: {
    ink: "string", steel: "string", quiet: "string", conduit: "string",
    highlighted: "string", signal: "string", warning: "string", paper: "string",
    slate: "string", terminalBg: "string", terminalBorder: "string",
    llmBg: "string", llmBorder: "string", branchBg: "string",
    branchBorder: "string", subBg: "string", subBorder: "string",
    parentBg: "string", parentBorder: "string", failBg: "string", warnBg: "string",
    hover: "string", press: "string", probe: "string", probeGlow: "string",
  },
  node: {
    width: [80, 600], height: [32, 240], textMaxWidth: [40, 560],
    shape: "string", borderWidth: [0, 12], radius: [0, 80], fontSize: [8, 48],
    fontWeight: [100, 900], fontFamily: "string", textColor: "string",
    textOutlineWidth: [0, 12], textOutlineColor: "string",
    pressBlacken: [0, 1], parentOpacity: [0, 1],
  },
  edge: {
    width: [0.5, 12], highlightedWidth: [0.5, 16], arrowScale: [0.25, 4],
    secondaryStyle: "string", secondaryDashPattern: "number-array",
    highlightedUnderlay: "boolean",
  },
  overlay: {
    titleBg: "string", titleColor: "string", titleHoverBg: "string",
    titleHoverBorder: "string", titleFont: "string",
  },
  tooltip: {
    bg: "string", color: "string", borderColor: "string",
    pinnedBorderColor: "string", shadow: "string", pinnedShadow: "string",
    radius: [0, 32], maxWidth: [120, 800], maxHeight: [80, 800],
    fontSize: [8, 32], lineHeight: [1, 2.5], paddingX: [0, 32], paddingY: [0, 32],
  },
  spacing: {
    nodeNode: [8, 240], betweenLayers: [16, 320],
    nestedNodeNode: [8, 240], nestedBetweenLayers: [16, 320],
    fitPadding: [0, 160],
  },
};

function invalidToken(path, message) {
  throw new TypeError("theme token " + path + " " + message);
}

function validateTokens(tokens) {
  if (!tokens || typeof tokens !== "object" || Array.isArray(tokens)) {
    throw new TypeError("theme tokens must be an object");
  }
  var result = {};
  Object.keys(tokens).forEach(function (section) {
    if (!Object.prototype.hasOwnProperty.call(TOKEN_FIELDS, section)) {
      invalidToken(section, "is not supported");
    }
    var fields = TOKEN_FIELDS[section];
    var source = tokens[section];
    if (!source || typeof source !== "object" || Array.isArray(source)) {
      invalidToken(section, "must be an object");
    }
    var target = {};
    Object.keys(source).forEach(function (field) {
      if (!Object.prototype.hasOwnProperty.call(fields, field)) {
        invalidToken(section + "." + field, "is not supported");
      }
      var rule = fields[field];
      var value = source[field];
      var path = section + "." + field;
      if (rule === "number-array") {
        if (!Array.isArray(value) || !value.length || value.some(function (item) {
          return typeof item !== "number" || !Number.isFinite(item) || item <= 0;
        })) invalidToken(path, "must be a non-empty array of positive numbers");
        target[field] = value.slice();
        return;
      }
      if (typeof rule === "string") {
        if (typeof value !== rule) invalidToken(path, "must be a " + rule);
        if (rule === "string" && !value) invalidToken(path, "must be a non-empty string");
        target[field] = value;
        return;
      }
      if (
        typeof value !== "number" || !Number.isFinite(value) ||
        value < rule[0] || value > rule[1]
      ) invalidToken(path, "must be between " + rule[0] + " and " + rule[1]);
      target[field] = value;
    });
    result[section] = target;
  });
  return result;
}

export function normalizeTheme(t) {
    if (typeof t === "string" && THEMES[t]) return t;
    return "classic";
  }

export function normalizeThemeInput(input) {
    if (typeof input === "string" || input == null) return normalizeTheme(input);
    if (!input || typeof input !== "object" || Array.isArray(input)) return "classic";
    Object.keys(input).forEach(function (key) {
      if (key !== "base" && key !== "tokens") {
        throw new TypeError("theme." + key + " is not supported");
      }
    });
    var base = normalizeTheme(input.base);
    var tokens = validateTokens(input.tokens || {});
    return { base: base, tokens: tokens };
  }

export function themeName(input) {
    var normalized = normalizeThemeInput(input);
    return typeof normalized === "string" ? normalized : normalized.base;
  }

export function themeFingerprint(input) {
    return JSON.stringify(normalizeThemeInput(input));
  }

export function listThemes() {
    return Object.keys(THEMES);
  }

export function registerTheme(id, tokens) {
    if (!id || typeof id !== "string") {
      throw new TypeError("theme id must be a non-empty string");
    }
    if (id === "classic" || id === "ink" || id === "midnight") {
      throw new TypeError("built-in themes cannot be replaced");
    }
    tokens = validateTokens(tokens);
    var registered = {
      canvas: mergePlainRecords(tokens.canvas),
      colors: mergePlainRecords(tokens.colors),
      node: mergePlainRecords(tokens.node),
      edge: mergePlainRecords(tokens.edge),
      overlay: mergePlainRecords(tokens.overlay),
      tooltip: mergePlainRecords(tokens.tooltip),
      spacing: mergePlainRecords(tokens.spacing),
    };
    var previous = THEMES[id];
    THEMES[id] = registered;
    return function unregisterTheme() {
      if (THEMES[id] !== registered) return;
      if (previous) THEMES[id] = previous;
      else delete THEMES[id];
    };
  }

export function themeTokens(id) {
    var input = normalizeThemeInput(id);
    var tid = typeof input === "string" ? input : input.base;
    var instance = typeof input === "string" ? {} : input.tokens;
    var base = THEMES.classic;
    var o = THEMES[tid] || {};
    return {
      canvas: mergePlainRecords(base.canvas, o.canvas, instance.canvas),
      colors: mergePlainRecords(base.colors, o.colors, instance.colors),
      node: mergePlainRecords(base.node, o.node, instance.node),
      edge: mergePlainRecords(base.edge, o.edge, instance.edge),
      overlay: mergePlainRecords(base.overlay, o.overlay, instance.overlay),
      tooltip: mergePlainRecords(base.tooltip, o.tooltip, instance.tooltip),
      spacing: mergePlainRecords(base.spacing, o.spacing, instance.spacing),
    };
  }


export function stylesheet(themeInput) {
    var tokens = themeTokens(themeInput);
    var C = tokens.colors;
    var N = tokens.node;
    var E = tokens.edge;
    var pressBlacken = N.pressBlacken != null ? N.pressBlacken : 0.16;
    var parentOp = N.parentOpacity != null ? N.parentOpacity : 0.72;
    var nodeStyle = {
      label: "data(label)",
      // 叶子框尺寸；字号见各主题 node.fontSize（相对框偏小就调 fontSize，勿先放大框）
      width: N.width,
      height: N.height,
      shape: N.shape || "round-rectangle",
      "background-color": C.paper,
      "border-width": N.borderWidth,
      "border-color": C.slate,
      color: N.textColor,
      "font-size": N.fontSize,
      "font-weight": N.fontWeight != null ? N.fontWeight : 500,
      "text-wrap": "wrap",
      "text-max-width": N.textMaxWidth,
      "text-valign": "center",
      "text-halign": "center",
      "text-outline-width": N.textOutlineWidth || 0,
      "text-outline-color": N.textOutlineColor || C.paper,
      "underlay-opacity": 0,
      "overlay-opacity": 0,
      events: "yes",
    };
    if (N.fontFamily) nodeStyle["font-family"] = N.fontFamily;
    if (N.radius != null) nodeStyle["corner-radius"] = N.radius;

    var highlightedEdge = {
      "line-style": "solid",
      "line-color": C.highlighted,
      "target-arrow-color": C.highlighted,
      width: E.highlightedWidth,
      "arrow-scale": E.arrowScale >= 1 ? 1.05 : E.arrowScale + 0.1,
      opacity: 1,
    };
    if (E.highlightedUnderlay) {
      highlightedEdge["underlay-color"] = C.highlighted;
      highlightedEdge["underlay-opacity"] = 0.28;
      highlightedEdge["underlay-padding"] = 3;
    }

    return [
      {
        selector: "node",
        style: nodeStyle,
      },
      {
        selector: 'node[kind = "io"], node[kind = "cpu"], node[kind = "merge"]',
        style: {
          "background-color": C.paper,
          "border-color": C.slate,
        },
      },
      {
        selector: 'node[kind = "start"], node[kind = "end"]',
        style: {
          "background-color": C.terminalBg,
          "border-color": C.terminalBorder,
          "border-width": N.borderWidth,
        },
      },
      {
        selector: 'node[kind = "llm"]',
        style: {
          "background-color": C.llmBg,
          "border-color": C.llmBorder,
          "border-width": Math.max(N.borderWidth, 1.5),
        },
      },
      {
        selector: 'node[kind = "branch"]',
        style: {
          "background-color": C.branchBg,
          "border-color": C.branchBorder,
          "border-width": Math.max(N.borderWidth, 1.5),
        },
      },
      {
        selector: "node[?subgraph]",
        style: {
          "background-color": C.subBg,
          "border-color": C.subBorder,
          "border-style": "dashed",
          "border-width": Math.max(N.borderWidth, 1.5),
          "font-weight": 600,
        },
      },
      {
        selector: "node:parent",
        style: {
          "background-color": C.parentBg,
          "background-opacity": parentOp,
          "border-color": C.parentBorder,
          "border-width": N.borderWidth,
          "border-style": "solid",
          padding: COMPOUND_PAD_CY,
          label: "",
          "text-opacity": 0,
          "underlay-opacity": 0,
          events: "no",
        },
      },
      {
        selector: 'node[status = "skipped"]',
        style: {
          opacity: 0.48,
          "border-style": "dashed",
          color: C.quiet,
        },
      },
      {
        selector: 'node[status = "failed"]',
        style: {
          "border-color": C.signal,
          "background-color": C.failBg,
          "border-width": Math.max(N.borderWidth, 1.5),
        },
      },
      {
        selector: "node.hover",
        style: {
          "border-color": C.hover,
          "border-width": 2,
          "underlay-opacity": 0,
          "overlay-opacity": 0,
        },
      },
      {
        selector: "node.active-node",
        style: {
          "border-color": C.press,
          "border-width": 3,
          "underlay-color": C.probeGlow,
          "underlay-opacity": 0.34,
          "underlay-padding": 6,
          "overlay-opacity": 0,
          "z-index": 9998,
        },
      },
      {
        selector: "node.keyboard-focus",
        style: {
          "border-color": C.hover,
          "border-width": 3,
          "underlay-color": C.probeGlow,
          "underlay-opacity": 0.3,
          "underlay-padding": 5,
          "overlay-opacity": 0,
        },
      },
      {
        selector: "node.hover[?expandable]",
        style: {
          "border-color": C.press,
          "border-width": 2.25,
          "underlay-opacity": 0,
          "overlay-opacity": 0,
        },
      },
      {
        selector: "node.press",
        style: {
          "border-color": C.press,
          "border-width": 3,
          "background-blacken": pressBlacken,
          "underlay-opacity": 0,
          "overlay-opacity": 0,
        },
      },
      {
        selector: "edge",
        style: {
          "curve-style": "segments",
          "source-endpoint": "outside-to-node",
          "target-endpoint": "outside-to-node",
          width: E.width,
          "line-style": E.secondaryStyle,
          "line-dash-pattern": E.secondaryDashPattern,
          "line-color": C.conduit,
          "target-arrow-shape": "triangle",
          "target-arrow-color": C.conduit,
          "arrow-scale": E.arrowScale,
          opacity: 1,
          "segment-weights": 0.5,
          "segment-distances": 0,
          events: "yes",
        },
      },
      {
        // Level 0 使用最高优先级轨道色（经典主题为橙）
        selector: "edge[level = 0]",
        style: highlightedEdge,
      },
      {
        selector: "edge.highlight",
        style: {
          width: 3.5,
          "line-color": C.probe,
          "target-arrow-color": C.probe,
          "line-style": "solid",
          "arrow-scale": 1.25,
          "underlay-color": C.probeGlow,
          "underlay-opacity": 0.45,
          "underlay-padding": 6,
          opacity: 1,
          "z-index": 9999,
        },
      },
      {
        selector: "edge.dimmed",
        style: {
          opacity: 0.28,
        },
      },
    ];
  }
