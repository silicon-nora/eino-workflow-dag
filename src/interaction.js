import { isExpandableCollapsed } from "./elements.js";

function eventData(element) {
  return { ...element.data() };
}

/** Bind Cytoscape pointer interactions and own their delayed expand timer. */
export function bindGraphInteractions(cy, container, handlers) {
  let expandTimer = null;
  let keyboardNodeId = null;
  const originalTabIndex = container.getAttribute("tabindex");
  const originalKeyShortcuts = container.getAttribute("aria-keyshortcuts");

  if (handlers.keyboardNavigation !== false) {
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
      return;
    }
    keyboardNodeId = node.id();
    node.addClass("keyboard-focus");
    handlers.tooltip.show(node);
  }

  function onKeyDown(event) {
    if (handlers.keyboardNavigation === false || event.target !== container) return;
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
    handlers.tooltip.show(node);
  });
  cy.on("mouseout", "node", (event) => {
    event.target.removeClass("hover");
    event.target.removeClass("press");
    container.style.cursor = "default";
    handlers.tooltip.scheduleHide();
  });
  cy.on("mousedown", "node", (event) => {
    const node = event.target;
    if (!node.isParent()) node.addClass("press");
  });
  cy.on("mouseup", () => cy.nodes(".press").removeClass("press"));
  cy.on("tap", "node", (event) => {
    const node = event.target;
    if (node.isParent()) return;
    handlers.onNodeClick(eventData(node));
    handlers.tooltip.togglePin(node);
    if (!isExpandableCollapsed(node)) return;
    node.addClass("press");
    const id = node.id();
    if (expandTimer) clearTimeout(expandTimer);
    expandTimer = setTimeout(() => {
      expandTimer = null;
      node.removeClass("press");
      handlers.togglePath(id);
    }, 90);
  });

  cy.on("mouseover", "edge", () => {
    container.style.cursor = "pointer";
  });
  cy.on("mouseout", "edge", () => {
    container.style.cursor = "default";
  });
  cy.on("tap", "edge", (event) => {
    const edge = event.target;
    handlers.onEdgeClick(eventData(edge));
    if (edge.hasClass("highlight")) handlers.clearEdgeHighlight();
    else handlers.setEdgeHighlight(edge);
  });
  cy.on("tap", (event) => {
    if (event.target === cy) handlers.clearEdgeHighlight();
  });
  cy.on("viewport", handlers.onViewport);

  return {
    destroy() {
      if (expandTimer) clearTimeout(expandTimer);
      expandTimer = null;
      container.removeEventListener("keydown", onKeyDown);
      cy.nodes(".keyboard-focus").removeClass("keyboard-focus");
      if (originalTabIndex == null) container.removeAttribute("tabindex");
      else container.setAttribute("tabindex", originalTabIndex);
      if (originalKeyShortcuts == null) container.removeAttribute("aria-keyshortcuts");
      else container.setAttribute("aria-keyshortcuts", originalKeyShortcuts);
    },
  };
}
