function edgeIsUnrun(edge) {
  if (!edge || edge.empty()) return false;
  const source = edge.source();
  const target = edge.target();
  return (
    (source.nonempty() && source.data("status") === "skipped") ||
    (target.nonempty() && target.data("status") === "skipped")
  );
}

/** Own edge draw order, skipped-state dimming, and one highlighted edge. */
export function createEdgeStateController(getCy) {
  let highlightedId = null;

  function applyDrawOrder() {
    const cy = getCy();
    if (!cy) return;
    const edges = cy.edges().toArray().map((edge) => {
      let source = edge.sourceEndpoint ? edge.sourceEndpoint() : edge.source().position();
      let target = edge.targetEndpoint ? edge.targetEndpoint() : edge.target().position();
      if (!source || source.x == null) source = edge.source().position();
      if (!target || target.x == null) target = edge.target().position();
      const length = Math.abs(target.x - source.x) + Math.abs(target.y - source.y);
      const level = edge.data("level");
      const critical = level != null ? (+level === 1 ? 0 : 1) : edge.data("main") ? 0 : 1;
      return { edge, critical, length };
    });
    edges.sort((a, b) => a.critical - b.critical || a.length - b.length);
    edges.forEach(({ edge }, index) => {
      edge.style("z-index", edge.hasClass("highlight") ? 9999 : index);
    });
  }

  function applyDefaultDim() {
    const cy = getCy();
    if (!cy) return;
    cy.edges().forEach((edge) => {
      if (edgeIsUnrun(edge)) edge.addClass("dimmed");
      else edge.removeClass("dimmed");
    });
  }

  function clear() {
    const cy = getCy();
    highlightedId = null;
    if (!cy) return;
    cy.edges().removeClass("highlight");
    applyDefaultDim();
    applyDrawOrder();
  }

  function set(edge) {
    const cy = getCy();
    if (!cy || !edge || edge.empty()) return;
    highlightedId = edge.id();
    cy.edges().removeClass("highlight");
    cy.edges().forEach((candidate) => {
      if (candidate.id() === highlightedId) {
        candidate.removeClass("dimmed").addClass("highlight");
      } else if (edgeIsUnrun(candidate)) {
        candidate.addClass("dimmed");
      } else {
        candidate.removeClass("dimmed");
      }
    });
    edge.style("z-index", 9999);
  }

  function refresh() {
    const cy = getCy();
    if (!cy) return;
    applyDrawOrder();
    if (!highlightedId) {
      applyDefaultDim();
      return;
    }
    const edge = cy.getElementById(highlightedId);
    if (edge.nonempty() && edge.isEdge()) set(edge);
    else clear();
  }

  return { clear, refresh, set };
}
