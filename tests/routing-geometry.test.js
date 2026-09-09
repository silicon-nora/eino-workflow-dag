import assert from "node:assert/strict";
import {
  countRouteBends,
  orthogonalAStarRoute,
  routeHitsRects,
  segmentsProperlyIntersect,
  simplifyOrthogonalPoints,
} from "../src/routing-geometry.js";

assert.deepEqual(
  simplifyOrthogonalPoints([
    { x: 0, y: 0 },
    { x: 10, y: 0.2 },
    { x: 20, y: 0 },
  ]),
  [
    { x: 0, y: 0 },
    { x: 20, y: 0 },
  ],
  "near-orthogonal collinear points simplify deterministically",
);

const obstacle = { x: 40, y: -20, width: 20, height: 40 };
assert(
  routeHitsRects(
    [{ x: 0, y: 0 }, { x: 100, y: 0 }],
    [obstacle],
  ),
  "a route through a rectangle is detected",
);
assert(
  !routeHitsRects(
    [{ x: 0, y: -20 }, { x: 100, y: -20 }],
    [obstacle],
  ),
  "a route touching only the rectangle boundary remains legal",
);

const detour = orthogonalAStarRoute({
  source: { x: 0, y: 0 },
  target: { x: 100, y: 0 },
  outSide: "EAST",
  inSide: "WEST",
  obstacles: [obstacle],
  clearance: 10,
});
assert(detour && detour.length >= 4, "A* finds an orthogonal obstacle detour");
assert(!routeHitsRects(detour, [obstacle], 10), "the A* detour clears the obstacle");
assert(detour[1].x > detour[0].x, "the first segment obeys the output side");
assert(detour.at(-2).x < detour.at(-1).x, "the last segment obeys the input side");
assert(countRouteBends(detour) >= 2, "the detour reports its bends");

assert(
  segmentsProperlyIntersect(
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 5, y: -5 },
    { x: 5, y: 5 },
  ),
  "proper interior crossings are detected",
);
assert(
  !segmentsProperlyIntersect(
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 10, y: 0 },
    { x: 10, y: 5 },
  ),
  "shared endpoints are not counted as crossings",
);

console.log("OK: pure routing geometry tests passed");
