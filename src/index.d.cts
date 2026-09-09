// Generated from the matching .d.ts file by scripts/sync-cjs-types.js.
export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | readonly JsonValue[];
export interface JsonObject {
  readonly [key: string]: JsonValue;
}

export type DAGDirection = "RIGHT" | "LEFT" | "DOWN" | "UP";
export type DAGTheme = "classic" | "ink" | "midnight" | (string & {});
export interface DAGThemeDefinition {
  /** Registered theme used before applying instance tokens. Defaults to classic. */
  readonly base?: DAGTheme;
  readonly tokens?: DAGThemeTokens;
}
export type DAGThemeInput = DAGTheme | DAGThemeDefinition;
export type WorkflowNodeStatus =
  | "success"
  | "failed"
  | "skipped";
/** Dependency channels exposed by Eino GraphInfo.Edges and DataEdges. */
export type WorkflowEdgeChannel = "control" | "data";
/** Relationships that can appear in the rendered graph. */
export type RenderedEdgeChannel = WorkflowEdgeChannel | "branch";
export type NodePath = readonly string[];
export type WorkflowFieldPath = readonly string[];

/** JSON-safe projection of one Eino compose.GraphInfo. */
export interface WorkflowGraph {
  readonly name?: string;
  readonly nodes: readonly WorkflowNode[];
  readonly edges: readonly WorkflowEdge[];
  readonly branches?: readonly WorkflowBranch[];
  readonly metadata?: JsonObject | null;
}

export interface WorkflowNode {
  readonly id: string;
  readonly name?: string;
  /** Eino component category, for example ChatModel, Lambda, or Retriever. */
  readonly component?: string;
  readonly workflow?: WorkflowGraph | null;
  readonly metadata?: JsonObject | null;
}

export interface WorkflowEdge {
  readonly from: string;
  readonly to: string;
  /** At least one channel is required; values are unique. */
  readonly channels: readonly WorkflowEdgeChannel[];
  /** Eino field mappings carried by the data dependency. */
  readonly mappings?: readonly WorkflowFieldMapping[];
  readonly metadata?: JsonObject | null;
}

export interface WorkflowFieldMapping {
  /** Empty means the complete predecessor output. */
  readonly fromPath: WorkflowFieldPath;
  /** Empty means the complete successor input. */
  readonly toPath: WorkflowFieldPath;
  readonly metadata?: JsonObject | null;
}

export interface WorkflowBranch {
  readonly from: string;
  readonly targets: readonly string[];
  readonly metadata?: JsonObject | null;
}

export interface WorkflowNodeExecution {
  readonly path: NodePath;
  /** Final outcome of this node invocation. */
  readonly status: WorkflowNodeStatus;
  /** Unix epoch milliseconds. */
  readonly startedAtMs?: number;
  /** Unix epoch milliseconds. */
  readonly finishedAtMs?: number;
  /** Non-negative elapsed milliseconds, or null when no duration was measured. */
  readonly durationMs: number | null;
  readonly metrics?: JsonObject | null;
  readonly errorMessage?: string;
}

export interface WorkflowExecution {
  readonly id?: string;
  /** Unix epoch milliseconds. */
  readonly startedAtMs?: number;
  /** Unix epoch milliseconds. */
  readonly finishedAtMs?: number;
  /** Non-negative elapsed milliseconds. */
  readonly durationMs?: number;
  readonly nodes?: readonly WorkflowNodeExecution[];
  readonly metadata?: JsonObject | null;
}

/**
 * JSON-safe visualization snapshot maintained by this library.
 * It is a projection of Eino workflow information, not an Eino wire format.
 */
export interface EinoWorkflowSnapshot {
  readonly schemaVersion: 1;
  readonly workflow: WorkflowGraph;
  readonly execution?: WorkflowExecution | null;
  readonly metadata?: JsonObject | null;
}

