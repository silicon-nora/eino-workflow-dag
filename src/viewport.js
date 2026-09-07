/** Own pan constraints, zoom controls, wheel handling, and view synchronization. */
export function createViewportController(container, options) {
  const getCy = options.getCy;
  const overlay = options.overlay;
  const tooltip = options.tooltip;
  const minZoom = options.minZoom;
  const maxZoom = options.maxZoom;
  const fitPadding = options.fitPadding;
  const zoomStep = options.zoomStep;
  let lockingPan = false;
  let wheelHandler = null;

  function sync() {
    const cy = getCy();
    if (!cy) return;
    overlay.sync(cy);
    tooltip.refresh(cy);
  }

  function constrainPan() {
    const cy = getCy();
    if (!cy || lockingPan) return;
    const elements = cy.elements();
    if (!elements || elements.empty()) return;
    const bounds = elements.boundingBox({ includeLabels: false });
    if (!bounds || !Number.isFinite(bounds.x1) || !Number.isFinite(bounds.y1)) return;

    const zoom = cy.zoom();
    const pan = cy.pan();
    const width = cy.width();
    const height = cy.height();
    let minX = width * 0.75 - bounds.x2 * zoom;
    let maxX = width * 0.25 - bounds.x1 * zoom;
    let minY = height * 0.75 - bounds.y2 * zoom;
    let maxY = height * 0.25 - bounds.y1 * zoom;

    if (minX > maxX) minX = maxX = (minX + maxX) / 2;
    if (minY > maxY) minY = maxY = (minY + maxY) / 2;
    const x = Math.min(maxX, Math.max(minX, pan.x));
    const y = Math.min(maxY, Math.max(minY, pan.y));
    if (Math.abs(x - pan.x) <= 0.5 && Math.abs(y - pan.y) <= 0.5) return;
    lockingPan = true;
    cy.pan({ x, y });
    lockingPan = false;
  }

  function onViewport() {
    constrainPan();
    sync();
  }

  function clampZoom(level) {
    return Math.min(maxZoom, Math.max(minZoom, level));
  }

  function afterViewSettled() {
    const cy = getCy();
    if (!cy) return;
    const zoom = clampZoom(cy.zoom());
    if (Math.abs(zoom - cy.zoom()) > 1e-6) cy.zoom(zoom);
    constrainPan();
    sync();
  }

  function zoomBy(factor, renderedPosition) {
    const cy = getCy();
    if (!cy) return;
    const level = clampZoom(cy.zoom() * factor);
    if (Math.abs(level - cy.zoom()) < 1e-6) return;
    const position = renderedPosition || { x: cy.width() / 2, y: cy.height() / 2 };
    cy.zoom({ level, renderedPosition: position });
    constrainPan();
    sync();
  }

  function bind() {
    if (wheelHandler) return;
    wheelHandler = (event) => {
      if (!event.ctrlKey) return;
      event.preventDefault();
      const rect = container.getBoundingClientRect();
      zoomBy(event.deltaY < 0 ? zoomStep : 1 / zoomStep, {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      });
    };
    container.addEventListener("wheel", wheelHandler, { passive: false });
  }

  function resize({ fit = true } = {}) {
    const cy = getCy();
    if (!cy) return;
    cy.resize();
    if (fit) cy.fit(undefined, fitPadding);
    afterViewSettled();
  }

  function destroy() {
    if (wheelHandler) container.removeEventListener("wheel", wheelHandler);
    wheelHandler = null;
  }

  return {
    afterViewSettled,
    bind,
    destroy,
    onViewport,
    resetView: () => resize({ fit: true }),
    resize,
    sync,
    zoomIn: () => zoomBy(zoomStep),
    zoomOut: () => zoomBy(1 / zoomStep),
  };
}
