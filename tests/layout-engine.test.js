import {
  defaultLayoutEngine,
  normalizeLayoutEngine,
} from "../src/layout-engine.js";

function assert(condition, message) {
  if (!condition) {
    console.error("FAIL:", message);
    process.exit(1);
  }
}

assert(
  normalizeLayoutEngine() === defaultLayoutEngine,
  "the lightweight layered engine remains the default",
);

const custom = { id: "fixture", layout: () => ({ positions: {}, profile: {} }) };
assert(normalizeLayoutEngine(custom) === custom, "valid engines retain identity");

for (const invalid of [{}, { id: "fixture" }, { id: "", layout() {} }]) {
  let failed = false;
  try {
    normalizeLayoutEngine(invalid);
  } catch (error) {
    failed = error instanceof TypeError;
  }
  assert(failed, "invalid layout engines are rejected");
}

console.log("OK: layout engine boundary tests passed");
