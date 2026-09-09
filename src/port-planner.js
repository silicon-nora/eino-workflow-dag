import {
  clampSideToAllowed,
  defaultAxisProfile,
  profileCrossSidesBySign,
  profileIsCrossSide,
} from "./axis-profile.js";
import { createKeyMap, hasOwnKey } from "./key-map.js";
import { edgeLevel } from "./routing-context.js";

export const SAME_ROW_TOL = 48;

function centerDelta(source, target) {
  return {
    x: target.x + target.width / 2 - (source.x + source.width / 2),
    y: target.y + target.height / 2 - (source.y + source.height / 2),
  };
}

export function pickOutSideByGeometry(source, target, profile) {
  const resolved = profile || defaultAxisProfile();
  const delta = centerDelta(source, target);
  const axisDelta = resolved.axis === "y" ? delta.y : delta.x;
  const crossDelta = resolved.cross === "x" ? delta.x : delta.y;
  const crossPair = profileCrossSidesBySign(resolved);
  const crossSide = crossDelta >= 0 ? crossPair.pos : crossPair.neg;
  const sign = typeof resolved.forwardSign === "number" ? resolved.forwardSign : 1;
  const picked =
    Math.abs(axisDelta) >= Math.abs(crossDelta) && axisDelta * sign >= 0
      ? resolved.outSide
      : crossSide;

  return clampSideToAllowed(
    picked,
    resolved.outSides,
    resolved.outSide,
  );
}

export function pickInSideByGeometry(source, target, profile) {
  const resolved = profile || defaultAxisProfile();
  const delta = centerDelta(target, source);
  const axisDelta = resolved.axis === "y" ? delta.y : delta.x;
  const crossDelta = resolved.cross === "x" ? delta.x : delta.y;
  const crossPair = profileCrossSidesBySign(resolved);
  const crossSide = crossDelta >= 0 ? crossPair.pos : crossPair.neg;
  const sign = typeof resolved.forwardSign === "number" ? resolved.forwardSign : 1;
  const picked =
    Math.abs(axisDelta) >= Math.abs(crossDelta) && axisDelta * sign <= 0
      ? resolved.inSide
      : crossSide;

  return clampSideToAllowed(
    picked,
    resolved.inSides,
    resolved.inSide,
  );
}

export function crossSideTowardTarget(source, target, profile) {
  if (!source || !target) return null;
  const resolved = profile || defaultAxisProfile();
  const delta = centerDelta(source, target);
  const crossDelta = resolved.cross === "x" ? delta.x : delta.y;
  if (!Number.isFinite(crossDelta) || Math.abs(crossDelta) < SAME_ROW_TOL) {
    return null;
  }
  const pair = profileCrossSidesBySign(resolved);
  return crossDelta > 0 ? pair.pos : pair.neg;
}

export function bumpPortSideUse(occupancy, nodeId, side) {
  if (!nodeId || !side) return;
  if (!hasOwnKey(occupancy, nodeId)) {
    Object.defineProperty(occupancy, nodeId, {
      configurable: true,
      enumerable: true,
      value: createKeyMap(),
      writable: true,
    });
  }
  occupancy[nodeId][side] = (occupancy[nodeId][side] || 0) + 1;
}

export function portSideUseCount(occupancy, nodeId, side) {
  if (!side || !hasOwnKey(occupancy, nodeId) || !occupancy[nodeId]) return 0;
  return occupancy[nodeId][side] || 0;
}

export function orderSidesByOccupancy(sides, occupancy, nodeId, preferred) {
  return (sides || []).slice().sort((left, right) => {
    const leftCount = portSideUseCount(occupancy, nodeId, left);
    const rightCount = portSideUseCount(occupancy, nodeId, right);
    if (leftCount !== rightCount) return leftCount - rightCount;
    if (preferred) {
      if (left === preferred && right !== preferred) return -1;
      if (right === preferred && left !== preferred) return 1;
    }
    return String(left).localeCompare(String(right));
  });
}

export function pickSidePreferringFree(
  geometrySide,
  allowed,
  occupancy,
  nodeId,
  preferredForward,
  preferredCross,
) {
  const ordered = orderSidesByOccupancy(
    allowed,
    occupancy,
    nodeId,
    preferredForward,
  );
  if (!ordered.length) return geometrySide || preferredForward;

  const minimumLoad = portSideUseCount(occupancy, nodeId, ordered[0]);
  if (
    geometrySide &&
    allowed.includes(geometrySide) &&
    portSideUseCount(occupancy, nodeId, geometrySide) <= minimumLoad
  ) {
    return geometrySide;
  }
  if (preferredCross && allowed.includes(preferredCross)) {
    const crossLoad = portSideUseCount(occupancy, nodeId, preferredCross);
    if (crossLoad <= minimumLoad + 1) return preferredCross;
  }
  return ordered[0];
}

