import { isExpandableCollapsed } from "./elements.js";

const INTERACTION_DEFAULTS = Object.freeze({
  expandOnNodeClick: true,
  tooltipOnHover: true,
  pinTooltipOnNodeClick: true,
  highlightEdgeOnClick: true,
  clearHighlightOnCanvasClick: true,
  keyboardNavigation: true,
  panOnDrag: true,
  zoomOnCtrlWheel: true,
});

/** Resolve the public interaction policy, including the two pre-policy aliases. */
export function resolveInteractionPolicy(options = {}) {
  const source = options.interaction == null ? {} : options.interaction;
  if (!source || typeof source !== "object" || Array.isArray(source)) {
    throw new TypeError("interaction must be an object");
  }
  const resolved = { ...INTERACTION_DEFAULTS };
  for (const key of Object.keys(source)) {
    if (!Object.prototype.hasOwnProperty.call(INTERACTION_DEFAULTS, key)) {
      throw new TypeError(`interaction.${key} is not supported`);
    }
    if (typeof source[key] !== "boolean") {
      throw new TypeError(`interaction.${key} must be a boolean`);
    }
    resolved[key] = source[key];
  }
  if (
    !Object.prototype.hasOwnProperty.call(source, "pinTooltipOnNodeClick") &&
    options.pinNodeTip !== undefined
  ) {
    resolved.pinTooltipOnNodeClick = options.pinNodeTip !== false;
  }
  if (
    !Object.prototype.hasOwnProperty.call(source, "keyboardNavigation") &&
    options.keyboardNavigation !== undefined
  ) {
    resolved.keyboardNavigation = options.keyboardNavigation !== false;
  }
  return resolved;
}

function eventData(element) {
  return { ...element.data() };
}

