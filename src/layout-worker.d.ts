import type {
  DAGDirection,
  LayoutResult,
  VisibleGraph,
} from "./index.js";

export interface LayoutWorkerRunOptions {
  direction?: DAGDirection;
  signal?: AbortSignal;
}

export interface LayoutWorkerClientOptions {
  /** Terminate the caller-provided Worker when the client is destroyed. */
  terminateOnDestroy?: boolean;
}

export interface LayoutWorkerClient {
  run(
    graph: VisibleGraph,
    options?: LayoutWorkerRunOptions,
  ): Promise<LayoutResult>;
  destroy(): void;
  pendingCount(): number;
}

export interface LayoutWorkerMessageScope {
  addEventListener(type: "message", listener: (event: MessageEvent) => void): void;
  removeEventListener?(type: "message", listener: (event: MessageEvent) => void): void;
  postMessage(message: unknown): void;
}

export function attachLayoutWorker(
  scope?: LayoutWorkerMessageScope,
): () => void;

export function createLayoutWorkerClient(
  worker: Worker,
  options?: LayoutWorkerClientOptions,
): LayoutWorkerClient;
