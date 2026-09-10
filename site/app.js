const messages = {
  en: {
    pageTitle: "Eino Workflow DAG · Playground",
    pageDescription: "Validate and render EinoWorkflowSnapshot documents entirely in your browser.",
    playgroundHome: "Eino Workflow DAG playground home",
    brandSubtitle: "Protocol playground",
    projectLinks: "Project links",
    language: "Language",
    docs: "Docs",
    hero: "Read the workflow.<br>See the execution.",
    intro: "Choose a representative Eino workflow or paste your own JSON. Validation and rendering happen locally in this browser; the page sends no snapshot data.",
    workflowPlayground: "Workflow playground",
    playgroundControls: "Playground controls",
    input: "Input",
    workflowCase: "Workflow case",
    sample: "Sample",
    sampleAgent: "Agent with nested workflow",
    sampleAgentNote: "Every leaf reports component Lambda; kind carries the stable visual meaning.",
    sampleRecovery: "Failure and recovery",
    sampleRecoveryNote: "Final execution outcomes stay separate from topology and can be updated in place.",
    sampleMinimal: "Minimal protocol",
    sampleMinimalNote: "The smallest useful schema-v1 document: two nodes and one typed dependency.",
    geometry: "Geometry",
    layoutDirection: "Layout direction",
    right: "Right",
    down: "Down",
    left: "Left",
    up: "Up",
    appearance: "Appearance",
    rendererTheme: "Renderer theme",
    themeClassic: "Classic",
    themeInk: "Ink",
    themeMidnight: "Midnight",
    expandAll: "Expand all",
    collapseAll: "Collapse all",
    fitCanvas: "Fit canvas",
    renderedWorkflow: "Rendered workflow",
    loadingRenderer: "Loading renderer",
    selectedNode: "Selected node",
    selectNodePrompt: "Click a node to locate it in the protocol",
    layouts: "layouts",
    patches: "patches",
    cacheHits: "cache hits",
    snapshotEditor: "Snapshot protocol editor",
    protocol: "Protocol",
    format: "Format",
    snapshotJson: "Eino workflow snapshot JSON",
    applyHint: "⌘ / Ctrl + Enter to apply",
    waitingRenderer: "Waiting for the renderer.",
    validationIssues: "Validation issues",
    copyJson: "Copy JSON",
    copied: "Copied",
    applySnapshot: "Apply snapshot",
    footerProduct: "Apache-2.0 · Read-only renderer · Eino-specific protocol",
    footerPrivacy: "Snapshot data stays in this tab.",
    validSnapshot: "Valid schema-v1 snapshot · rendered locally",
    moreIssues: "{count} more issues",
    protocolIssues: "{count} protocol {noun} · canvas unchanged",
    issue: "issue",
    issues: "issues",
    rendererError: "Renderer error",
    invalidJson: "Invalid JSON",
    fixSyntax: "Fix syntax to render",
    snapshotRejected: "Snapshot rejected",
    snapshotRendered: "Snapshot rendered",
    renderSummary: "{nodes} nodes · {edges} edges · {outcomes} outcomes",
    jsonFormatted: "JSON formatted · apply to validate",
    selectAndCopy: "Select and copy the highlighted JSON",
    rendererUnavailable: "Renderer unavailable",
    checkDistribution: "Check the built distribution files",
  },
  zh: {
    pageTitle: "Eino Workflow DAG · 在线演示",
    pageDescription: "在浏览器本地校验并渲染 EinoWorkflowSnapshot 文档。",
    playgroundHome: "Eino Workflow DAG 在线演示首页",
    brandSubtitle: "协议演示台",
    projectLinks: "项目链接",
    language: "语言",
    docs: "文档",
    hero: "读懂工作流。<br>看清执行过程。",
    intro: "选择一个典型的 Eino 工作流，或粘贴你自己的 JSON。校验与渲染全部在当前浏览器中完成，页面不会发送任何快照数据。",
    workflowPlayground: "工作流演示台",
    playgroundControls: "演示控制项",
    input: "输入",
    workflowCase: "工作流案例",
    sample: "示例",
    sampleAgent: "带嵌套工作流的 Agent",
    sampleAgentNote: "每个叶子节点的 component 都是 Lambda，kind 提供稳定的视觉语义。",
    sampleRecovery: "失败与恢复",
    sampleRecoveryNote: "最终执行结果与拓扑保持分离，并可在原图上更新。",
    sampleMinimal: "最小协议",
    sampleMinimalNote: "最小可用的 schema-v1 文档：两个节点和一条带类型的依赖关系。",
    geometry: "几何布局",
    layoutDirection: "布局方向",
    right: "向右",
    down: "向下",
    left: "向左",
    up: "向上",
    appearance: "外观",
    rendererTheme: "渲染主题",
    themeClassic: "经典",
    themeInk: "墨色",
    themeMidnight: "午夜",
    expandAll: "全部展开",
    collapseAll: "全部收起",
    fitCanvas: "适应画布",
    renderedWorkflow: "工作流渲染结果",
    loadingRenderer: "正在加载渲染器",
    selectedNode: "当前节点",
    selectNodePrompt: "点击节点，即可在协议中定位",
    layouts: "布局次数",
    patches: "数据更新",
    cacheHits: "缓存命中",
    snapshotEditor: "快照协议编辑器",
    protocol: "协议",
    format: "格式化",
    snapshotJson: "Eino 工作流快照 JSON",
    applyHint: "⌘ / Ctrl + Enter 应用",
    waitingRenderer: "正在等待渲染器。",
    validationIssues: "校验问题",
    copyJson: "复制 JSON",
    copied: "已复制",
    applySnapshot: "应用快照",
    footerProduct: "Apache-2.0 · 只读渲染器 · Eino 专用协议",
    footerPrivacy: "快照数据仅保留在当前标签页。",
    validSnapshot: "有效的 schema-v1 快照 · 已在本地渲染",
    moreIssues: "另有 {count} 个问题",
    protocolIssues: "{count} 个协议问题 · 画布未改变",
    issue: "问题",
    issues: "问题",
    rendererError: "渲染器错误",
    invalidJson: "JSON 无效",
    fixSyntax: "修正语法后即可渲染",
    snapshotRejected: "快照未通过校验",
    snapshotRendered: "快照已渲染",
    renderSummary: "{nodes} 个节点 · {edges} 条边 · {outcomes} 个执行结果",
    jsonFormatted: "JSON 已格式化 · 应用后进行校验",
    selectAndCopy: "请复制已选中的 JSON",
    rendererUnavailable: "渲染器不可用",
    checkDistribution: "请检查构建后的发布文件",
  },
};