/** Bind Cytoscape pointer interactions and own their delayed expand timer. */
export function bindGraphInteractions(cy, container, handlers) {
  let expandTimer = null;
  let keyboardNodeId = null;
  let viewportGestureActive = false;
  let viewportGestureChanged = false;
  const originalTabIndex = container.getAttribute("tabindex");
  const originalKeyShortcuts = container.getAttribute("aria-keyshortcuts");
  const originalCursor = {
    value: container.style.getPropertyValue("cursor"),
    priority: container.style.getPropertyPriority("cursor"),
  };

  function restoreCursor() {
    if (originalCursor.value) {
      container.style.setProperty(
        "cursor",
        originalCursor.value,
        originalCursor.priority,
      );
    } else {
      container.style.removeProperty("cursor");
    }
  }

  function onViewportGestureStart(event) {
    viewportGestureActive =
      event.target === cy ||
      (typeof event.target?.pannable === "function" && event.target.pannable());
    viewportGestureChanged = false;
  }

  function onViewportGestureEnd() {
    if (viewportGestureActive && viewportGestureChanged) {
      handlers.onViewportGestureEnd();
    }
    viewportGestureActive = false;
    viewportGestureChanged = false;
  }

  function onViewport(event) {
    if (viewportGestureActive) viewportGestureChanged = true;
    handlers.onViewport(event);
  }

  if (handlers.policy.keyboardNavigation) {
    if (originalTabIndex == null) container.setAttribute("tabindex", "0");
    container.setAttribute(
      "aria-keyshortcuts",
      "ArrowRight ArrowLeft ArrowDown ArrowUp Home End Enter Space Escape",
    );
  }

  function keyboardNodes() {
    return cy
      .nodes()
      .filter((node) => !node.isParent())
      .toArray()
      .sort((left, right) => {
        const a = left.position();
        const b = right.position();
        return a.x - b.x || a.y - b.y || left.id().localeCompare(right.id());
      });
  }

  function focusKeyboardNode(node) {
    cy.nodes(".keyboard-focus").removeClass("keyboard-focus");
    if (!node || node.empty()) {
      keyboardNodeId = null;
      handlers.tooltip.scheduleHide();
      if (handlers.onKeyboardFocus) handlers.onKeyboardFocus(null);
      return;
    }
    keyboardNodeId = node.id();
    node.addClass("keyboard-focus");
    handlers.tooltip.show(node);
    if (handlers.onKeyboardFocus) handlers.onKeyboardFocus(eventData(node));
  }

  function onKeyDown(event) {
    if (!handlers.policy.keyboardNavigation || event.target !== container) return;
    const nodes = keyboardNodes();
    if (!nodes.length) return;
    let index = nodes.findIndex((node) => node.id() === keyboardNodeId);
    const key = event.key;

    if (key === "Home") index = 0;
    else if (key === "End") index = nodes.length - 1;
    else if (key === "ArrowRight" || key === "ArrowDown") {
      index = index < 0 ? 0 : (index + 1) % nodes.length;
    } else if (key === "ArrowLeft" || key === "ArrowUp") {
      index = index < 0 ? nodes.length - 1 : (index - 1 + nodes.length) % nodes.length;
    } else if (key === "Enter" || key === " ") {
      const active = index >= 0 ? nodes[index] : nodes[0];
      focusKeyboardNode(active);
      active.emit("tap");
      event.preventDefault();
      return;
    } else if (key === "Escape") {
      focusKeyboardNode(null);
      event.preventDefault();
      return;
    } else {
      return;
    }

    focusKeyboardNode(nodes[index]);
    event.preventDefault();
  }

  container.addEventListener("keydown", onKeyDown);

  cy.on("mouseover", "node", (event) => {
    const node = event.target;
    if (node.isParent()) return;
    cy.nodes(".hover").removeClass("hover");
    node.addClass("hover");
    container.style.cursor = "pointer";
    if (handlers.policy.tooltipOnHover) handlers.tooltip.show(node);
  });
  cy.on("mouseout", "node", (event) => {
    event.target.removeClass("hover");
    event.target.removeClass("press");
    restoreCursor();
    if (handlers.policy.tooltipOnHover) handlers.tooltip.scheduleHide();
  });
  cy.on("mousedown", "node", (event) => {
    const node = event.target;
    if (!node.isParent()) node.addClass("press");
  });
  cy.on("mouseup", () => cy.nodes(".press").removeClass("press"));
  cy.on("tapstart", onViewportGestureStart);
  cy.on("tapend", onViewportGestureEnd);
  cy.on("tap", "node", (event) => {
    const node = event.target;
    if (node.isParent()) return;
    if (handlers.policy.pinTooltipOnNodeClick) handlers.tooltip.togglePin(node);
    if (handlers.policy.expandOnNodeClick && isExpandableCollapsed(node)) {
      node.addClass("press");
      const id = node.id();
      if (expandTimer) clearTimeout(expandTimer);
      expandTimer = setTimeout(() => {
        expandTimer = null;
        node.removeClass("press");
        handlers.togglePath(id);
      }, 90);
    }
    handlers.onNodeClick(eventData(node));
  });

  cy.on("mouseover", "edge", () => {
    container.style.cursor = "pointer";
  });
  cy.on("mouseout", "edge", () => {
    restoreCursor();
  });
  cy.on("tap", "edge", (event) => {
    const edge = event.target;
    if (handlers.policy.highlightEdgeOnClick) {
      if (edge.hasClass("highlight")) handlers.clearEdgeHighlight();
      else handlers.setEdgeHighlight(edge);
    }
    handlers.onEdgeClick(eventData(edge));
  });
  cy.on("tap", (event) => {
    if (event.target === cy && handlers.policy.clearHighlightOnCanvasClick) {
      handlers.clearEdgeHighlight();
    }
  });
  cy.on("viewport", onViewport);

  return {
    refreshKeyboardFocus() {
      if (!keyboardNodeId) return;
      focusKeyboardNode(cy.getElementById(keyboardNodeId));
    },
    destroy() {
      if (expandTimer) clearTimeout(expandTimer);
      expandTimer = null;
      container.removeEventListener("keydown", onKeyDown);
      restoreCursor();
      cy.nodes(".keyboard-focus").removeClass("keyboard-focus");
      if (originalTabIndex == null) container.removeAttribute("tabindex");
      else container.setAttribute("tabindex", originalTabIndex);
      if (originalKeyShortcuts == null) container.removeAttribute("aria-keyshortcuts");
      else container.setAttribute("aria-keyshortcuts", originalKeyShortcuts);
    },
  };
}
