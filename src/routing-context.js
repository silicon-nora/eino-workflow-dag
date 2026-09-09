function normalizedLevel(value) {
  const level = Number(value);
  return Number.isInteger(level) && level >= 0 ? level : 0;
}

export function nodeIsParent(node) {
  if (!node) return false;
  if (typeof node._isParent === "boolean") return node._isParent;
  return !!(node._cyEle && node._cyEle.isParent());
}

export function nodeIsGraphWrapper(node) {
  if (!nodeIsParent(node)) return false;
  if (typeof node._isGraphWrapper === "boolean") return node._isGraphWrapper;
  return !!(
    node._cyEle &&
    (node._cyEle.data("subgraph") || node._cyEle.data("expandable"))
  );
}

export function nodeLevel(node) {
  if (!node) return 0;
  if (node._level !== undefined) return normalizedLevel(node._level);
  return normalizedLevel(node._cyEle && node._cyEle.data("level"));
}

export function nodeAncestorIds(node) {
  if (!node) return [];
  if (Array.isArray(node._ancestorIds)) return node._ancestorIds.slice();
  const result = [];
  let parent = node._cyEle ? node._cyEle.parent() : null;
  while (parent && parent.nonempty()) {
    result.push(parent.id());
    parent = parent.parent();
  }
  return result;
}

export function nodeDescendantIds(node) {
  if (!node) return [];
  if (Array.isArray(node._descendantIds)) return node._descendantIds.slice();
  const element = node._cyEle;
  if (!element || typeof element.descendants !== "function") return [];
  const result = [];
  element.descendants().forEach((descendant) => {
    if (descendant && typeof descendant.id === "function") {
      result.push(descendant.id());
    }
  });
  return result;
}

export function edgeLevel(edge) {
  if (!edge) return 0;
  if (edge._level !== undefined) return normalizedLevel(edge._level);
  return normalizedLevel(edge._cyEle && edge._cyEle.data("level"));
}
