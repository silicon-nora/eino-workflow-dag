function findOrCreateHost(container) {
  if (!container) return { element: null, created: false };
  let host = null;
  for (const child of container.children) {
    if (child.classList.contains("cy-overlays")) {
      host = child;
      break;
    }
  }
  let created = false;
  if (!host) {
    host = document.createElement("div");
    host.className = "cy-overlays";
    container.appendChild(host);
    created = true;
  }
  return { element: host, created };
}

/** Manage reusable subgraph title buttons outside Cytoscape's canvas. */
export function createSubgraphOverlay(container, onToggle, options = {}) {
  const resolvedHost = findOrCreateHost(container);
  const host = resolvedHost.element;
  const buttons = new Map();
  let collapseSubgraphTitle =
    options.collapseSubgraphTitle || "Collapse subgraph";
  let currentCy = null;
  let frame = null;

  function removeButton(path) {
    const button = buttons.get(path);
    if (button) button.remove();
    buttons.delete(path);
  }

  function clear() {
    if (frame !== null && typeof cancelAnimationFrame === "function") {
      cancelAnimationFrame(frame);
    }
    frame = null;
    for (const path of buttons.keys()) removeButton(path);
  }

  function ensureButton(path) {
    let button = buttons.get(path);
    if (button) return button;
    button = document.createElement("button");
    button.type = "button";
    button.className = "cy-subgraph-title";
    button.title = collapseSubgraphTitle;
    button.dataset.path = path;
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      onToggle(button.dataset.path);
    });
    buttons.set(path, button);
    host.appendChild(button);
    return button;
  }

  function flush() {
    frame = null;
    const cy = currentCy;
    if (!cy || !host) return;

    const seen = new Set();
    const zoom = cy.zoom() || 1;
    const pad = 8 * zoom;
    cy.nodes(":parent").forEach((node) => {
      const bounds = node.renderedBoundingBox({
        includeLabels: false,
        includeOverlays: false,
      });
      if (!bounds || bounds.w < 8 || bounds.h < 8) return;

      const path = node.id();
      seen.add(path);
      const button = ensureButton(path);
      const label = `${node.data("title") || path} ▾`;
      if (button.textContent !== label) button.textContent = label;
      button.style.left = `${bounds.x1 + pad}px`;
      button.style.top = `${bounds.y1 + pad}px`;
      button.style.maxWidth = `${Math.max(24, bounds.w - pad * 2)}px`;
      button.style.maxHeight = `${Math.max(16, bounds.h - pad * 2)}px`;
      button.style.fontSize = `${15 * zoom}px`;
      button.style.padding = `${2 * zoom}px ${6 * zoom}px`;
      button.style.borderRadius = `${4 * zoom}px`;
    });

    for (const path of buttons.keys()) {
      if (!seen.has(path)) removeButton(path);
    }
  }

  function sync(cy) {
    currentCy = cy;
    if (!host || frame !== null) return;
    if (typeof requestAnimationFrame === "function") {
      frame = requestAnimationFrame(flush);
    } else {
      flush();
    }
  }

  function setCollapseSubgraphTitle(title) {
    collapseSubgraphTitle = title || "Collapse subgraph";
    for (const button of buttons.values()) button.title = collapseSubgraphTitle;
  }

  function destroy() {
    clear();
    currentCy = null;
    if (resolvedHost.created && host) host.remove();
  }

  return { clear, destroy, setCollapseSubgraphTitle, sync };
}