const rendererLocales = {
  en: undefined,
  zh: {
    kinds: {
      start: "开始",
      end: "结束",
      io: "输入/输出",
      llm: "大模型",
      cpu: "代码",
      branch: "分支",
      merge: "合并",
      subgraph: "子图",
      graph: "工作流",
    },
    statuses: { success: "成功", failed: "失败", skipped: "已跳过" },
    tooltip: {
      status: "状态",
      duration: "耗时",
      error: "错误",
      tokenUsage: "Token 用量",
      metrics: "指标",
    },
    collapseSubgraphTitle: "收起子图",
  },
};

const samples = {
  agent: {
    noteKey: "sampleAgentNote",
    localizedNames: {
      zh: {
        workflows: {
          "": "研究助手",
          research: "研究流程",
        },
        nodes: {
          intake: "规范化请求",
          route: "选择路径",
          direct: "直接响应",
          research: "研究工作流",
          "research/lookup": "检索上下文",
          "research/rank": "证据排序",
          "research/draft": "生成答案",
          merge: "合并结果",
          deliver: "输出答案",
        },
      },
    },
    snapshot: {
      schemaVersion: 1,
      workflow: {
        name: "research-assistant",
        nodes: [
          { id: "intake", name: "Normalize request", component: "Lambda", kind: "io" },
          { id: "route", name: "Choose path", component: "Lambda", kind: "branch" },
          { id: "direct", name: "Direct response", component: "Lambda", kind: "cpu" },
          {
            id: "research",
            name: "Research workflow",
            component: "Lambda",
            kind: "graph",
            workflow: {
              name: "research",
              nodes: [
                { id: "lookup", name: "Retrieve context", component: "Lambda", kind: "io" },
                { id: "rank", name: "Rank evidence", component: "Lambda", kind: "cpu" },
                { id: "draft", name: "Draft answer", component: "Lambda", kind: "llm" },
              ],
              edges: [
                { from: "start", to: "lookup", channels: ["control", "data"] },
                { from: "lookup", to: "rank", channels: ["control", "data"] },
                { from: "rank", to: "draft", channels: ["control", "data"] },
                { from: "draft", to: "end", channels: ["control", "data"] },
              ],
            },
          },
          { id: "merge", name: "Merge result", component: "Lambda", kind: "merge" },
          { id: "deliver", name: "Deliver answer", component: "Lambda", kind: "io" },
        ],
        edges: [
          { from: "start", to: "intake", channels: ["control", "data"] },
          { from: "intake", to: "route", channels: ["control", "data"] },
          { from: "route", to: "direct", channels: ["control"] },
          { from: "route", to: "research", channels: ["control"] },
          { from: "direct", to: "merge", channels: ["control", "data"] },
          { from: "research", to: "merge", channels: ["control", "data"] },
          { from: "merge", to: "deliver", channels: ["control", "data"] },
          { from: "deliver", to: "end", channels: ["control", "data"] },
        ],
        branches: [{ from: "route", targets: ["direct", "research"] }],
      },
      execution: {
        id: "run-1042",
        durationMs: 812,
        nodes: [
          { path: ["intake"], status: "success", durationMs: 14 },
          { path: ["route"], status: "success", durationMs: 7 },
          { path: ["direct"], status: "skipped", durationMs: null },
          { path: ["research"], status: "success", durationMs: 743 },
          { path: ["research", "lookup"], status: "success", durationMs: 96 },
          { path: ["research", "rank"], status: "success", durationMs: 41 },
          { path: ["research", "draft"], status: "success", durationMs: 606 },
          { path: ["merge"], status: "success", durationMs: 25 },
          { path: ["deliver"], status: "success", durationMs: 23 },
        ],
      },
      metadata: { example: "public-playground" },
    },
  },
  recovery: {
    noteKey: "sampleRecoveryNote",
    localizedNames: {
      zh: {
        workflows: { "": "容错生成" },
        nodes: {
          prepare: "准备输入",
          primary: "主模型",
          fallback: "备用模型",
          select: "选择结果",
          store: "存储响应",
        },
      },
    },
    snapshot: {
      schemaVersion: 1,
      workflow: {
        name: "resilient-generation",
        nodes: [
          { id: "prepare", name: "Prepare input", component: "Lambda", kind: "io" },
          { id: "primary", name: "Primary model", component: "Lambda", kind: "llm" },
          { id: "fallback", name: "Fallback model", component: "Lambda", kind: "llm" },
          { id: "select", name: "Select result", component: "Lambda", kind: "merge" },
          { id: "store", name: "Store response", component: "Lambda", kind: "io" },
        ],
        edges: [
          { from: "start", to: "prepare", channels: ["control", "data"] },
          { from: "prepare", to: "primary", channels: ["control", "data"] },
          { from: "prepare", to: "fallback", channels: ["control", "data"] },
          { from: "primary", to: "select", channels: ["control", "data"] },
          { from: "fallback", to: "select", channels: ["control", "data"] },
          { from: "select", to: "store", channels: ["control", "data"] },
          { from: "store", to: "end", channels: ["control", "data"] },
        ],
        branches: [{ from: "prepare", targets: ["primary", "fallback"] }],
      },
      execution: {
        id: "run-2048",
        durationMs: 534,
        nodes: [
          { path: ["prepare"], status: "success", durationMs: 18 },
          { path: ["primary"], status: "failed", durationMs: 311, errorMessage: "model unavailable" },
          { path: ["fallback"], status: "success", durationMs: 469 },
          { path: ["select"], status: "success", durationMs: 22 },
          { path: ["store"], status: "success", durationMs: 25 },
        ],
      },
    },
  },
  minimal: {
    noteKey: "sampleMinimalNote",
    localizedNames: {
      zh: {
        nodes: {
          input: "输入",
          model: "生成",
        },
      },
    },
    snapshot: {
      schemaVersion: 1,
      workflow: {
        nodes: [
          { id: "input", name: "Input", kind: "io" },
          { id: "model", name: "Generate", kind: "llm" },
        ],
        edges: [
          { from: "input", to: "model", channels: ["control", "data"] },
        ],
      },
    },
  },
};

