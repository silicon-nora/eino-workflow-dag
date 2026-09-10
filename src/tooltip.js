import { hasOwnKey, mergePlainRecords } from "./key-map.js";
import { resolveLocale } from "./locale.js";

const TOOLTIP_BOUNDARY_EVENTS = Object.freeze([
  "contextmenu",
  "mousedown",
  "pointerdown",
  "touchstart",
]);

function statusLabel(status, locale) {
  const labels = mergePlainRecords({
    success: "Success",
    failed: "Failed",
    skipped: "Skipped",
  }, locale && locale.statuses);
  return (hasOwnKey(labels, status) ? labels[status] : status) || "-";
}

function formatMetricValue(value) {
  if (value === null || value === undefined) return "-";
  if (typeof value === "boolean" || typeof value === "number") return String(value);
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function coerceMetricObject(value) {
  if (value && typeof value === "object" && !Array.isArray(value)) return value;
  if (typeof value !== "string") return null;
  const source = value.trim();
  if (source[0] !== "{" && source[0] !== "[") return null;
  try {
    const parsed = JSON.parse(source);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function appendTokenUsage(lines, raw, locale) {
  const usage = coerceMetricObject(raw);
  lines.push(`── ${locale.tooltip.tokenUsage} ──`);
  if (!usage) {
    lines.push(`token_usage: ${formatMetricValue(raw)}`);
    return;
  }
  const inputDetails = coerceMetricObject(usage.prompt_token_details);
  const outputDetails = coerceMetricObject(usage.completion_token_details);
  const cached = inputDetails?.cached_tokens ?? usage.cached_tokens ?? 0;
  const reasoning = outputDetails?.reasoning_tokens ?? usage.reasoning_tokens ?? 0;
  lines.push(`prompt_tokens: ${formatMetricValue(usage.prompt_tokens)}`);
  lines.push(`completion_tokens: ${formatMetricValue(usage.completion_tokens)}`);
  lines.push(`total_tokens: ${formatMetricValue(usage.total_tokens)}`);
  lines.push(`cached_tokens: ${formatMetricValue(cached)}`);
  lines.push(`reasoning_tokens: ${formatMetricValue(reasoning)}`);
}

/** Format a node data object for the built-in plain-text tooltip. */
export function formatNodeTooltip(data, formatDuration = String, locale) {
  const labels = resolveLocale(locale);
  const lines = [];
  lines.push(data.title || data.id || "-");
  lines.push(`${labels.tooltip.status}: ${statusLabel(data.status, labels)}`);
  if (data.cost_ms != null) {
    lines.push(`${labels.tooltip.duration}: ${formatDuration(data.cost_ms)}`);
  }
  if (data.err_msg) lines.push(`${labels.tooltip.error}: ${data.err_msg}`);

  const metrics = data.metrics;
  if (metrics && typeof metrics === "object") {
    const keys = Object.keys(metrics).sort();
    if (keys.includes("token_usage")) appendTokenUsage(lines, metrics.token_usage, labels);
    const otherKeys = keys.filter((key) => key !== "cost_ms" && key !== "token_usage");
    if (otherKeys.length) {
      lines.push(`── ${labels.tooltip.metrics} ──`);
      for (const key of otherKeys) {
        lines.push(`${key}: ${formatMetricValue(metrics[key])}`);
      }
    }
  }
  return lines.join("\n");
}

/** Manage the hover and pinned tooltip for Cytoscape leaf nodes. */
export function createNodeTooltip(container, options = {}) {
  const formatDuration = options.formatDuration || String;
  const formatter = options.formatter;
  const pinning = options.pinning !== false;
  let locale = options.locale;
  let cy = null;
  let tip = null;
  let hoveredNodeId = null;
  let pinnedNodeId = null;
  let tipHovering = false;
  let hideTimer = null;

  function clearHideTimer() {
    if (hideTimer) clearTimeout(hideTimer);
    hideTimer = null;
  }

  function onTipEnter() {
    clearHideTimer();
    tipHovering = true;
  }

  function onTipLeave() {
    tipHovering = false;
    hoveredNodeId = null;
    refresh();
  }

  function stopGraphGesture(event) {
    event.stopPropagation();
  }

  function ensureTip() {
    if (tip) return tip;
    tip = document.createElement("div");
    tip.className = "cy-node-tip";
    tip.hidden = true;
    tip.addEventListener("mouseenter", onTipEnter);
    tip.addEventListener("mouseleave", onTipLeave);
    TOOLTIP_BOUNDARY_EVENTS.forEach((eventName) => {
      tip.addEventListener(eventName, stopGraphGesture);
    });
    container.appendChild(tip);
    return tip;
  }

  function nodeById(id) {
    if (!id || !cy) return null;
    const node = cy.getElementById(id);
    if (!node || node.empty() || !node.visible() || node.isParent()) return null;
    return node;
  }

  function position(node, element) {
    const bounds = node.renderedBoundingBox({
      includeLabels: true,
      includeOverlays: false,
    });
    if (!bounds || !Number.isFinite(bounds.x2)) return;
    const pad = 8;
    let left = bounds.x2 + pad;
    let top = bounds.y1;
    element.hidden = false;
    const width = element.offsetWidth || 200;
    const height = element.offsetHeight || 80;
    if (left + width > cy.width() - 4) left = Math.max(4, bounds.x1 - width - pad);
    if (top + height > cy.height() - 4) top = Math.max(4, cy.height() - height - 4);
    element.style.left = `${left}px`;
    element.style.top = `${Math.max(4, top)}px`;
  }

  function refresh(nextCy) {
    if (nextCy) cy = nextCy;
    if (!cy) return;
    const element = ensureTip();
    if (!element) return;
    let id = hoveredNodeId || pinnedNodeId;
    let node = nodeById(id);
    if (!node && id) {
      if (hoveredNodeId === id) hoveredNodeId = null;
      if (pinnedNodeId === id) pinnedNodeId = null;
      id = hoveredNodeId || pinnedNodeId;
      node = nodeById(id);
    }
    if (!node) {
      element.hidden = true;
      element.classList.remove("pinned");
      return;
    }
    // Keep the formatter input identical to the data sent by node click.
    // The runtime owns the one public-data conversion for both callbacks.
    const data = { ...node.data() };
    const content = formatter
      ? formatter({ ...data })
      : formatNodeTooltip(data, formatDuration, locale);
    element.textContent = content == null ? "" : String(content);
    element.classList.toggle("pinned", !!pinnedNodeId);
    position(node, element);
  }

  function show(node) {
    if (tipHovering || pinnedNodeId) return;
    if (!node || node.isParent()) {
      hoveredNodeId = null;
    } else {
      clearHideTimer();
      hoveredNodeId = node.id();
    }
    refresh();
  }

  function scheduleHide() {
    if (tipHovering || pinnedNodeId) return;
    clearHideTimer();
    hideTimer = setTimeout(() => {
      hideTimer = null;
      if (tipHovering || pinnedNodeId) return;
      hoveredNodeId = null;
      refresh();
    }, 160);
  }

  function togglePin(node) {
    if (!pinning) return;
    if (!node || node.isParent()) return;
    pinnedNodeId = pinnedNodeId === node.id() ? null : node.id();
    hoveredNodeId = null;
    refresh();
  }

  function setLocale(nextLocale) {
    locale = nextLocale;
    refresh();
  }

  function destroy() {
    clearHideTimer();
    cy = null;
    hoveredNodeId = null;
    pinnedNodeId = null;
    tipHovering = false;
    if (tip) {
      tip.removeEventListener("mouseenter", onTipEnter);
      tip.removeEventListener("mouseleave", onTipLeave);
      TOOLTIP_BOUNDARY_EVENTS.forEach((eventName) => {
        tip.removeEventListener(eventName, stopGraphGesture);
      });
      tip.remove();
      tip = null;
    }
  }

  return { destroy, refresh, scheduleHide, setLocale, show, togglePin };
}