function crossCenterDistance(left, right, profile) {
  if (!left || !right) return Infinity;
  const leftCenter =
    profile.cross === "x" ? left.x + left.width / 2 : left.y + left.height / 2;
  const rightCenter =
    profile.cross === "x"
      ? right.x + right.width / 2
      : right.y + right.height / 2;
  return Math.abs(leftCenter - rightCenter);
}

export function isSameCrossRow(left, right, profile, tolerance) {
  if (!left || !right) return false;
  const limit = tolerance == null ? SAME_ROW_TOL : tolerance;
  return crossCenterDistance(left, right, profile) <= limit;
}

function claimIfEmpty(owners, key, edge) {
  if (key && !hasOwnKey(owners, key)) owners[key] = edge;
}

export function claimPreferredPortOwners(edges, boxes, profile) {
  const inOwner = createKeyMap();
  const outOwner = createKeyMap();
  const ordered = (edges || []).slice().sort((left, right) => {
    const levelDelta = edgeLevel(left) - edgeLevel(right);
    if (levelDelta) return levelDelta;
    const leftSource = hasOwnKey(boxes, left.source) ? boxes[left.source] : null;
    const leftTarget = hasOwnKey(boxes, left.target) ? boxes[left.target] : null;
    const rightSource = hasOwnKey(boxes, right.source) ? boxes[right.source] : null;
    const rightTarget = hasOwnKey(boxes, right.target) ? boxes[right.target] : null;
    return (
      crossCenterDistance(leftSource, leftTarget, profile) -
      crossCenterDistance(rightSource, rightTarget, profile)
    );
  });
  for (const edge of ordered) {
    claimIfEmpty(outOwner, edge.source, edge);
    claimIfEmpty(inOwner, edge.target, edge);
  }
  return { inOwner, outOwner };
}

export function exclusiveSideChoices(
  edge,
  nodeId,
  ownerMap,
  forwardSide,
  facingCross,
  profile,
  alreadyTaken,
  shareForward,
) {
  const owner = hasOwnKey(ownerMap, nodeId) ? ownerMap[nodeId] : null;
  if (shareForward) return [forwardSide];
  if (alreadyTaken) {
    if (facingCross && profileIsCrossSide(profile, facingCross)) {
      return [facingCross];
    }
    return (profile.crossSides || []).slice();
  }
  if (owner && owner !== edge) {
    const choices = [forwardSide];
    if (facingCross && profileIsCrossSide(profile, facingCross)) {
      choices.push(facingCross);
    }
    for (const side of profile.crossSides || []) {
      if (!choices.includes(side)) choices.push(side);
    }
    return choices;
  }
  return [forwardSide];
}

function candidateSideRank(candidate, profile) {
  let rank = 0;
  if (candidate.outSide && candidate.outSide === profile.outSide) rank -= 2;
  if (candidate.inSide && candidate.inSide === profile.inSide) rank -= 2;
  if (candidate.outSide && profileIsCrossSide(profile, candidate.outSide)) rank += 1;
  if (candidate.inSide && profileIsCrossSide(profile, candidate.inSide)) rank += 1;
  return rank;
}

export function selectBestPortCandidate(candidates, profile) {
  const zeroCrossings = candidates.filter((candidate) => candidate.crossings === 0);
  const pool = zeroCrossings.length ? zeroCrossings : candidates;
  let best = null;

  for (const candidate of pool) {
    if (!best) {
      best = candidate;
      continue;
    }
    const fields = ["geoWrong"];
    let decided = false;
    for (const field of fields) {
      if (candidate[field] < best[field]) {
        best = candidate;
        decided = true;
        break;
      }
      if (candidate[field] > best[field]) {
        decided = true;
        break;
      }
    }
    if (decided) continue;

    const candidateRank = candidateSideRank(candidate, profile);
    const bestRank = candidateSideRank(best, profile);
    if (candidateRank < bestRank) {
      best = candidate;
      continue;
    }
    if (candidateRank > bestRank) continue;
    const preferenceFields = ["sideLoad", "bends"];
    for (const field of preferenceFields) {
      if (candidate[field] < best[field]) {
        best = candidate;
        decided = true;
        break;
      }
      if (candidate[field] > best[field]) {
        decided = true;
        break;
      }
    }
    if (decided) continue;
    if (candidate.crossings < best.crossings) {
      best = candidate;
      continue;
    }
    if (candidate.crossings > best.crossings) continue;
    if (candidate.score < best.score) best = candidate;
  }

  return best;
}
