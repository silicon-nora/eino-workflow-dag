// Generated from the matching .d.ts file by scripts/sync-cjs-types.js.
export type DAGDirection = "RIGHT" | "LEFT" | "DOWN" | "UP";
export type DAGTheme = "classic" | "ink" | "midnight" | (string & {});
export type DAGNodeStatus =
  | "pending"
  | "running"
  | "success"
  | "failed"
  | "degraded"
  | "skipped"
  | string;

export interface DAGNode {
  id: string;
  name?: string;
  kind?: string;
  status?: DAGNodeStatus;
  started_at_ms?: number;
  finished_at_ms?: number;
  cost_ms?: number;
  metrics?: Record<string, unknown> | null;
  err_msg?: string;
  graph?: (Omit<DAGData, "version"> & { version?: 2 }) | null;
}

export interface DAGEdge {
  from: string;
  to: string;
  kind?: string;
}

export interface DAGData {
  version: 2;
  scene?: string;
  task_id?: string;
  started_at_ms?: number;
  finished_at_ms?: number;
  cost_ms?: number;
  nodes: DAGNode[];
  edges: DAGEdge[];
  /** Authoritative same-layer path; the renderer computes one when omitted. */
  critical_path?: string[];
}

export interface VisibleNode {
  id: string;
  key: string;
  name: string;
  parent: string | null;
  kind: string;
  status: string;
  cost_ms: number;
  metrics: Record<string, unknown> | null;
  err_msg: string;
  expandable: boolean;
  subgraph: boolean;
  expanded: boolean;
}

export interface VisibleEdge extends DAGEdge {
  id: string;
  stroke?: string;
}

export interface VisibleGraph {
  nodes: VisibleNode[];
  edges: VisibleEdge[];
  criticalPath: string[];
  criticalCostMs: number;
}

export interface SubgraphInfo {
  path: string;
  name: string;
  node: DAGNode;
}

export interface MountOptions {
  root: DAGData;
  direction?: DAGDirection;
  theme?: DAGTheme;
  expanded?: Record<string, boolean>;
  /** Path-qualified rendered node ID; a unique graph-local key is also accepted. */
  activeNodeId?: string | null;
  onExpandedChange?: (expanded: Record<string, boolean>) => void;
  onNodeClick?: (node: RenderedNodeData) => void;
  onEdgeClick?: (edge: RenderedEdgeData) => void;
  /** Receives internal errors that the renderer recovered from. */
  onError?: (error: Error) => void;
  tooltipFormatter?: (node: TooltipNodeData) => string;
  nodeLabelFormatter?: (node: VisibleNode) => string;
  /** Allow click-to-pin tooltips. Defaults to true. */
  pinNodeTip?: boolean;
  /** Observe container size changes automatically. Defaults to true. */
  autoResize?: boolean;
  /** Emit renderer diagnostics to console.debug. Defaults to false. */
  debug?: boolean;
  /** Cytoscape selector rules appended after the active theme. */
  additionalStyles?: DAGStyleRule[];
  /** Exact accessible name for the graph; defaults to a generated summary. */
  ariaLabel?: string;
  accessibilityLabelFormatter?: (
    summary: DAGAccessibilitySummary,
    visible: VisibleGraph,
  ) => string;
  /** Arrow-key node navigation and Enter/Space activation. Defaults to true. */
  keyboardNavigation?: boolean;
  /** Number of topology layouts retained per instance. Defaults to 12. */
  layoutCacheSize?: number;
  locale?: DAGLocale;
}

export interface DAGLocale {
  kinds?: Record<string, string>;
  statuses?: Record<string, string>;
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
  kinds: Record<string, string>;
  statuses: Record<string, string>;
  tooltip: DAGTooltipLocale;
  collapseSubgraphTitle: string;
}

export interface DAGStyleRule {
  selector: string;
  style: Record<string, string | number | boolean | number[]>;
}

export interface DAGAccessibilitySummary {
  nodeCount: number;
  edgeCount: number;
  statuses: Record<string, number>;
  expandedSubgraphs: number;
  collapsedSubgraphs: number;
  text: string;
}

export interface TooltipNodeData {
  id: string;
  title: string;
  status: string;
  cost_ms: number;
  err_msg: string;
  metrics: Record<string, unknown> | null;
}

export interface RenderedNodeData extends TooltipNodeData {
  /** Node ID within its own graph layer; unlike id, this is not path-qualified. */
  key: string;
  label: string;
  kind: string;
  expandable: boolean;
  subgraph: boolean;
  expanded: boolean;
  parent?: string;
}

export interface RenderedEdgeData {
  id: string;
  source: string;
  target: string;
  kind: string;
  level: number;
  main: boolean;
}

export interface RenderOptions {
  fit?: boolean;
}

