# Examples / 示例

This directory contains only runnable source examples for public integrations.
Generated files are written to `.artifacts/`, and automated browser fixtures
live under `tests/`.

本目录只保留面向使用者的可运行集成源码。生成文件统一写入 `.artifacts/`，
浏览器自动化夹具统一放在 `tests/`。

| Directory | Purpose | 用途 |
| --- | --- | --- |
| [`vanilla`](./vanilla/) | Direct UMD usage | 直接使用 UMD 构建 |
| [`react`](./react/) | React adapter | React 适配器 |
| [`vue`](./vue/) | Vue adapter | Vue 适配器 |

## Run / 运行

Build the library and the React example, then serve the repository root:

先构建库与 React 示例，再从仓库根目录启动静态服务：

```sh
npm run build
npm run build:react-example
python3 -m http.server 4173 --bind 127.0.0.1
```

Open one of these pages:

- Vanilla: <http://127.0.0.1:4173/examples/vanilla/>
- React: <http://127.0.0.1:4173/.artifacts/examples/react/>
- Vue: <http://127.0.0.1:4173/examples/vue/>

The examples use neutral schema-v1 snapshots and the public package APIs. Test
hooks exposed on `window` exist only so the browser suite can verify adapter
lifecycle and interaction behavior.

示例使用中立的 schema-v1 快照和公开包 API。挂载在 `window` 上的测试钩子仅用于
浏览器套件验证适配器生命周期与交互行为。
