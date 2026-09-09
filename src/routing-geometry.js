const ORTHO_JOG_TOLERANCE = 14;
const ORTHO_SNAP_TOLERANCE = 0.75;
const A_STAR_BEND_COST = 20;
const A_STAR_MAX_EXPANSIONS = 30000;

function almostEqual(left, right, tolerance) {
  return Math.abs(left - right) <= tolerance;
}

export function removeDuplicatePoints(points, tolerance) {
  if (!points || !points.length) return points || [];
  const result = [points[0]];
  for (let index = 1; index < points.length; index += 1) {
    const previous = result[result.length - 1];
    if (
      !almostEqual(previous.x, points[index].x, tolerance) ||
      !almostEqual(previous.y, points[index].y, tolerance)
    ) {
      result.push(points[index]);
    }
  }
  return result;
}

function removeCollinearOrthogonalPoints(points, tolerance) {
  if (points.length < 3) return points;
  const result = [points[0]];
  for (let index = 1; index < points.length - 1; index += 1) {
    const previous = result[result.length - 1];
    const current = points[index];
    const next = points[index + 1];
    const horizontal =
      almostEqual(previous.y, current.y, tolerance) &&
      almostEqual(current.y, next.y, tolerance);
    const vertical =
      almostEqual(previous.x, current.x, tolerance) &&
      almostEqual(current.x, next.x, tolerance);
    if (!horizontal && !vertical) result.push(current);
  }
  result.push(points[points.length - 1]);
  return result;
}

function removeMicroJogs(points, jogTolerance, snapTolerance) {
  if (points.length < 4) return points;
  const work = points.map((point) => ({ x: point.x, y: point.y }));
  const result = [work[0]];
  let index = 1;
  while (index < work.length - 1) {
    const previous = result[result.length - 1];
    const current = work[index];
    const next = work[index + 1];
    const firstX = current.x - previous.x;
    const firstY = current.y - previous.y;
    const secondX = next.x - current.x;
    const secondY = next.y - current.y;
    const secondLength = Math.abs(secondX) + Math.abs(secondY);
    const horizontalThenVertical =
      almostEqual(firstY, 0, snapTolerance) &&
      almostEqual(secondX, 0, snapTolerance);
    const verticalThenHorizontal =
      almostEqual(firstX, 0, snapTolerance) &&
      almostEqual(secondY, 0, snapTolerance);
    if (secondLength > 0 && secondLength < jogTolerance && index + 2 < work.length) {
      const after = work[index + 2];
      if (horizontalThenVertical && almostEqual(after.y, next.y, snapTolerance)) {
        result.push({ x: next.x, y: previous.y });
        work[index + 2] = { x: after.x, y: previous.y };
        index += 2;
        continue;
      }
      if (verticalThenHorizontal && almostEqual(after.x, next.x, snapTolerance)) {
        result.push({ x: previous.x, y: next.y });
        work[index + 2] = { x: previous.x, y: after.y };
        index += 2;
        continue;
      }
    }
    result.push(current);
    index += 1;
  }
  result.push(work[work.length - 1]);
  return removeDuplicatePoints(result, snapTolerance);
}

function snapAdjacentOrthogonalPoints(points, tolerance) {
  const result = points.map((point) => ({ x: point.x, y: point.y }));
  for (let index = 1; index < result.length; index += 1) {
    if (Math.abs(result[index].x - result[index - 1].x) <= tolerance) {
      result[index].x = result[index - 1].x;
    }
    if (Math.abs(result[index].y - result[index - 1].y) <= tolerance) {
      result[index].y = result[index - 1].y;
    }
  }
  return result;
}