const elements = {
  host: document.querySelector("#dag"),
  sample: document.querySelector("#sample"),
  sampleNote: document.querySelector("#sample-note"),
  editor: document.querySelector("#snapshot-json"),
  apply: document.querySelector("#apply-json"),
  format: document.querySelector("#format-json"),
  copy: document.querySelector("#copy-json"),
  issues: document.querySelector("#issue-list"),
  validation: document.querySelector("#validation-result"),
  statusLight: document.querySelector("#status-light"),
  renderStatus: document.querySelector("#render-status"),
  renderSummary: document.querySelector("#render-summary"),
  selectedPath: document.querySelector("#selected-path"),
  layouts: document.querySelector("#metric-layouts"),
  patches: document.querySelector("#metric-patches"),
  cache: document.querySelector("#metric-cache"),
  themes: document.querySelector("#theme-controls"),
};

let api;
let instance;
let activeSnapshot;
let activeDirection = "RIGHT";
let activeTheme = "classic";
let activeLanguage = "en";
let selectedPathIsPrompt = true;
let renderState = { kind: "", titleKey: "loadingRenderer", summaryKey: null, params: {} };
let validationState = { kind: "neutral", key: "waitingRenderer", params: {} };
let visibleIssues = [];
let lastLoadedSampleDocument = null;

