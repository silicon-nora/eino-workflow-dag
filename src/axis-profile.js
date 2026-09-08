const DAG_DIRECTIONS = new Set(["RIGHT", "LEFT", "DOWN", "UP"]);

export function normalizeDirection(direction) {
  return typeof direction === "string" && DAG_DIRECTIONS.has(direction)
    ? direction
    : "RIGHT";
}

export function axisProfile(direction) {
  const normalized = normalizeDirection(direction);
  let outSide;
  let inSide;
  let axis;
  let cross;
  let crossSides;
  let forwardSign;

  if (normalized === "LEFT") {
    outSide = "WEST";
    inSide = "EAST";
    axis = "x";
    cross = "y";
    crossSides = ["NORTH", "SOUTH"];
    forwardSign = -1;
  } else if (normalized === "DOWN") {
    outSide = "SOUTH";
    inSide = "NORTH";
    axis = "y";
    cross = "x";
    crossSides = ["EAST", "WEST"];
    forwardSign = 1;
  } else if (normalized === "UP") {
    outSide = "NORTH";
    inSide = "SOUTH";
    axis = "y";
    cross = "x";
    crossSides = ["EAST", "WEST"];
    forwardSign = -1;
  } else {
    outSide = "EAST";
    inSide = "WEST";
    axis = "x";
    cross = "y";
    crossSides = ["NORTH", "SOUTH"];
    forwardSign = 1;
  }

  return {
    direction: normalized,
    outSide,
    inSide,
    axis,
    cross,
    crossSides: crossSides.slice(),
    outSides: [outSide].concat(crossSides),
    inSides: [inSide].concat(crossSides),
    forwardSign,
  };
}

export function profileCrossSidesBySign(profile) {
  return profile && profile.cross === "x"
    ? { pos: "EAST", neg: "WEST" }
    : { pos: "SOUTH", neg: "NORTH" };
}

export function clampSideToAllowed(side, allowed, fallback) {
  const list = allowed || [];
  return list.includes(side) ? side : fallback || list[0] || side;
}

export function profileIsCrossSide(profile, side) {
  return !!(profile && side && (profile.crossSides || []).includes(side));
}

export function defaultAxisProfile() {
  return axisProfile("RIGHT");
}

export function resolveGraphProfile(graph) {
  if (graph && graph._axisProfile) return graph._axisProfile;
  if (typeof console !== "undefined" && console.warn) {
    console.warn("[eino-workflow-dag] graph._axisProfile missing; fallback RIGHT");
  }
  return defaultAxisProfile();
}