export function simplifyOrthogonalPoints(points) {
  let result = (points || []).map((point) => ({ x: point.x, y: point.y }));
  for (let pass = 0; pass < 3; pass += 1) {
    result = snapAdjacentOrthogonalPoints(result, ORTHO_SNAP_TOLERANCE);
    result = removeDuplicatePoints(result, ORTHO_SNAP_TOLERANCE);
    result = removeCollinearOrthogonalPoints(result, ORTHO_SNAP_TOLERANCE);
    result = removeMicroJogs(
      result,
      ORTHO_JOG_TOLERANCE,
      ORTHO_SNAP_TOLERANCE,
    );
    result = removeDuplicatePoints(result, ORTHO_SNAP_TOLERANCE);
    result = removeCollinearOrthogonalPoints(result, ORTHO_SNAP_TOLERANCE);
  }
  return result;
}

export function orthogonalSegmentHitsRectInterior(
  x1,
  y1,
  x2,
  y2,
  rectX,
  rectY,
  rectWidth,
  rectHeight,
) {
  const minX = rectX;
  const maxX = rectX + rectWidth;
  const minY = rectY;
  const maxY = rectY + rectHeight;
  if (Math.abs(y1 - y2) < 0.5) {
    return (
      y1 > minY + 0.5 &&
      y1 < maxY - 0.5 &&
      Math.max(x1, x2) > minX + 0.5 &&
      Math.min(x1, x2) < maxX - 0.5
    );
  }
  if (Math.abs(x1 - x2) < 0.5) {
    return (
      x1 > minX + 0.5 &&
      x1 < maxX - 0.5 &&
      Math.max(y1, y2) > minY + 0.5 &&
      Math.min(y1, y2) < maxY - 0.5
    );
  }
  return false;
}

export function routeHitsRects(route, rects, clearance = 0) {
  if (!route || route.length < 2 || !rects || !rects.length) return false;
  const padding = Number.isFinite(clearance) ? clearance : 0;
  for (let segment = 0; segment < route.length - 1; segment += 1) {
    for (const rect of rects) {
      if (!rect || !(rect.width > 0) || !(rect.height > 0)) continue;
      if (
        orthogonalSegmentHitsRectInterior(
          route[segment].x,
          route[segment].y,
          route[segment + 1].x,
          route[segment + 1].y,
          rect.x - padding,
          rect.y - padding,
          rect.width + padding * 2,
          rect.height + padding * 2,
        )
      ) {
        return true;
      }
    }
  }
  return false;
}

function uniqueSorted(values, tolerance) {
  const sorted = (values || []).slice().sort((left, right) => left - right);
  const result = [];
  for (const value of sorted) {
    if (!result.length || Math.abs(value - result[result.length - 1]) > tolerance) {
      result.push(value);
    }
  }
  return result;
}

function indexOfSorted(values, target, tolerance) {
  return (values || []).findIndex((value) => Math.abs(value - target) <= tolerance);
}