export interface VisibleNode {
  readonly path: NodePath;
  readonly id: string;
  readonly name: string;
  readonly parentPath?: NodePath;
  readonly kind: string;
  readonly component: string;
  readonly metadata: JsonObject | null;
  readonly status?: WorkflowNodeStatus;
  /** Absent when no execution timing was supplied for this node. */
  readonly durationMs?: number;
  readonly metrics: JsonObject | null;
  readonly errorMessage: string;
  readonly expandable: boolean;
  readonly subgraph: boolean;
  readonly expanded: boolean;
  /** Graph-local layout rail, starting at Level 0. */
  readonly level: number;
}

export interface RenderedNodeData extends VisibleNode {
  readonly label: string;
}

export interface RenderedEdgeData {
  readonly id: string;
  readonly source: NodePath;
  readonly target: NodePath;
  readonly channels: readonly RenderedEdgeChannel[];
  /** Eino field mappings carried by the rendered data dependency. */
  readonly mappings: readonly WorkflowFieldMapping[];
  /** Metadata from the corresponding workflow edge. */
  readonly metadata: JsonObject | null;
  /** Metadata from the corresponding branch relationship, when present. */
  readonly branchMetadata: JsonObject | null;
  /**
   * Metadata for every corresponding branch relationship, in snapshot order.
   * Null entries preserve branches that do not declare metadata.
   */
  readonly branchMetadataList: readonly (JsonObject | null)[];
  readonly level: number;
}

export interface WorkflowSubgraphInfo {
  readonly path: NodePath;
  readonly name: string;
  readonly node: WorkflowNode;
}

export interface CreateWorkflowDAGOptions {
  snapshot: EinoWorkflowSnapshot;
  direction?: DAGDirection;
  theme?: DAGThemeInput;
  interaction?: DAGInteractionPolicy;
  expanded?: readonly NodePath[];
  activeNodePath?: NodePath | null;
  onExpandedChange?: (expanded: readonly NodePath[]) => void;
  onNodeClick?: (node: RenderedNodeData) => void;
  onEdgeClick?: (edge: RenderedEdgeData) => void;
  onError?: (error: WorkflowDAGError | WorkflowSnapshotError) => void;
  tooltipFormatter?: (node: RenderedNodeData) => string;
  nodeLabelFormatter?: (node: VisibleNode) => string;
  /** @deprecated Use interaction.pinTooltipOnNodeClick. */
  pinNodeTip?: boolean;
  autoResize?: boolean;
  debug?: boolean;
  ariaLabel?: string;
  accessibilityLabelFormatter?: (
    summary: DAGAccessibilitySummary,
    visible: VisibleGraph,
  ) => string;
  /** @deprecated Use interaction.keyboardNavigation. */
  keyboardNavigation?: boolean;
  layoutCacheSize?: number;
  locale?: DAGLocale;
}

export interface UpdateWorkflowDAGOptions {
  preserveExpanded?: boolean;
  fit?: boolean;
}

export interface WorkflowDAGInstance {
  update(
    snapshot: EinoWorkflowSnapshot,
    options?: UpdateWorkflowDAGOptions,
  ): void;
  expandAll(): void;
  collapseAll(): void;
  toggle(path: NodePath): void;
  getExpanded(): readonly NodePath[];
  setExpanded(expanded: readonly NodePath[]): void;
  getActiveNodePath(): NodePath | null;
  setActiveNodePath(path?: NodePath | null): void;
  getDirection(): DAGDirection;
  setDirection(direction: DAGDirection): void;
  getTheme(): DAGThemeInput;
  setTheme(theme: DAGThemeInput): void;
  getLocale(): ResolvedDAGLocale;
  setLocale(locale?: DAGLocale): void;
  zoomIn(): void;
  zoomOut(): void;
  resetView(): void;
  listSubgraphs(): readonly WorkflowSubgraphInfo[];
  resize(): void;
  exportImage(options?: DAGImageExportOptions): Promise<Blob>;
  getDiagnostics(): DAGRendererDiagnostics;
  destroy(): void;
}

