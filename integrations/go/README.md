# Go projection

This module converts Eino `compose.GraphInfo` into the JSON-safe
`EinoWorkflowSnapshot` protocol consumed by the renderer.

## Install

```bash
go get github.com/silicon-nora/eino-workflow-dag/integrations/go@v1.2.0
```

The module is versioned independently from the npm package. Because its
`go.mod` lives in this repository subdirectory, Go releases use tags prefixed
with the module directory, such as `integrations/go/v1.2.0`.

```go
package main

import (
	"context"
	"encoding/json"
	"os"

	workflowdag "github.com/silicon-nora/eino-workflow-dag/integrations/go"
	"github.com/cloudwego/eino/compose"
)

type compileCallback func(context.Context, *compose.GraphInfo)

func (callback compileCallback) OnFinish(ctx context.Context, info *compose.GraphInfo) {
	callback(ctx, info)
}

func writeSnapshot(ctx context.Context, workflow *compose.Workflow[string, string]) error {
	var info *compose.GraphInfo
	_, err := workflow.Compile(
		ctx,
		compose.WithGraphCompileCallbacks(compileCallback(
			func(_ context.Context, graph *compose.GraphInfo) { info = graph },
		)),
	)
	if err != nil {
		return err
	}

	snapshot, err := workflowdag.ProjectWithOptions(info, workflowdag.ProjectOptions{
		ResolveNodeKind: func(
			path []string,
			_ compose.GraphNodeInfo,
		) (workflowdag.NodeKind, bool) {
			switch {
			case len(path) == 1 && path[0] == "prepare":
				return workflowdag.NodeKindIO, true
			case len(path) == 1 && path[0] == "route":
				return workflowdag.NodeKindBranch, true
			case len(path) == 2 && path[0] == "answer" && path[1] == "invoke":
				return workflowdag.NodeKindLLM, true
			default:
				return "", false
			}
		},
	})
	if err != nil {
		return err
	}
	return json.NewEncoder(os.Stdout).Encode(snapshot)
}
```

`ProjectWithOptions` emits schema version 1 with optional node kinds. Its
resolver receives a full node path so nested graphs can reuse local node IDs
without collisions. Nested graph
nodes are always emitted with `kind: "graph"`; leaf nodes for which the
resolver returns `false` omit `kind` and retain the renderer's component-based
fallback. A resolver may return `llm`, `io`, `cpu`, `branch`, or `merge`;
`graph` is assigned automatically to nodes containing a nested workflow.

The original `Project` and `Marshal` functions continue to omit `kind`. This
keeps their existing output stable. New producers that need explicit visual
semantics should use `ProjectWithOptions` or `MarshalWithOptions` and upgrade
the JavaScript renderer at the same time.

Both projection APIs emit deterministic node, edge, branch, and field-mapping
arrays. They combine Eino control and data dependencies between the same
endpoints into one edge. Static-value mapping records have no predecessor and
are omitted.

Execution state is intentionally not inferred from `GraphInfo`. Use one
`ExecutionRecorder` for each invocation and attach its result separately:

```go
recorder := workflowdag.NewExecutionRecorder("run-42")
_, err := runnable.Invoke(
	ctx,
	input,
	compose.WithCallbacks(recorder.Handler()),
)

execution := recorder.Execution()
snapshot.Execution = &execution
```

The recorder uses Eino's hierarchical execution address to produce node paths,
including nested paths such as `[]string{"answer", "invoke"}`. It emits only
final `success` and `failed` node records plus start, finish, duration, and error
message fields. A node that has started but not finished is omitted from the
returned execution snapshot.

Eino's generic callbacks do not expose skipped nodes. When routing or
observability data authoritatively identifies one, call
`recorder.MarkSkipped([]string{"path", "to", "node"})`; it emits `skipped`
with `durationMs: null`. An error raised later while consuming a returned stream
is not visible through Eino's `OnError` callback and must be added by the stream
consumer.

The supported Eino range is `>=0.9.0 <0.10.0`. CI tests the oldest supported
release and `v0.9.19`, the stable release used by this module. A real compiled
and invoked Workflow produces the topology and execution state consumed by the
JavaScript validator through the shared fixture in
`fixtures/eino-workflow-v1.json`.