function t(key, params = {}) {
  const template = messages[activeLanguage][key] || messages.en[key] || key;
  return template.replace(/\{(\w+)\}/g, (_, name) => String(params[name] ?? ""));
}

function preferredLanguage() {
  const queryLanguage = new URLSearchParams(window.location.search).get("lang");
  if (queryLanguage === "zh" || queryLanguage === "en") return queryLanguage;
  try {
    const savedLanguage = localStorage.getItem("eino-workflow-dag-playground-language");
    if (savedLanguage === "zh" || savedLanguage === "en") return savedLanguage;
  } catch {
    // Storage can be disabled; browser language remains a safe fallback.
  }
  return navigator.language.toLowerCase().startsWith("zh") ? "zh" : "en";
}

function displayRenderState() {
  elements.statusLight.className = `status-light ${renderState.kind}`;
  elements.renderStatus.textContent = t(renderState.titleKey, renderState.params);
  if (renderState.summaryKey) {
    elements.renderSummary.textContent = t(renderState.summaryKey, renderState.params);
  } else if (renderState.summaryText !== undefined) {
    elements.renderSummary.textContent = renderState.summaryText;
  }
}

function displayValidationState() {
  elements.validation.className = `validation-result${validationState.kind === "neutral" ? "" : ` ${validationState.kind}`}`;
  elements.validation.textContent = t(validationState.key, validationState.params);
}

function renderIssueList() {
  elements.issues.replaceChildren();
  for (const error of visibleIssues.slice(0, 6)) {
    const item = document.createElement("li");
    item.textContent = `${error.path} · ${error.code}: ${error.message}`;
    elements.issues.append(item);
  }
  if (visibleIssues.length > 6) {
    const item = document.createElement("li");
    item.textContent = t("moreIssues", { count: visibleIssues.length - 6 });
    elements.issues.append(item);
  }
  elements.issues.classList.toggle("visible", visibleIssues.length > 0);
}

