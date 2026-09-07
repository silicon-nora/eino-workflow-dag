import { layoutVisibleGraph } from "./layout.js";

const MESSAGE_TYPE = "eino-workflow-dag:layout";

function abortError(message = "Layout request was aborted") {
  if (typeof DOMException === "function") {
    return new DOMException(message, "AbortError");
  }
  const error = new Error(message);
  error.name = "AbortError";
  return error;
}

function serializeError(error) {
  return {
    name: error instanceof Error ? error.name : "Error",
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
  };
}

function deserializeError(value) {
  const error = new Error(value?.message || "Layout worker failed");
  error.name = value?.name || "Error";
  if (value?.stack) error.stack = value.stack;
  return error;
}

function isProtocolMessage(data) {
  return !!data && data.type === MESSAGE_TYPE && Number.isInteger(data.id);
}

/**
 * Attach the package layout protocol to a module worker global scope.
 * Returns a cleanup function so worker harnesses can detach the listener.
 */
export function attachLayoutWorker(scope = globalThis) {
  if (
    !scope ||
    typeof scope.addEventListener !== "function" ||
    typeof scope.postMessage !== "function"
  ) {
    throw new TypeError("A worker-like message scope is required");
  }

  const onMessage = (event) => {
    const request = event?.data;
    if (!isProtocolMessage(request) || request.kind !== "request") return;
    try {
      const result = layoutVisibleGraph(request.graph, request.options);
      scope.postMessage({
        type: MESSAGE_TYPE,
        kind: "result",
        id: request.id,
        result,
      });
    } catch (error) {
      scope.postMessage({
        type: MESSAGE_TYPE,
        kind: "error",
        id: request.id,
        error: serializeError(error),
      });
    }
  };

  scope.addEventListener("message", onMessage);
  return () => scope.removeEventListener?.("message", onMessage);
}

/** Create a reusable request client around a caller-owned module Worker. */
export function createLayoutWorkerClient(worker, options = {}) {
  if (
    !worker ||
    typeof worker.addEventListener !== "function" ||
    typeof worker.postMessage !== "function"
  ) {
    throw new TypeError("A Worker instance is required");
  }

  let nextId = 1;
  let destroyed = false;
  const pending = new Map();

  const settle = (id, action, value) => {
    const request = pending.get(id);
    if (!request) return;
    pending.delete(id);
    request.removeAbort?.();
    request[action](value);
  };

  const onMessage = (event) => {
    const response = event?.data;
    if (!isProtocolMessage(response)) return;
    if (response.kind === "result") settle(response.id, "resolve", response.result);
    if (response.kind === "error") {
      settle(response.id, "reject", deserializeError(response.error));
    }
  };

  const onError = (event) => {
    const error = event?.error || new Error(event?.message || "Layout worker failed");
    for (const id of [...pending.keys()]) settle(id, "reject", error);
  };

  worker.addEventListener("message", onMessage);
  worker.addEventListener("error", onError);

  function run(graph, runOptions = {}) {
    if (destroyed) return Promise.reject(abortError("Layout worker client is destroyed"));
    const { signal, ...layoutOptions } = runOptions;
    if (signal?.aborted) return Promise.reject(abortError());
    const id = nextId++;

    return new Promise((resolve, reject) => {
      const request = { resolve, reject, removeAbort: null };
      if (signal) {
        const onAbort = () => settle(id, "reject", abortError());
        signal.addEventListener("abort", onAbort, { once: true });
        request.removeAbort = () => signal.removeEventListener("abort", onAbort);
      }
      pending.set(id, request);
      try {
        worker.postMessage({
          type: MESSAGE_TYPE,
          kind: "request",
          id,
          graph,
          options: layoutOptions,
        });
      } catch (error) {
        settle(id, "reject", error);
      }
    });
  }

  function destroy() {
    if (destroyed) return;
    destroyed = true;
    worker.removeEventListener?.("message", onMessage);
    worker.removeEventListener?.("error", onError);
    for (const id of [...pending.keys()]) {
      settle(id, "reject", abortError("Layout worker client was destroyed"));
    }
    if (options.terminateOnDestroy) worker.terminate?.();
  }

  return {
    run,
    destroy,
    pendingCount: () => pending.size,
  };
}