export interface SetDataOptions {
  /** Keep expansion state for subgraph paths that still exist. Defaults to true. */
  preserveExpanded?: boolean;
  /** Fit the updated graph into the viewport. Defaults to false. */
  fit?: boolean;
}

export interface WorkflowDAGInstance {
  render(options?: RenderOptions): VisibleGraph;
  setData(root: DAGData, options?: SetDataOptions): VisibleGraph;
  expandAll(): void;
  collapseAll(): void;
  togglePath(path: string): void;
  getExpanded(): Record<string, boolean>;
  setExpanded(expanded: Record<string, boolean>): void;
  /** Returns the configured rendered ID or graph-local key. */
  getActiveNodeId(): string | null;
  /** Highlights without relayout; null clears it. Exact rendered IDs win over unique keys. */
  setActiveNodeId(id?: string | null): void;
  getDirection(): DAGDirection;
  setDirection(direction: DAGDirection): void;
  getTheme(): DAGTheme;
  setTheme(theme: DAGTheme): void;
  getLocale(): ResolvedDAGLocale;
  setLocale(locale?: DAGLocale): void;
  zoomIn(): void;
  zoomOut(): void;
  resetView(): void;
  listSubgraphs(): SubgraphInfo[];
  resize(): void;
  exportImage(options?: DAGImageExportOptions): Promise<Blob>;
  getDiagnostics(): DAGRendererDiagnostics;
  /** Idempotently release browser resources. Mutating methods throw afterward. */
  destroy(): void;
  /** Returns null after destroy(). */
  cy(): unknown;
}

export interface DAGRendererDiagnostics {
  dataPatches: number;
  topologySyncs: number;
  layoutRuns: number;
  layoutCacheHits: number;
  cachedLayouts: number;
}

export interface DAGImageExportOptions {
  /** Defaults to PNG. */
  format?: "png" | "jpeg" | "svg";
  /** Export the complete graph rather than only the viewport. Defaults to true. */
  full?: boolean;
  /** Canvas background; defaults to the active theme background. */
  background?: string;
  scale?: number;
  maxWidth?: number;
  maxHeight?: number;
  /** Extra model-space padding around SVG exports. Defaults to 24. */
  padding?: number;
  /** JPEG quality from 0 to 1. */
  quality?: number;
}

export interface WorkflowDAGAPI {
  mount(container: HTMLElement, options: MountOptions): WorkflowDAGInstance;
  normalizeDirection(direction: unknown): DAGDirection;
  normalizeTheme(theme: unknown): DAGTheme;
  listThemes(): DAGTheme[];
  registerTheme(theme: string, tokens: DAGThemeTokens): () => void;
}

export interface DAGThemeTokens {
  canvas?: { bg?: string };
  colors?: Partial<{
    ink: string;
    steel: string;
    quiet: string;
    conduit: string;
    critical: string;
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
    criticalWidth: number;
    arrowScale: number;
    bypassStyle: string;
    bypassDashPattern: number[];
    criticalUnderlay: boolean;
  }>;
  overlay?: Partial<{
    titleBg: string;
    titleColor: string;
    titleHoverBg: string;
    titleHoverBorder: string;
    titleFont: string;
  }>;
}

export interface WorkflowDAGModelAPI {
  buildVisibleGraph(
    root: DAGData,
    expanded?: Record<string, boolean>,
  ): VisibleGraph;
  defaultExpandedMap(root: DAGData): Record<string, boolean>;
  listSubgraphs(root: DAGData): SubgraphInfo[];
  isGraphNode(node: DAGNode | null | undefined): boolean;
  nodeRef(node: DAGNode | null | undefined): string;
}

export interface LayoutPosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface LayoutResult {
  positions: Record<string, LayoutPosition>;
  profile: Record<string, unknown>;
}

export interface WorkflowDAGLayoutAPI {
  layoutVisibleGraph(
    graph: VisibleGraph,
    options?: { direction?: DAGDirection },
  ): LayoutResult;
}

export interface DAGValidationIssue {
  code: string;
  path: string;
  message: string;
}

export interface DAGValidationResult {
  valid: boolean;
  errors: DAGValidationIssue[];
}

export const EinoWorkflowDAG: WorkflowDAGAPI;
export const registerWorkflowDAGTheme: WorkflowDAGAPI["registerTheme"];
export const CURRENT_DAG_VERSION: 2;
export const SUPPORTED_DAG_VERSIONS: readonly [2];

export function mountWorkflowDAG(
  container: HTMLElement,
  options: MountOptions,
): WorkflowDAGInstance;
export function validateDAG(root: unknown): DAGValidationResult;
export function assertValidDAG<T extends DAGData>(root: T): T;

export default EinoWorkflowDAG;