export function orthogonalAStarRoute({
  source,
  target,
  outSide,
  inSide,
  obstacles = [],
  clearance = 10,
  maxExpansions = A_STAR_MAX_EXPANSIONS,
}) {
  const sx = source && source.x;
  const sy = source && source.y;
  const tx = target && target.x;
  const ty = target && target.y;
  if (![sx, sy, tx, ty].every(Number.isFinite)) return null;

  const padding = Number.isFinite(clearance) ? clearance : 10;
  const inflated = obstacles
    .filter((rect) => rect && rect.width > 0 && rect.height > 0)
    .map((rect) => ({
      x: rect.x - padding,
      y: rect.y - padding,
      width: rect.width + padding * 2,
      height: rect.height + padding * 2,
    }));
  const pointBlocked = (x, y) => inflated.some((rect) =>
    x > rect.x + 0.5 &&
    x < rect.x + rect.width - 0.5 &&
    y > rect.y + 0.5 &&
    y < rect.y + rect.height - 0.5
  );
  const segmentBlocked = (x1, y1, x2, y2) => inflated.some((rect) =>
    orthogonalSegmentHitsRectInterior(
      x1,
      y1,
      x2,
      y2,
      rect.x,
      rect.y,
      rect.width,
      rect.height,
    )
  );

  let xs = [sx, tx];
  let ys = [sy, ty];
  for (const rect of inflated) {
    xs.push(rect.x, rect.x + rect.width);
    ys.push(rect.y, rect.y + rect.height);
  }
  const leave = Math.min(Math.max(8, padding), 24);
  xs.push(sx - leave, sx + leave, tx - leave, tx + leave);
  ys.push(sy - leave, sy + leave, ty - leave, ty + leave);
  xs = uniqueSorted(xs, 0.5);
  ys = uniqueSorted(ys, 0.5);
  if (xs.length < 2 || ys.length < 2) return null;

  const startX = indexOfSorted(xs, sx, 0.5);
  const startY = indexOfSorted(ys, sy, 0.5);
  const targetX = indexOfSorted(xs, tx, 0.5);
  const targetY = indexOfSorted(ys, ty, 0.5);
  if ([startX, startY, targetX, targetY].some((value) => value < 0)) return null;
  if (pointBlocked(sx, sy) || pointBlocked(tx, ty)) return null;

  const outDX = outSide === "EAST" ? 1 : outSide === "WEST" ? -1 : 0;
  const outDY = outSide === "SOUTH" ? 1 : outSide === "NORTH" ? -1 : 0;
  const inDX = inSide === "WEST" ? 1 : inSide === "EAST" ? -1 : 0;
  const inDY = inSide === "NORTH" ? 1 : inSide === "SOUTH" ? -1 : 0;
  const rowCount = ys.length;
  const keyOf = (x, y) => x * rowCount + y;
  const scores = new Map();
  const directions = new Map();
  const parents = new Map();
  const closed = new Set();
  const heap = [];
  const push = (score, x, y) => {
    heap.push([score, x, y]);
    let child = heap.length - 1;
    while (child > 0) {
      const parent = (child - 1) >> 1;
      if (heap[parent][0] <= heap[child][0]) break;
      [heap[parent], heap[child]] = [heap[child], heap[parent]];
      child = parent;
    }
  };
  const pop = () => {
    if (!heap.length) return null;
    const top = heap[0];
    const last = heap.pop();
    if (heap.length) {
      heap[0] = last;
      let current = 0;
      for (;;) {
        const left = current * 2 + 1;
        const right = left + 1;
        let best = current;
        if (left < heap.length && heap[left][0] < heap[best][0]) best = left;
        if (right < heap.length && heap[right][0] < heap[best][0]) best = right;
        if (best === current) break;
        [heap[best], heap[current]] = [heap[current], heap[best]];
        current = best;
      }
    }
    return top;
  };

  const startKey = keyOf(startX, startY);
  scores.set(startKey, 0);
  directions.set(startKey, null);
  parents.set(startKey, null);
  push(Math.abs(tx - sx) + Math.abs(ty - sy), startX, startY);

  let found = false;
  let expansions = 0;
  while (heap.length) {
    const current = pop();
    if (!current) break;
    const currentX = current[1];
    const currentY = current[2];
    const currentKey = keyOf(currentX, currentY);
    if (closed.has(currentKey)) continue;
    closed.add(currentKey);
    expansions += 1;
    if (expansions > maxExpansions) break;
    if (currentX === targetX && currentY === targetY) {
      found = true;
      break;
    }

    const x = xs[currentX];
    const y = ys[currentY];
    const neighbors = [];
    if (currentX > 0) neighbors.push([currentX - 1, currentY]);
    if (currentX < xs.length - 1) neighbors.push([currentX + 1, currentY]);
    if (currentY > 0) neighbors.push([currentX, currentY - 1]);
    if (currentY < ys.length - 1) neighbors.push([currentX, currentY + 1]);

    for (const [nextX, nextY] of neighbors) {
      const nextKey = keyOf(nextX, nextY);
      if (closed.has(nextKey)) continue;
      const x2 = xs[nextX];
      const y2 = ys[nextY];
      const deltaX = x2 - x;
      const deltaY = y2 - y;
      const isStart = currentX === startX && currentY === startY;
      const isTarget = nextX === targetX && nextY === targetY;
      if (isStart) {
        if (outDX !== 0) {
          if (!(deltaY === 0 && (deltaX > 0) === (outDX > 0))) continue;
        } else if (!(deltaX === 0 && (deltaY > 0) === (outDY > 0))) continue;
      }
      if (isTarget) {
        if (inDX !== 0) {
          if (!(deltaY === 0 && (deltaX > 0) === (inDX > 0))) continue;
        } else if (!(deltaX === 0 && (deltaY > 0) === (inDY > 0))) continue;
      }
      if (segmentBlocked(x, y, x2, y2) || pointBlocked(x2, y2)) continue;

      const direction = deltaX !== 0
        ? `x${deltaX > 0 ? "+" : "-"}`
        : `y${deltaY > 0 ? "+" : "-"}`;
      const bendCost =
        directions.get(currentKey) != null && directions.get(currentKey) !== direction
          ? A_STAR_BEND_COST
          : 0;
      const nextScore =
        scores.get(currentKey) + Math.abs(deltaX) + Math.abs(deltaY) + bendCost;
      if (nextScore < (scores.get(nextKey) ?? Infinity)) {
        scores.set(nextKey, nextScore);
        directions.set(nextKey, direction);
        parents.set(nextKey, [currentX, currentY]);
        push(nextScore + Math.abs(tx - x2) + Math.abs(ty - y2), nextX, nextY);
      }
    }
  }

  if (!found) return null;
  const reversed = [{ x: xs[targetX], y: ys[targetY] }];
  let key = keyOf(targetX, targetY);
  while (parents.get(key)) {
    const parent = parents.get(key);
    reversed.push({ x: xs[parent[0]], y: ys[parent[1]] });
    key = keyOf(parent[0], parent[1]);
  }
  return reversed.reverse();
}