function applyLanguage(language, { persist = true, updateUrl = true } = {}) {
  const nextLanguage = language === "zh" ? "zh" : "en";
  const shouldRelocalizeSample = Boolean(
    lastLoadedSampleDocument && elements.editor.value === lastLoadedSampleDocument,
  );
  activeLanguage = nextLanguage;
  document.documentElement.lang = activeLanguage === "zh" ? "zh-CN" : "en";
  document.title = t("pageTitle");
  document.querySelector('meta[name="description"]').content = t("pageDescription");
  document.querySelectorAll("[data-i18n]").forEach((element) => {
    element.textContent = t(element.dataset.i18n);
  });
  document.querySelectorAll("[data-i18n-html]").forEach((element) => {
    element.innerHTML = t(element.dataset.i18nHtml);
  });
  document.querySelectorAll("[data-i18n-aria-label]").forEach((element) => {
    element.setAttribute("aria-label", t(element.dataset.i18nAriaLabel));
  });
  document.querySelectorAll("[data-language]").forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.language === activeLanguage));
  });
  if (elements.sample.value && samples[elements.sample.value]) {
    elements.sampleNote.textContent = t(samples[elements.sample.value].noteKey);
  }
  if (validationState.key === "protocolIssues") {
    validationState.params.noun = t(validationState.params.count === 1 ? "issue" : "issues");
  }
  if (renderState.summaryKey === "protocolIssues") {
    renderState.params.noun = t(renderState.params.count === 1 ? "issue" : "issues");
  }
  if (selectedPathIsPrompt) elements.selectedPath.textContent = t("selectNodePrompt");
  displayRenderState();
  displayValidationState();
  renderIssueList();
  instance?.setLocale(rendererLocales[activeLanguage]);
  if (shouldRelocalizeSample && api) {
    loadSample(elements.sample.value, { fit: false, resetSelection: false });
  } else {
    scheduleDiagnostics();
  }

  if (persist) {
    try {
      localStorage.setItem("eino-workflow-dag-playground-language", activeLanguage);
    } catch {
      // The language still applies for this tab when storage is disabled.
    }
  }
  if (updateUrl) {
    const url = new URL(window.location.href);
    url.searchParams.set("lang", activeLanguage);
    history.replaceState(null, "", url);
  }
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function sameNodePath(left, right) {
  return Array.isArray(left)
    && Array.isArray(right)
    && left.length === right.length
    && left.every((segment, index) => segment === right[index]);
}

function clearNodePointerState() {
  const getCytoscape = instance?.[Symbol.for("eino-workflow-dag.cytoscape")];
  const cy = typeof getCytoscape === "function" ? getCytoscape() : null;
  cy?.nodes(".hover, .press").removeClass("hover press");
}

function localizedSampleSnapshot(sample, language) {
  const snapshot = clone(sample.snapshot);
  const names = sample.localizedNames?.[language];
  if (!names) return snapshot;

  function applyNames(workflow, prefix = []) {
    const workflowPath = prefix.join("/");
    if (Object.hasOwn(names.workflows || {}, workflowPath)) {
      workflow.name = names.workflows[workflowPath];
    }
    for (const node of workflow.nodes) {
      const path = [...prefix, node.id];
      const nodePath = path.join("/");
      if (Object.hasOwn(names.nodes || {}, nodePath)) node.name = names.nodes[nodePath];
      if (node.workflow) applyNames(node.workflow, path);
    }
  }

  applyNames(snapshot.workflow);
  return snapshot;
}

function assetBase() {
  const configured = document
    .querySelector('meta[name="eino-workflow-dag-asset-base"]')
    ?.getAttribute("content") || "./dist/";
  return new URL(configured, document.baseURI);
}

function loadRenderer() {
  const base = assetBase();
  const stylesheet = document.createElement("link");
  stylesheet.rel = "stylesheet";
  stylesheet.href = new URL("eino-workflow-dag.css", base).href;
  document.head.append(stylesheet);

  const stylesheetReady = new Promise((resolve, reject) => {
    stylesheet.addEventListener("load", resolve, { once: true });
    stylesheet.addEventListener("error", () => reject(new Error("Unable to load the renderer stylesheet.")), { once: true });
  });
  const scriptReady = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = new URL("eino-workflow-dag.umd.js", base).href;
    script.addEventListener("load", resolve, { once: true });
    script.addEventListener("error", () => reject(new Error("Unable to load the renderer bundle.")), { once: true });
    document.head.append(script);
  });
  return Promise.all([stylesheetReady, scriptReady]);
}

function graphCounts(graph) {
  let nodes = 0;
  let edges = 0;
  for (const node of graph.nodes) {
    nodes += 1;
    if (node.workflow) {
      const nested = graphCounts(node.workflow);
      nodes += nested.nodes;
      edges += nested.edges;
    }
  }
  edges += graph.edges.length;
  return { nodes, edges };
}

