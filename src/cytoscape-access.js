const CYTOSCAPE_ACCESS = Symbol.for("eino-workflow-dag.cytoscape");

export function attachCytoscapeAccess(instance, getter) {
  Object.defineProperty(instance, CYTOSCAPE_ACCESS, {
    configurable: false,
    enumerable: false,
    value: getter,
    writable: false,
  });
  return instance;
}

export function readCytoscapeAccess(instance) {
  const getter = instance?.[CYTOSCAPE_ACCESS];
  if (typeof getter !== "function") {
    throw new TypeError("Expected an eino-workflow-dag instance");
  }
  return getter();
}