function orientation(first, second, third) {
  const value =
    (second.y - first.y) * (third.x - second.x) -
    (second.x - first.x) * (third.y - second.y);
  if (Math.abs(value) < 1e-6) return 0;
  return value > 0 ? 1 : 2;
}

export function segmentsProperlyIntersect(firstStart, firstEnd, secondStart, secondEnd) {
  const firstA = orientation(firstStart, firstEnd, secondStart);
  const firstB = orientation(firstStart, firstEnd, secondEnd);
  const secondA = orientation(secondStart, secondEnd, firstStart);
  const secondB = orientation(secondStart, secondEnd, firstEnd);
  if (firstA === firstB || secondA === secondB) return false;
  const touches = (left, right) =>
    Math.abs(left.x - right.x) < 1e-3 && Math.abs(left.y - right.y) < 1e-3;
  return !(
    touches(firstStart, secondStart) ||
    touches(firstStart, secondEnd) ||
    touches(firstEnd, secondStart) ||
    touches(firstEnd, secondEnd)
  );
}

export function countRouteBends(route) {
  if (!route || route.length < 3) return 0;
  let count = 0;
  for (let index = 1; index < route.length - 1; index += 1) {
    const firstX = route[index].x - route[index - 1].x;
    const firstY = route[index].y - route[index - 1].y;
    const secondX = route[index + 1].x - route[index].x;
    const secondY = route[index + 1].y - route[index].y;
    if (
      firstX * secondY !== firstY * secondX ||
      firstX * secondX + firstY * secondY <= 0
    ) {
      count += 1;
    }
  }
  return count;
}

export function routeEndStubLength(route) {
  if (!route || route.length < 2) return 1e6;
  const first = route[0];
  const second = route[1];
  const beforeLast = route[route.length - 2];
  const last = route[route.length - 1];
  return (
    Math.abs(second.x - first.x) +
    Math.abs(second.y - first.y) +
    Math.abs(last.x - beforeLast.x) +
    Math.abs(last.y - beforeLast.y)
  );
}

export function routeTotalLength(route) {
  let length = 0;
  for (let index = 1; index < (route || []).length; index += 1) {
    length +=
      Math.abs(route[index].x - route[index - 1].x) +
      Math.abs(route[index].y - route[index - 1].y);
  }
  return length;
}
