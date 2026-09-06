function escapeXML(value) {
  return String(value ?? "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, "\uFFFD")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function finiteNumber(value, fallback = 0) {
  const parsed = typeof value === "number" ? value : Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function styleValue(element, name, fallback) {
  const value = element?.style?.(name);
  return value == null || value === "" ? fallback : value;
}

function collectionItems(collection) {
  if (!collection) return [];
  if (typeof collection.toArray === "function") return collection.toArray();
  return Array.from(collection);
}

function normalizedBounds(cy, full) {
  const raw =
    full === false
      ? cy.extent()
      : cy.elements().boundingBox({
          includeLabels: true,
          includeOverlays: false,
          includeUnderlays: false,
        });
  const x = finiteNumber(raw?.x1 ?? raw?.x, 0);
  const y = finiteNumber(raw?.y1 ?? raw?.y, 0);
  const width = Math.max(1, finiteNumber(raw?.w, finiteNumber(raw?.x2, x + 1) - x));
  const height = Math.max(1, finiteNumber(raw?.h, finiteNumber(raw?.y2, y + 1) - y));
  return { x, y, width, height };
}

function dashPattern(element, lineStyle) {
  if (lineStyle === "solid") return null;
  const raw = String(styleValue(element, "line-dash-pattern", ""))
    .replaceAll("px", "")
    .trim();
  if (raw) return raw;
  return lineStyle === "dotted" ? "1 3" : "7 4";
}

function nodeShape(node, bounds) {
  const shape = String(styleValue(node, "shape", "round-rectangle"));
  const fill = escapeXML(styleValue(node, "background-color", "#ffffff"));
  const stroke = escapeXML(styleValue(node, "border-color", "#5c6b7a"));
  const strokeWidth = finiteNumber(styleValue(node, "border-width", 1), 1);
  const opacity = finiteNumber(styleValue(node, "opacity", 1), 1);
  const fillOpacity = finiteNumber(styleValue(node, "background-opacity", 1), 1);
  const borderStyle = String(styleValue(node, "border-style", "solid"));
  const common = `fill="${fill}" fill-opacity="${fillOpacity}" stroke="${stroke}" stroke-width="${strokeWidth}" opacity="${opacity}"`;
  const dash = borderStyle === "dashed" ? ' stroke-dasharray="7 4"' : "";
  const cx = bounds.x + bounds.width / 2;
  const cy = bounds.y + bounds.height / 2;

  if (shape === "ellipse") {
    return `<ellipse cx="${cx}" cy="${cy}" rx="${bounds.width / 2}" ry="${bounds.height / 2}" ${common}${dash}/>`;
  }
  if (shape === "diamond") {
    const points = `${cx},${bounds.y} ${bounds.x + bounds.width},${cy} ${cx},${bounds.y + bounds.height} ${bounds.x},${cy}`;
    return `<polygon points="${points}" ${common}${dash}/>`;
  }
  const radius = shape.includes("round")
    ? Math.max(0, finiteNumber(styleValue(node, "corner-radius", 8), 8))
    : 0;
  return `<rect x="${bounds.x}" y="${bounds.y}" width="${bounds.width}" height="${bounds.height}" rx="${radius}" ry="${radius}" ${common}${dash}/>`;
}

function nodeLabel(node, bounds) {
  const label = node?.data?.("label");
  if (!label) return "";
  const lines = String(label).split(/\r?\n/);
  const fontSize = finiteNumber(styleValue(node, "font-size", 16), 16);
  const lineHeight = fontSize * 1.25;
  const startY = bounds.y + bounds.height / 2 - ((lines.length - 1) * lineHeight) / 2;
  const fill = escapeXML(styleValue(node, "color", "#1a2332"));
  const family = escapeXML(styleValue(node, "font-family", "sans-serif"));
  const weight = escapeXML(styleValue(node, "font-weight", 500));
  const opacity = finiteNumber(styleValue(node, "text-opacity", 1), 1);
  const outlineWidth = finiteNumber(styleValue(node, "text-outline-width", 0), 0);
  const outline = escapeXML(styleValue(node, "text-outline-color", "transparent"));
  const outlineAttrs = outlineWidth > 0
    ? ` paint-order="stroke" stroke="${outline}" stroke-width="${outlineWidth * 2}" stroke-linejoin="round"`
    : "";
  const x = bounds.x + bounds.width / 2;
  const spans = lines
    .map(
      (line, index) =>
        `<tspan x="${x}" y="${startY + index * lineHeight}">${escapeXML(line)}</tspan>`,
    )
    .join("");
  return `<text text-anchor="middle" dominant-baseline="middle" font-family="${family}" font-size="${fontSize}" font-weight="${weight}" fill="${fill}" opacity="${opacity}"${outlineAttrs}>${spans}</text>`;
}

function renderNode(node) {
  const bounds = node.boundingBox({
    includeLabels: false,
    includeOverlays: false,
    includeUnderlays: false,
  });
  const normalized = {
    x: finiteNumber(bounds.x1 ?? bounds.x),
    y: finiteNumber(bounds.y1 ?? bounds.y),
    width: Math.max(1, finiteNumber(bounds.w, 1)),
    height: Math.max(1, finiteNumber(bounds.h, 1)),
  };
  return `<g data-element-id="${escapeXML(node.id())}">${nodeShape(node, normalized)}${nodeLabel(node, normalized)}</g>`;
}

function routePoints(edge) {
  const stored = edge.scratch?.("einoWorkflowDAG")?._flowAbsRoute;
  const points = Array.isArray(stored) ? stored : [];
  const valid = points.filter(
    (point) => Number.isFinite(point?.x) && Number.isFinite(point?.y),
  );
  if (valid.length >= 2) return valid;
  const source = edge.source?.().position?.();
  const target = edge.target?.().position?.();
  return source && target ? [source, target] : [];
}

function arrowPolygon(points, size) {
  if (points.length < 2) return "";
  const tip = points[points.length - 1];
  let previous = points[points.length - 2];
  for (let index = points.length - 2; index >= 0; index -= 1) {
    previous = points[index];
    if (Math.hypot(tip.x - previous.x, tip.y - previous.y) > 0.01) break;
  }
  const dx = tip.x - previous.x;
  const dy = tip.y - previous.y;
  const length = Math.hypot(dx, dy);
  if (length < 0.01) return "";
  const ux = dx / length;
  const uy = dy / length;
  const baseX = tip.x - ux * size;
  const baseY = tip.y - uy * size;
  const half = size * 0.55;
  return `${tip.x},${tip.y} ${baseX - uy * half},${baseY + ux * half} ${baseX + uy * half},${baseY - ux * half}`;
}

function renderEdge(edge) {
  const points = routePoints(edge);
  if (points.length < 2) return "";
  const color = escapeXML(styleValue(edge, "line-color", "#4a5d72"));
  const arrowColor = escapeXML(styleValue(edge, "target-arrow-color", color));
  const width = Math.max(0.25, finiteNumber(styleValue(edge, "width", 1.75), 1.75));
  const opacity = finiteNumber(styleValue(edge, "opacity", 1), 1);
  const lineStyle = String(styleValue(edge, "line-style", "solid"));
  const dash = dashPattern(edge, lineStyle);
  const arrowScale = Math.max(0.25, finiteNumber(styleValue(edge, "arrow-scale", 1), 1));
  const serializedPoints = points.map((point) => `${point.x},${point.y}`).join(" ");
  const dashAttribute = dash ? ` stroke-dasharray="${escapeXML(dash)}"` : "";
  const triangle = arrowPolygon(points, Math.max(6, 7 * arrowScale + width));
  const arrow = triangle
    ? `<polygon points="${triangle}" fill="${arrowColor}" opacity="${opacity}"/>`
    : "";
  return `<g data-element-id="${escapeXML(edge.id())}"><polyline points="${serializedPoints}" fill="none" stroke="${color}" stroke-width="${width}" opacity="${opacity}" stroke-linecap="round" stroke-linejoin="round"${dashAttribute}/>${arrow}</g>`;
}

export function serializeWorkflowDAGSVG(cy, options = {}) {
  if (!cy || typeof cy.nodes !== "function" || typeof cy.edges !== "function") {
    throw new TypeError("A Cytoscape instance is required");
  }
  const bounds = normalizedBounds(cy, options.full);
  const padding = Math.max(0, finiteNumber(options.padding, 24));
  const view = {
    x: bounds.x - padding,
    y: bounds.y - padding,
    width: bounds.width + padding * 2,
    height: bounds.height + padding * 2,
  };
  let scale = Math.max(0.01, finiteNumber(options.scale, 1));
  if (options.maxWidth != null) {
    scale = Math.min(scale, finiteNumber(options.maxWidth, view.width) / view.width);
  }
  if (options.maxHeight != null) {
    scale = Math.min(scale, finiteNumber(options.maxHeight, view.height) / view.height);
  }
  scale = Math.max(0.01, scale);
  const width = view.width * scale;
  const height = view.height * scale;
  const background = options.background;
  const backgroundRect =
    background == null || background === "transparent"
      ? ""
      : `<rect x="${view.x}" y="${view.y}" width="${view.width}" height="${view.height}" fill="${escapeXML(background)}"/>`;

  const nodes = collectionItems(cy.nodes());
  const parents = nodes.filter((node) => node.isParent?.());
  const leaves = nodes.filter((node) => !node.isParent?.());
  const edges = collectionItems(cy.edges());
  const content = [
    ...parents.map(renderNode),
    ...edges.map(renderEdge),
    ...leaves.map(renderNode),
  ].join("");

  return `<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${view.x} ${view.y} ${view.width} ${view.height}" role="img">${backgroundRect}${content}</svg>`;
}

export function exportWorkflowDAGSVG(cy, options = {}) {
  return Promise.resolve().then(() => {
    const content = serializeWorkflowDAGSVG(cy, options);
    return new Blob([content], { type: "image/svg+xml;charset=utf-8" });
  });
}
