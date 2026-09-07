# Go projection

This module converts Eino `compose.GraphInfo` into the JSON-safe
`EinoWorkflowSnapshot` protocol consumed by the renderer.

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

	snapshot, err := workflowdag.Project(info)
	if err != nil {
		return err
	}
	return json.NewEncoder(os.Stdout).Encode(snapshot)
}
```

`Project` emits deterministic node, edge, branch, and field-mapping arrays.
It combines Eino control and data dependencies between the same endpoints into
one edge. Static-value mapping records have no predecessor and are omitted.

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
including nested paths such as `[]string{"answer", "invoke"}`. It records
running, success, and failed states plus start, finish, duration, and error
message fields. Streaming callbacks measure component invocation latency; an
error raised later while consuming a returned stream is not visible through
Eino's `OnError` callback and must be added by the stream consumer.

The supported Eino range is `>=0.9.0 <0.10.0`. CI tests the oldest supported
release and `v0.9.19`, the stable release used by this module. A real compiled
and invoked Workflow produces the topology and execution state consumed by the
JavaScript validator through the shared fixture in
`fixtures/eino-workflow-v1.json`.
