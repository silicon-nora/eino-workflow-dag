import assert from "node:assert/strict";
import { axisProfile } from "../src/axis-profile.js";
import {
  bumpPortSideUse,
  claimMainPortOwners,
  crossSideTowardTarget,
  exclusiveSideChoices,
  orderSidesByOccupancy,
  pickInSideByGeometry,
  pickOutSideByGeometry,
  pickSidePreferringFree,
  portSideUseCount,
  selectBestPortCandidate,
} from "../src/port-planner.js";

const right = axisProfile("RIGHT");
const down = axisProfile("DOWN");
const box = (x, y) => ({ x, y, width: 40, height: 40 });

assert.equal(pickOutSideByGeometry(box(0, 0), box(100, 0), right), "EAST");
assert.equal(pickInSideByGeometry(box(0, 0), box(100, 0), right), "WEST");
assert.equal(pickOutSideByGeometry(box(0, 0), box(0, 100), down), "SOUTH");
assert.equal(crossSideTowardTarget(box(0, 0), box(0, 100), right), "SOUTH");
assert.equal(crossSideTowardTarget(box(0, 0), box(0, 20), right), null);

const occupancy = {};
bumpPortSideUse(occupancy, "source", "EAST");
bumpPortSideUse(occupancy, "source", "EAST");
bumpPortSideUse(occupancy, "source", "NORTH");
assert.equal(portSideUseCount(occupancy, "source", "EAST"), 2);
assert.deepEqual(
  orderSidesByOccupancy(["EAST", "NORTH", "SOUTH"], occupancy, "source", "EAST"),
  ["SOUTH", "NORTH", "EAST"],
);
assert.equal(
  pickSidePreferringFree(
    "EAST",
    ["EAST", "NORTH", "SOUTH"],
    occupancy,
    "source",
    "EAST",
    "NORTH",
  ),
  "NORTH",
);

const prototypeOccupancy = {};
bumpPortSideUse(prototypeOccupancy, "__proto__", "EAST");
bumpPortSideUse(prototypeOccupancy, "constructor", "WEST");
assert.equal(portSideUseCount(prototypeOccupancy, "__proto__", "EAST"), 1);
assert.equal(portSideUseCount(prototypeOccupancy, "constructor", "WEST"), 1);

const main = { id: "main", source: "a", target: "b" };
const bypass = { id: "bypass", source: "a", target: "c" };
const owners = claimMainPortOwners(
  [bypass, main],
  { a: box(0, 0), b: box(100, 0), c: box(100, 120) },
  right,
  (edge) => edge.id === "main",
);
assert.equal(owners.outOwner.a, main);
assert.equal(owners.inOwner.b, main);
assert.deepEqual(
  exclusiveSideChoices(
    bypass,
    "a",
    owners.outOwner,
    "EAST",
    "SOUTH",
    right,
    true,
    false,
  ),
  ["SOUTH"],
);
assert.deepEqual(
  exclusiveSideChoices(
    bypass,
    "a",
    owners.outOwner,
    "EAST",
    "SOUTH",
    right,
    false,
    false,
  ),
  ["EAST", "SOUTH", "NORTH"],
  "a reserved main side remains available until an edge actually occupies it",
);

const candidate = (id, overrides = {}) => ({
  id,
  route: [{ x: 0, y: 0 }, { x: 1, y: 1 }],
  outSide: "NORTH",
  inSide: "NORTH",
  vsCritical: 0,
  vsBypass: 0,
  bends: 1,
  geoWrong: 0,
  sideLoad: 0,
  score: 10,
  ...overrides,
});

assert.equal(
  selectBestPortCandidate(
    [candidate("cross", { score: 1 }), candidate("critical", { vsCritical: 1, score: 0 })],
    right,
  ).id,
  "cross",
  "a zero-critical-crossing candidate is a hard preference",
);
assert.equal(
  selectBestPortCandidate(
    [candidate("wrong", { geoWrong: 1, score: 0 }), candidate("aligned", { score: 99 })],
    right,
  ).id,
  "aligned",
);
assert.equal(
  selectBestPortCandidate(
    [candidate("loaded", { sideLoad: 2, score: 0 }), candidate("free", { sideLoad: 0 })],
    right,
  ).id,
  "free",
);
assert.equal(
  selectBestPortCandidate(
    [candidate("bent", { bends: 2, score: 0 }), candidate("straight", { bends: 1 })],
    right,
  ).id,
  "straight",
);
assert.equal(
  selectBestPortCandidate(
    [
      candidate("cross-sides", { score: 0 }),
      candidate("main-sides", { outSide: "EAST", inSide: "WEST", score: 99 }),
    ],
    right,
  ).id,
  "main-sides",
);
assert.equal(
  selectBestPortCandidate(
    [
      candidate("cross-sides", { bends: 1, sideLoad: 0 }),
      candidate("main-sides", {
        bends: 2,
        outSide: "EAST",
        inSide: "WEST",
        sideLoad: 2,
      }),
    ],
    right,
  ).id,
  "main-sides",
  "available primary ports outrank load and bend-count preferences",
);
assert.equal(
  selectBestPortCandidate(
    [candidate("more-crossings", { vsBypass: 2, score: 0 }), candidate("clear", { score: 99 })],
    right,
  ).id,
  "clear",
);
assert.equal(
  selectBestPortCandidate([candidate("costly", { score: 20 }), candidate("cheap")], right).id,
  "cheap",
);
assert.equal(selectBestPortCandidate([], right), null);

for (const direction of ["RIGHT", "LEFT", "DOWN", "UP"]) {
  const profile = axisProfile(direction);
  const crossSide = profile.crossSides[0];
  const reserved = exclusiveSideChoices(
    bypass,
    "a",
    { a: main },
    profile.outSide,
    crossSide,
    profile,
    false,
    false,
  );
  assert.equal(
    reserved[0],
    profile.outSide,
    `${direction} keeps an unoccupied primary output side available`,
  );

  assert.equal(
    selectBestPortCandidate(
      [
        candidate("cross", {
          bends: 0,
          inSide: crossSide,
          outSide: crossSide,
          sideLoad: 0,
        }),
        candidate("primary", {
          bends: 2,
          inSide: profile.inSide,
          outSide: profile.outSide,
          sideLoad: 2,
        }),
      ],
      profile,
    ).id,
    "primary",
    `${direction} primary sides outrank secondary route preferences`,
  );
}

console.log("OK: port planner tests passed");