export interface DAGLocale {
  kinds?: Readonly<Record<string, string>>;
  statuses?: Partial<Readonly<Record<WorkflowNodeStatus, string>>>;
  tooltip?: Partial<DAGTooltipLocale>;
  collapseSubgraphTitle?: string;
}

export interface DAGTooltipLocale {
  status: string;
  duration: string;
  error: string;
  tokenUsage: string;
  metrics: string;
}

export interface ResolvedDAGLocale {
  kinds: Readonly<Record<string, string>>;
  statuses: Readonly<Record<WorkflowNodeStatus, string>>;
  tooltip: DAGTooltipLocale;
  collapseSubgraphTitle: string;
}

export interface DAGAccessibilitySummary {
  nodeCount: number;
  edgeCount: number;
  statuses: Partial<Readonly<Record<WorkflowNodeStatus, number>>>;
  expandedSubgraphs: number;
  collapsedSubgraphs: number;
  text: string;
}

export interface VisibleGraph {
  readonly nodes: readonly VisibleNode[];
  readonly edges: readonly RenderedEdgeData[];
  readonly levelZeroPath: readonly NodePath[];
  readonly levelZeroDurationMs: number;
}

export interface DAGRendererDiagnostics {
  dataPatches: number;
  topologySyncs: number;
  layoutRuns: number;
  layoutCacheHits: number;
  cachedLayouts: number;
}

export interface DAGImageExportOptions {
  format?: "png" | "jpeg" | "svg";
  full?: boolean;
  background?: string;
  scale?: number;
  maxWidth?: number;
  maxHeight?: number;
  padding?: number;
  quality?: number;
}

export interface DAGThemeTokens {
  canvas?: { readonly bg?: string };
  colors?: Partial<{
    ink: string;
    steel: string;
    quiet: string;
    conduit: string;
    highlighted: string;
    signal: string;
    warning: string;
    paper: string;
    slate: string;
    terminalBg: string;
    terminalBorder: string;
    llmBg: string;
    llmBorder: string;
    branchBg: string;
    branchBorder: string;
    subBg: string;
    subBorder: string;
    parentBg: string;
    parentBorder: string;
    failBg: string;
    warnBg: string;
    hover: string;
    press: string;
    probe: string;
    probeGlow: string;
  }>;
  node?: Partial<{
    width: number;
    height: number;
    textMaxWidth: number;
    shape: string;
    borderWidth: number;
    radius: number;
    fontSize: number;
    fontWeight: number;
    fontFamily: string;
    textColor: string;
    textOutlineWidth: number;
    textOutlineColor: string;
    pressBlacken: number;
    parentOpacity: number;
  }>;
  edge?: Partial<{
    width: number;
    highlightedWidth: number;
    arrowScale: number;
    secondaryStyle: string;
    secondaryDashPattern: readonly number[];
    highlightedUnderlay: boolean;
  }>;
  overlay?: Partial<{
    titleBg: string;
    titleColor: string;
    titleHoverBg: string;
    titleHoverBorder: string;
    titleFont: string;
  }>;
  tooltip?: Partial<{
    bg: string;
    color: string;
    borderColor: string;
    pinnedBorderColor: string;
    shadow: string;
    pinnedShadow: string;
    radius: number;
    maxWidth: number;
    maxHeight: number;
    fontSize: number;
    lineHeight: number;
    paddingX: number;
    paddingY: number;
  }>;
  spacing?: Partial<{
    nodeNode: number;
    betweenLayers: number;
    nestedNodeNode: number;
    nestedBetweenLayers: number;
    fitPadding: number;
  }>;
}

/** Optional built-in interactions. Callbacks still fire when defaults are disabled. */
export interface DAGInteractionPolicy {
  readonly expandOnNodeClick?: boolean;
  readonly tooltipOnHover?: boolean;
  readonly pinTooltipOnNodeClick?: boolean;
  readonly highlightEdgeOnClick?: boolean;
  readonly clearHighlightOnCanvasClick?: boolean;
  readonly keyboardNavigation?: boolean;
  readonly panOnDrag?: boolean;
  readonly zoomOnCtrlWheel?: boolean;
}