function subgraphPaths(graph, prefix = []) {
  const paths = [];
  for (const node of graph.nodes) {
    if (!node.workflow) continue;
    const path = [...prefix, node.id];
    paths.push(path, ...subgraphPaths(node.workflow, path));
  }
  return paths;
}

function setRenderState(kind, titleKey, summaryKey, params = {}, summaryText) {
  renderState = { kind, titleKey, summaryKey, params, summaryText };
  displayRenderState();
}

function updateDiagnostics() {
  if (!instance) return;
  const diagnostics = instance.getDiagnostics();
  elements.layouts.textContent = String(diagnostics.layoutRuns);
  elements.patches.textContent = String(diagnostics.dataPatches);
  elements.cache.textContent = String(diagnostics.layoutCacheHits);
}

function scheduleDiagnostics() {
  requestAnimationFrame(() => requestAnimationFrame(updateDiagnostics));
}

function scheduleCanvasFit() {
  requestAnimationFrame(() => requestAnimationFrame(() => {
    if (!instance) return;
    instance.resize();
    instance.resetView();
    updateDiagnostics();
  }));
}

function showIssues(errors) {
  visibleIssues = errors;
  if (!errors.length) {
    validationState = { kind: "valid", key: "validSnapshot", params: {} };
    displayValidationState();
    renderIssueList();
    return;
  }
  validationState = {
    kind: "invalid",
    key: "protocolIssues",
    params: {
      count: errors.length,
      noun: t(errors.length === 1 ? "issue" : "issues"),
    },
  };
  displayValidationState();
  renderIssueList();
}

function locateNodeInEditor(path) {
  const id = path.at(-1);
  const needle = `"id": ${JSON.stringify(id)}`;
  const start = elements.editor.value.indexOf(needle);
  selectedPathIsPrompt = false;
  elements.selectedPath.textContent = path.join(" / ");
  if (start < 0) return;
  elements.editor.focus({ preventScroll: true });
  elements.editor.setSelectionRange(start, start + needle.length);
  const linesBefore = elements.editor.value.slice(0, start).split("\n").length - 1;
  elements.editor.scrollTop = Math.max(0, linesBefore * 17 - elements.editor.clientHeight / 3);
}

function mount(snapshot) {
  instance = api.createWorkflowDAG(elements.host, {
    snapshot,
    direction: activeDirection,
    theme: activeTheme,
    locale: rendererLocales[activeLanguage],
    expanded: subgraphPaths(snapshot.workflow),
    activeNodePath: null,
    onNodeClick(node) {
      if (sameNodePath(instance.getActiveNodePath(), node.path)) {
        instance.setActiveNodePath(null);
        clearNodePointerState();
        selectedPathIsPrompt = true;
        elements.selectedPath.textContent = t("selectNodePrompt");
        scheduleDiagnostics();
        return;
      }
      instance.setActiveNodePath(node.path);
      locateNodeInEditor(node.path);
      scheduleDiagnostics();
    },
    onEdgeClick(edge) {
      selectedPathIsPrompt = false;
      elements.selectedPath.textContent = `${edge.source.join(" / ")} → ${edge.target.join(" / ")}`;
    },
    onExpandedChange() {
      scheduleDiagnostics();
    },
    onError(error) {
      setRenderState("invalid", "rendererError", null, {}, error.message);
    },
  });
}

function applyEditorSnapshot({ fit = true } = {}) {
  let candidate;
  try {
    candidate = JSON.parse(elements.editor.value);
  } catch (error) {
    const issue = { path: "JSON", code: "invalid_json", message: error.message };
    showIssues([issue]);
    setRenderState("invalid", "invalidJson", "fixSyntax");
    return false;
  }

  const validation = api.validateWorkflowSnapshot(candidate);
  if (!validation.valid) {
    showIssues(validation.errors);
    setRenderState("invalid", "snapshotRejected", "protocolIssues", {
      count: validation.errors.length,
      noun: t(validation.errors.length === 1 ? "issue" : "issues"),
    });
    return false;
  }

  activeSnapshot = api.parseWorkflowSnapshot(candidate);
  if (!instance) mount(activeSnapshot);
  else instance.update(activeSnapshot, { preserveExpanded: true, fit });

  const counts = graphCounts(activeSnapshot.workflow);
  const executions = activeSnapshot.execution?.nodes?.length || 0;
  showIssues([]);
  setRenderState("valid", "snapshotRendered", "renderSummary", {
    nodes: counts.nodes,
    edges: counts.edges,
    outcomes: executions,
  });
  if (fit) scheduleCanvasFit();
  else scheduleDiagnostics();
  return true;
}

