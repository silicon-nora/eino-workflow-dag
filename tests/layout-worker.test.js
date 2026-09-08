import assert from "node:assert/strict";
import {
  attachLayoutWorker,
  createLayoutWorkerClient,
} from "../src/layout-worker.js";

class LinkedWorker {
  constructor() {
    this.mainListeners = { message: new Set(), error: new Set() };
    this.workerListeners = new Set();
    this.terminated = false;
    this.scope = {
      addEventListener: (type, listener) => {
        if (type === "message") this.workerListeners.add(listener);
      },
      removeEventListener: (type, listener) => {
        if (type === "message") this.workerListeners.delete(listener);
      },
      postMessage: (data) => {
        queueMicrotask(() => {
          for (const listener of this.mainListeners.message) listener({ data });
        });
      },
    };
  }

  addEventListener(type, listener) {
    this.mainListeners[type].add(listener);
  }

  removeEventListener(type, listener) {
    this.mainListeners[type].delete(listener);
  }

  postMessage(data) {
    queueMicrotask(() => {
      for (const listener of this.workerListeners) listener({ data });
    });
  }

  terminate() {
    this.terminated = true;
  }
}

const graph = {
  nodes: [
    {
      id: "input",
      key: "input",
      name: "Input",
      parent: null,
      kind: "io",
      status: "success",
      cost_ms: 2,
      metrics: null,
      err_msg: "",
      expandable: false,
      subgraph: false,
      expanded: false,
    },
    {
      id: "answer",
      key: "answer",
      name: "Answer",
      parent: null,
      kind: "llm",
      status: "success",
      cost_ms: 8,
      metrics: null,
      err_msg: "",
      expandable: false,
      subgraph: false,
      expanded: false,
    },
  ],
  edges: [
    {
      id: "input->answer",
      from: "input",
      to: "answer",
      kind: "",
      level: 0,
    },
  ],
  levelZeroPath: ["input", "answer"],
  levelZeroDurationMs: 10,
};

const linked = new LinkedWorker();
const detach = attachLayoutWorker(linked.scope);
const client = createLayoutWorkerClient(linked, { terminateOnDestroy: true });
const result = await client.run(graph, { direction: "DOWN" });
assert.equal(result.profile.direction, "DOWN");
assert.ok(result.positions.input);
assert.ok(result.positions.answer.y > result.positions.input.y);
assert.deepEqual(result.railAnchors, {});
assert.equal(client.pendingCount(), 0);

const controller = new AbortController();
controller.abort();
await assert.rejects(
  client.run(graph, { signal: controller.signal }),
  (error) => error.name === "AbortError",
);

detach();
const pending = client.run(graph);
assert.equal(client.pendingCount(), 1);
client.destroy();
await assert.rejects(pending, (error) => error.name === "AbortError");
assert.equal(client.pendingCount(), 0);
assert.equal(linked.terminated, true);
await assert.rejects(client.run(graph), (error) => error.name === "AbortError");

assert.throws(() => createLayoutWorkerClient(null), /Worker instance/);
assert.throws(() => attachLayoutWorker({}), /worker-like message scope/);

console.log("OK: layout worker protocol tests passed");
