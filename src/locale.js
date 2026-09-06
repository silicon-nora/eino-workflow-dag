export const DEFAULT_LOCALE = Object.freeze({
  kinds: Object.freeze({
    start: "Start",
    end: "End",
    io: "I/O",
    llm: "LLM",
    cpu: "Code",
    branch: "Branch",
    merge: "Merge",
    subgraph: "Subgraph",
    graph: "Graph",
  }),
  statuses: Object.freeze({
    pending: "Pending",
    running: "Running",
    success: "Success",
    failed: "Failed",
    degraded: "Degraded",
    skipped: "Skipped",
  }),
  tooltip: Object.freeze({
    status: "Status",
    duration: "Duration",
    error: "Error",
    tokenUsage: "Token usage",
    metrics: "Metrics",
  }),
  collapseSubgraphTitle: "Collapse subgraph",
});

export function resolveLocale(locale) {
  const override = locale && typeof locale === "object" ? locale : {};
  return {
    kinds: mergePlainRecords(DEFAULT_LOCALE.kinds, override.kinds),
    statuses: mergePlainRecords(DEFAULT_LOCALE.statuses, override.statuses),
    tooltip: mergePlainRecords(DEFAULT_LOCALE.tooltip, override.tooltip),
    collapseSubgraphTitle:
      override.collapseSubgraphTitle || DEFAULT_LOCALE.collapseSubgraphTitle,
  };
}
import { mergePlainRecords } from "./key-map.js";