export type WorkflowSnapshotIssueCode =
  | "invalid_json_value"
  | "invalid_snapshot"
  | "missing_schema_version"
  | "unsupported_schema_version"
  | "invalid_workflow"
  | "invalid_nodes"
  | "invalid_edges"
  | "invalid_branches"
  | "invalid_node"
  | "missing_node_id"
  | "invalid_node_id"
  | "duplicate_node_id"
  | "invalid_nested_workflow"
  | "invalid_edge"
  | "duplicate_edge"
  | "missing_edge_endpoint"
  | "unknown_edge_source"
  | "unknown_edge_target"
  | "self_edge"
  | "invalid_edge_channels"
  | "invalid_edge_channel"
  | "duplicate_edge_channel"
  | "missing_edge_channel"
  | "invalid_edge_mappings"
  | "invalid_field_mapping"
  | "invalid_field_path"
  | "duplicate_field_mapping"
  | "mapping_without_data_edge"
  | "invalid_branch"
  | "missing_branch_source"
  | "unknown_branch_source"
  | "invalid_branch_targets"
  | "invalid_branch_target"
  | "unknown_branch_target"
  | "duplicate_branch_target"
  /** @deprecated Reserved for compatibility because schema v1 permits distinct branches with identical endpoints. */
  | "duplicate_branch"
  | "directed_cycle"
  | "invalid_execution"
  | "invalid_execution_nodes"
  | "invalid_node_execution"
  | "missing_node_status"
  | "invalid_node_status"
  | "missing_node_duration"
  | "invalid_skipped_duration"
  | "invalid_node_path"
  | "unknown_node_path"
  | "duplicate_node_execution"
  | "invalid_string_field"
  | "invalid_number_field"
  | "invalid_time_range"
  | "invalid_metadata"
  | "unknown_field";

export interface WorkflowSnapshotIssue {
  readonly code: WorkflowSnapshotIssueCode;
  readonly path: string;
  readonly message: string;
}

export interface WorkflowSnapshotValidationResult {
  readonly valid: boolean;
  readonly errors: readonly WorkflowSnapshotIssue[];
}

export class WorkflowSnapshotError extends TypeError {
  constructor(issues: readonly WorkflowSnapshotIssue[]);
  readonly code: "INVALID_WORKFLOW_SNAPSHOT";
  readonly issues: readonly WorkflowSnapshotIssue[];
}

export type WorkflowDAGErrorCode =
  | "RENDERER_RECOVERED"
  | "REACT_ADAPTER_UPDATE_FAILED"
  | "VUE_ADAPTER_UPDATE_FAILED";

export interface WorkflowDAGErrorOptions {
  readonly recoverable?: boolean;
  readonly cause?: unknown;
}

export class WorkflowDAGError extends Error {
  constructor(
    code: WorkflowDAGErrorCode,
    message: string,
    options?: WorkflowDAGErrorOptions,
  );
  readonly code: WorkflowDAGErrorCode;
  readonly recoverable: boolean;
  readonly cause?: unknown;
}

export const CURRENT_SCHEMA_VERSION: 1;
export const SUPPORTED_SCHEMA_VERSIONS: readonly [1];

export function createWorkflowDAG(
  container: HTMLElement,
  options: CreateWorkflowDAGOptions,
): WorkflowDAGInstance;
export function validateWorkflowSnapshot(
  input: unknown,
): WorkflowSnapshotValidationResult;
export function parseWorkflowSnapshot(input: unknown): EinoWorkflowSnapshot;
export function registerWorkflowDAGTheme(
  theme: string,
  tokens: DAGThemeTokens,
): () => void;
export function listWorkflowDAGThemes(): readonly DAGTheme[];