function loadSample(id, { fit = true, resetSelection = true } = {}) {
  const sample = samples[id];
  elements.sampleNote.textContent = t(sample.noteKey);
  lastLoadedSampleDocument = JSON.stringify(localizedSampleSnapshot(sample, activeLanguage), null, 2);
  elements.editor.value = lastLoadedSampleDocument;
  if (resetSelection) {
    selectedPathIsPrompt = true;
    elements.selectedPath.textContent = t("selectNodePrompt");
  }
  applyEditorSnapshot({ fit });
}

function selectPressed(container, selector, attribute, value) {
  container.querySelectorAll(selector).forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset[attribute] === value));
  });
}

function initializeThemes() {
  for (const theme of api.listWorkflowDAGThemes()) {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.theme = theme;
    button.setAttribute("aria-pressed", String(theme === activeTheme));
    button.dataset.i18n = `theme${theme[0].toUpperCase()}${theme.slice(1)}`;
    button.textContent = t(button.dataset.i18n);
    button.addEventListener("click", () => {
      activeTheme = theme;
      selectPressed(elements.themes, "[data-theme]", "theme", theme);
      instance?.setTheme(theme);
      scheduleDiagnostics();
    });
    elements.themes.append(button);
  }
}

elements.sample.addEventListener("change", () => loadSample(elements.sample.value));

document.querySelector(".language-switch").addEventListener("click", (event) => {
  const button = event.target.closest("[data-language]");
  if (!button || button.dataset.language === activeLanguage) return;
  applyLanguage(button.dataset.language);
});

document.querySelector("#direction-controls").addEventListener("click", (event) => {
  const button = event.target.closest("[data-direction]");
  if (!button) return;
  activeDirection = button.dataset.direction;
  selectPressed(document.querySelector("#direction-controls"), "[data-direction]", "direction", activeDirection);
  instance?.setDirection(activeDirection);
  scheduleDiagnostics();
});

elements.apply.addEventListener("click", () => applyEditorSnapshot());
elements.format.addEventListener("click", () => {
  try {
    elements.editor.value = JSON.stringify(JSON.parse(elements.editor.value), null, 2);
    validationState = { kind: "neutral", key: "jsonFormatted", params: {} };
    displayValidationState();
  } catch (error) {
    showIssues([{ path: "JSON", code: "invalid_json", message: error.message }]);
  }
});

elements.copy.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(elements.editor.value);
    elements.copy.textContent = t("copied");
    setTimeout(() => { elements.copy.textContent = t("copyJson"); }, 1200);
  } catch {
    elements.editor.select();
    validationState = { kind: "neutral", key: "selectAndCopy", params: {} };
    displayValidationState();
  }
});

elements.editor.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
    event.preventDefault();
    applyEditorSnapshot();
  }
});

document.querySelector("#expand-all").addEventListener("click", () => {
  instance?.expandAll();
  scheduleDiagnostics();
});
document.querySelector("#collapse-all").addEventListener("click", () => {
  instance?.collapseAll();
  scheduleDiagnostics();
});
document.querySelector("#fit").addEventListener("click", () => instance?.resetView());

window.playground = {
  get api() { return api; },
  get instance() { return instance; },
  get snapshot() { return activeSnapshot; },
  get language() { return activeLanguage; },
  get ready() { return !!instance; },
  apply: applyEditorSnapshot,
  setLanguage: applyLanguage,
};

applyLanguage(preferredLanguage(), { persist: false, updateUrl: false });

try {
  await loadRenderer();
  api = window.EinoWorkflowDAG;
  if (!api) throw new Error("The renderer bundle did not expose its browser API.");
  initializeThemes();
  loadSample(elements.sample.value);
} catch (error) {
  showIssues([{ path: "renderer", code: "load_failed", message: error.message }]);
  setRenderState("invalid", "rendererUnavailable", "checkDistribution");
}
