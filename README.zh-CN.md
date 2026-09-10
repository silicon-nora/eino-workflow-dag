# eino-workflow-dag

[English](./README.md) | **简体中文**

[![npm](https://img.shields.io/npm/v/eino-workflow-dag)](https://www.npmjs.com/package/eino-workflow-dag)
[![CI](https://github.com/silicon-nora/eino-workflow-dag/actions/workflows/ci.yml/badge.svg)](https://github.com/silicon-nora/eino-workflow-dag/actions/workflows/ci.yml)
[![License](https://img.shields.io/npm/l/eino-workflow-dag)](./LICENSE)

一个用于嵌套 [CloudWeGo Eino](https://github.com/cloudwego/eino) 工作流及其
执行状态的框架无关、只读渲染器。

[打开双语浏览器演示](https://silicon-nora.github.io/eino-workflow-dag/?lang=zh)，
无需安装包即可校验并渲染 schema v1 快照。界面支持英文和简体中文。

本库接收一种 JSON 安全的可视化协议，渲染可预测的分层 DAG，并提供可选的
React 和 Vue 绑定。本库不执行或编辑工作流。

## 安装

```bash
npm install eino-workflow-dag
```

## 快速开始

为渲染器提供一个尺寸不为零的宿主元素：

```html
<div style="position: relative; height: 480px">
  <div id="workflow" style="height: 100%"></div>
</div>
```

然后导入样式表并创建视图：

```js
import {
  createWorkflowDAG,
  parseWorkflowSnapshot,
} from "eino-workflow-dag";
import "eino-workflow-dag/styles.css";

const container = document.querySelector("#workflow");
if (!(container instanceof HTMLElement)) {
  throw new Error("Workflow container not found");
}

const snapshot = parseWorkflowSnapshot({
  schemaVersion: 1,
  workflow: {
    nodes: [
      { id: "input", name: "Input", component: "Lambda", kind: "io" },
      { id: "model", name: "Generate", component: "ChatModel", kind: "llm" },
    ],
    edges: [
      { from: "start", to: "input", channels: ["control", "data"] },
      {
        from: "input",
        to: "model",
        channels: ["control", "data"],
        mappings: [{ fromPath: ["prompt"], toPath: ["input"] }],
      },
      { from: "model", to: "end", channels: ["control", "data"] },
    ],
  },
  execution: {
    id: "run-42",
    nodes: [
      { path: ["input"], status: "success", durationMs: 12 },
      { path: ["model"], status: "success", durationMs: 240 },
    ],
  },
});

const view = createWorkflowDAG(container, {
  snapshot,
  direction: "RIGHT",
  activeNodePath: ["model"],
  onNodeClick({ path, id }) {
    console.log(path, id);
  },
});
```

保留返回的 `view`，用于后续生命周期操作。快照变化时调用
`view.update(nextSnapshot)`，宿主被永久移除时调用 `view.destroy()`。
渲染器默认会观察容器尺寸变化。

### 浏览器脚本（UMD）

本包将浏览器可直接使用的 UMD 构建发布为
`dist/eino-workflow-dag.umd.js`。CDN 使用者可以直接加载样式表和脚本，API
会暴露为 `window.EinoWorkflowDAG`：

```html
<link
  rel="stylesheet"
  href="https://cdn.jsdelivr.net/npm/eino-workflow-dag@1/dist/eino-workflow-dag.css"
>
<script src="https://cdn.jsdelivr.net/npm/eino-workflow-dag@1/dist/eino-workflow-dag.umd.js"></script>
```

这段代码只演示资源加载。请按照[快速开始](#快速开始)创建宿主、快照和视图，并使用
`window.EinoWorkflowDAG` 上的方法代替 import。

如果生产部署必须可复现，请锁定确切的包版本。

## 快照协议

`EinoWorkflowSnapshot` 由本库维护。它是面向浏览器的 Eino 工作流信息投影，
不是 Eino 序列化格式。拓扑和执行状态位于同一协议的不同部分：

```ts
interface EinoWorkflowSnapshot {
  readonly schemaVersion: 1;
  readonly workflow: WorkflowGraph;
  readonly execution?: WorkflowExecution | null;
  readonly metadata?: JsonObject | null;
}
```

- `workflow` 是 Eino
  [`compose.GraphInfo`](https://github.com/cloudwego/eino/blob/main/compose/introspect.go)
  的 JSON 安全投影。
- 节点的 `component` 值映射自 Eino `GraphNodeInfo.Component`。
- 节点可以声明固定的视觉语义 `kind`：`llm`、`io`、`cpu`、`branch`、
  `merge` 或 `graph`。这样可以将节点的 Eino 组件身份与渲染角色分开。
- 控制依赖和数据依赖会被规范化为边；边必须包含 `control`、`data` 或两者兼有的
  `channels`。
- Eino 分支保留为独立的 `branches`，不是边的 channel。
- Eino 字段映射以 `fromPath`/`toPath` 数组的形式附加在数据边上。
- `execution` 包含运行标识、时间、状态、错误和指标。
- 节点执行状态是封闭的最终结果枚举：`success`、`failed` 或 `skipped`。
  尚无最终结果的节点没有执行记录。
- 执行节点使用 `["research", "model"]` 这样的数组路径，因此局部 ID 不会产生歧义。
- `metadata` 是应用拥有的唯一扩展机制。它可以出现在快照、图、节点、边、字段映射、
  分支或执行信息上。渲染器会校验其 JSON 结构，但不会从中推导拓扑、执行状态、节点
  kind、布局或样式。
- Eino 端点使用 `start` 和 `end`，它们不能作为节点 ID。
- 循环图会被拒绝。Eino Workflow 和无环 Graph 输出在支持范围内；循环 Pregel
  输出不在支持范围内。

规范 schema 和校验规则请参阅 [CONTRACT.md](./CONTRACT.md)。

存储未知值之前先进行校验：

```ts
import { parseWorkflowSnapshot } from "eino-workflow-dag";

const snapshot = parseWorkflowSnapshot(JSON.parse(payload));
```

`parseWorkflowSnapshot()` 会抛出 `WorkflowSnapshotError`，其中包含稳定的错误码和
结构化校验问题。非抛出式的 `validateWorkflowSnapshot()` 会返回检测到的全部问题。

生产端或 CI 任务也可以校验 JSON 文件：

```bash
npx eino-workflow-dag-validate ./workflow.json
```

校验器也接受标准输入中的 JSON：

```bash
cat workflow.json | npx eino-workflow-dag-validate
```

Go 生产端可以使用仓库提供的
[`compose.GraphInfo` 投影](https://github.com/silicon-nora/eino-workflow-dag/tree/main/integrations/go)。
它会捕获编译后的 Eino 拓扑，以确定性方式将其规范化，并生成 JavaScript 校验器所
消费的同一种快照。

```bash
go get github.com/silicon-nora/eino-workflow-dag/integrations/go@v1.2.0
```

Go 投影是独立版本的模块。它的 `v1.2.0` 版本使用不可变 Git 标签
`integrations/go/v1.2.0`；npm 包标签与 Go 模块标签不共用版本时钟。

## 实例 API

`createWorkflowDAG(container, options)` 返回的实例包含以下能力组：

- 数据：`update(snapshot, options)`
- 展开：`expandAll()`、`collapseAll()`、`toggle(path)`、`getExpanded()`、
  `setExpanded(paths)`
- 选择：`getActiveNodePath()`、`setActiveNodePath(path)`
- 展示：方向、主题、本地化、缩放、尺寸调整和图像导出
- 检查：`listSubgraphs()`、`getDiagnostics()`
- 生命周期：`destroy()`

在 `destroy()` 后调用会修改状态的方法将抛出异常。`destroy()` 本身是幂等的。

回调和实例 API 使用 `NodePath` 数组，绝不将局部节点 ID 隐式视为全局标识。

## React

```tsx
import { useRef } from "react";
import {
  EinoWorkflowDAGReact,
  type EinoWorkflowDAGReactRef,
} from "eino-workflow-dag/react";
import "eino-workflow-dag/styles.css";

export function WorkflowView({ snapshot }) {
  const ref = useRef<EinoWorkflowDAGReactRef>(null);
  return (
    <EinoWorkflowDAGReact
      ref={ref}
      snapshot={snapshot}
      activeNodePath={["model"]}
      style={{ height: 480 }}
    />
  );
}
```

## Vue

```vue
<script setup lang="ts">
import { ref } from "vue";
import type { EinoWorkflowSnapshot } from "eino-workflow-dag";
import { EinoWorkflowDAGVue } from "eino-workflow-dag/vue";
import "eino-workflow-dag/styles.css";

defineProps<{ snapshot: EinoWorkflowSnapshot }>();
const activeNodePath = ref(["model"]);
</script>

<template>
  <EinoWorkflowDAGVue
    :snapshot="snapshot"
    :active-node-path="activeNodePath"
    style="height: 480px"
  />
</template>
```

## 主题、本地化和格式化

内置主题包括 `classic`、`ink` 和 `midnight`。可以通过
`registerWorkflowDAGTheme()` 注册应用主题，也可以传入包含 `base` 和 `tokens`
的实例主题定义。视觉 token 覆盖颜色、节点尺寸、路由样式、展开图标题、提示框和
布局间距。`interaction` 选项可以分别启用或禁用内置的展开、提示框、路由高亮、
键盘、平移和滚轮缩放行为。规范说明请参阅
[自定义契约](./CUSTOMIZATION.md)。

Eino `component` 值保持开放字符串。显式节点 `kind` 的优先级高于根据 component
推断。省略 `kind` 时，根据 component 的推断只影响内置视觉样式；默认标签仍原样
显示 component。需要稳定、跨生产端视觉语义的生产端应提供 `kind`。执行状态固定为
`success`、`failed` 或 `skipped`。解析后的 kind 和状态标签映射仍可通过
`locale.kinds` 和 `locale.statuses` 用于自定义展示。

`tooltipFormatter` 和 `nodeLabelFormatter` 接收渲染器拥有的普通数据。数据中包含
原始 Eino `component` 和节点 `metadata`，不会暴露 Cytoscape 对象。

默认节点标签展示节点名称、类型和可选的执行耗时。显式 `kind` 会提供固定技术标签
`LLM`、`I/O`、`CPU`、`Graph`、`Branch` 或 `Merge`，替代原始 Eino
`component`；省略 `kind` 时继续显示 `component` 作为回退。这些技术标签不随
locale 改变。此展示规则不会替换或修改回调与 formatter 可读取的原始 component
身份。

节点 `metadata` 会暴露给节点回调和 formatter。`onEdgeClick` 接收边的
`channels`、Eino 字段 `mappings`（包括 mapping metadata）和边 `metadata`。
当一条渲染关系同时表示 Eino 分支时，其 metadata 通过独立的 `branchMetadata`
和 `branchMetadataList` 提供。快照、图和执行层级的 metadata 保留在宿主持有的输入
快照中。节点 formatter 数据和渲染后的边还会暴露各自在图内的数值 `level`。

展示设置不会从快照 `metadata` 中读取。metadata 会原样传给宿主回调和 formatter，
渲染器不会赋予它语义。

## Level 布局模型

每个工作流图（包括每个展开的嵌套工作流）都拥有一组从 Level 0 开始编号的独立布局
轨道。渲染器根据 Eino 工作流拓扑和可选执行耗时推导这些 Level；应用不需要提供第二
套路径分类。

在每一图层中，Level 0 是节点实测耗时之和最大的 start-to-end 路由。缺失的耗时按
零计算；耗时相同时优先选择拓扑 hop 更多的路由；只要存在非 skipped 路由，就排除
skipped 节点。选中节点会被移除，然后重复相同的最长路由计算，依次分配 Level 1 到
N。嵌套工作流包装节点在父层只贡献自身耗时，其内部图会独立计算一组 Level。

同一图中相同 Level 的节点共享一条交叉轴轨道。展开的工作流节点会将其内部 Level 0
中线与外层分配给包装节点的 Level 对齐。Level 0 是参考轨道；更高 Level 可以位于
其任意一侧（横向布局时为上方或下方，纵向布局时为左侧或右侧）。Level 所在的一侧
由图内 Level 连通性和平衡关系确定性推导，测量边界则决定该侧无碰撞的距离。展开
工作流可能将一条外层轨道推得更远，但不会让该轨道越过 Level 0。并行 Level 从同一
前驱边界开始，并根据各自分支的实际宽度独立前进；展开的工作流不会拉伸更短的并行
分支。汇合点从其直接前驱中最远的位置之后开始。

端口归属和边绘制先按 Level 升序、再按路径长度排序，因此相同规则会一致地应用于
Level 0 到 N。展开工作流的外部轨道端口与其内部 Level 0 轨道保持对齐。因此，当
通道无遮挡时，相邻的同 Level 节点使用直线连接；如果必须绕过中间节点或其他障碍，
同 Level 的边仍可能弯折。传给 `accessibilityLabelFormatter` 第二个参数的
`VisibleGraph` 值通过 `levelZeroPath` 和 `levelZeroDurationMs` 暴露根图第一条
轨道的摘要。

## Cytoscape 专用集成

稳定的根 API 不暴露渲染引擎。明确依赖 Cytoscape 的集成应使用专用适配器：

```js
import {
  createCytoscapeWorkflowDAG,
  getCytoscape,
} from "eino-workflow-dag/cytoscape";
import "eino-workflow-dag/styles.css";

// Reuse container and snapshot from Quick start.
const view = createCytoscapeWorkflowDAG(container, {
  snapshot,
  additionalStyles: [
    { selector: 'node[kind = "llm"]', style: { "border-width": 4 } },
  ],
});

const cy = getCytoscape(view);
```

这个子路径依赖具体实现。使用它的应用应针对自己的选择器和 Cytoscape 调用测试升级。

## 包入口

- `eino-workflow-dag` — 渲染器、协议校验、主题和类型
- `eino-workflow-dag/validation` — 仅数据校验入口
- `eino-workflow-dag/react` — React 适配器
- `eino-workflow-dag/vue` — Vue 适配器
- `eino-workflow-dag/cytoscape` — 实现专用适配器
- `eino-workflow-dag/styles.css` — 必需样式

React 和 Vue 都是可选 peer dependency。Cytoscape 是唯一的生产依赖。

Vanilla、React 和 Vue 的可运行集成源码统一收录在
[`examples/`](https://github.com/silicon-nora/eino-workflow-dag/tree/main/examples)。

如需在本地检查路由，请先构建包并提供仓库根目录的静态服务，然后打开交互式
[路由预览](https://github.com/silicon-nora/eino-workflow-dag/tree/main/tests/fixtures/routing-preview)。
其中包含四种布局方向下的串行、扇入、菱形、嵌套工作流、生产规模和压力测试用例。
浏览器测试套件会执行同一组矩阵。

## 支持与许可

公开稳定性和弃用规则记录在 [COMPATIBILITY.md](./COMPATIBILITY.md)。支持的运行时
与维护策略记录在 [SUPPORT.md](./SUPPORT.md) 和
[BROWSER_SUPPORT.md](./BROWSER_SUPPORT.md)。安全问题请按照
[SECURITY.md](./SECURITY.md) 报告。

本项目采用 [Apache-2.0](./LICENSE) 许可。第三方声明记录在
[THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md)。
