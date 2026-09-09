package einoworkflowsnapshot

import (
	"context"
	"encoding/json"
	"errors"
	"os"
	"reflect"
	"testing"

	"github.com/cloudwego/eino/compose"
)

type graphInfoCallback func(context.Context, *compose.GraphInfo)

func (callback graphInfoCallback) OnFinish(ctx context.Context, info *compose.GraphInfo) {
	callback(ctx, info)
}

func TestProjectGraphInfo(t *testing.T) {
	branch := compose.NewGraphBranch(
		func(_ context.Context, _ string) (string, error) { return "answer", nil },
		map[string]bool{"end": true, "answer": true},
	)
	nested := &compose.GraphInfo{
		Name:  "nested",
		Nodes: map[string]compose.GraphNodeInfo{"inner": {Component: compose.ComponentOfLambda}},
		Edges: map[string][]string{"start": {"inner"}, "inner": {"end"}},
	}
	info := &compose.GraphInfo{
		Name: "fixture",
		Nodes: map[string]compose.GraphNodeInfo{
			"route": {Component: compose.ComponentOfLambda},
			"answer": {
				Name:      "Answer",
				Component: compose.ComponentOfGraph,
				GraphInfo: nested,
			},
		},
		Edges:     map[string][]string{"start": {"route"}, "route": {"answer"}},
		DataEdges: map[string][]string{"start": {"route"}, "route": {"answer"}},
		Branches:  map[string][]compose.GraphBranch{"route": {*branch}},
	}
	snapshot, err := Project(info)
	if err != nil {
		t.Fatal(err)
	}
	if snapshot.SchemaVersion != 1 || snapshot.Workflow.Name != "fixture" {
		t.Fatalf("unexpected snapshot header: %#v", snapshot)
	}
	if got := []string{snapshot.Workflow.Nodes[0].ID, snapshot.Workflow.Nodes[1].ID}; !reflect.DeepEqual(got, []string{"answer", "route"}) {
		t.Fatalf("nodes are not deterministic: %v", got)
	}
	if snapshot.Workflow.Nodes[0].Workflow == nil {
		t.Fatal("nested graph was not projected")
	}
	if got := snapshot.Workflow.Edges[0].Channels; !reflect.DeepEqual(got, []string{"control", "data"}) {
		t.Fatalf("edge channels were not merged: %v", got)
	}
	if got := snapshot.Workflow.Branches[0].Targets; !reflect.DeepEqual(got, []string{"answer", "end"}) {
		t.Fatalf("branch targets are not deterministic: %v", got)
	}

	encoded, err := json.Marshal(snapshot)
	if err != nil {
		t.Fatal(err)
	}
	if !json.Valid(encoded) {
		t.Fatal("snapshot is not valid JSON")
	}
}

func TestProjectWithOptionsAddsNodeKindsByFullPath(t *testing.T) {
	nested := &compose.GraphInfo{
		Nodes: map[string]compose.GraphNodeInfo{
			"invoke/model": {Component: compose.ComponentOfLambda},
		},
		Edges: map[string][]string{},
	}
	info := &compose.GraphInfo{
		Nodes: map[string]compose.GraphNodeInfo{
			"answer/flow": {
				Component: compose.ComponentOfGraph,
				GraphInfo: nested,
			},
			"route/strategy": {Component: compose.ComponentOfLambda},
		},
		Edges: map[string][]string{},
	}
	resolveKind := func(path []string) (NodeKind, bool) {
		switch {
		case reflect.DeepEqual(path, []string{"answer/flow", "invoke/model"}):
			return NodeKindLLM, true
		case reflect.DeepEqual(path, []string{"route/strategy"}):
			return NodeKindBranch, true
		default:
			return "", false
		}
	}
	seen := make([][]string, 0, 2)
	snapshot, err := ProjectWithOptions(info, ProjectOptions{
		ResolveNodeKind: func(path []string, _ compose.GraphNodeInfo) (NodeKind, bool) {
			seen = append(seen, append([]string(nil), path...))
			return resolveKind(path)
		},
	})
	if err != nil {
		t.Fatal(err)
	}
	if snapshot.SchemaVersion != SchemaVersion {
		t.Fatalf("unexpected schema version: %d", snapshot.SchemaVersion)
	}
	if got := snapshot.Workflow.Nodes[0].Kind; got != NodeKindGraph {
		t.Fatalf("nested workflow kind = %q, want %q", got, NodeKindGraph)
	}
	if got := snapshot.Workflow.Nodes[0].Workflow.Nodes[0].Kind; got != NodeKindLLM {
		t.Fatalf("nested leaf kind = %q, want %q", got, NodeKindLLM)
	}
	if got := snapshot.Workflow.Nodes[1].Kind; got != NodeKindBranch {
		t.Fatalf("route kind = %q, want %q", got, NodeKindBranch)
	}
	if !reflect.DeepEqual(seen, [][]string{{"answer/flow", "invoke/model"}, {"route/strategy"}}) {
		t.Fatalf("resolver paths = %v", seen)
	}

	marshaled, err := MarshalWithOptions(info, ProjectOptions{
		ResolveNodeKind: func(path []string, _ compose.GraphNodeInfo) (NodeKind, bool) {
			return resolveKind(path)
		},
	})
	if err != nil {
		t.Fatal(err)
	}
	var marshaledSnapshot Snapshot
	if err := json.Unmarshal(marshaled, &marshaledSnapshot); err != nil {
		t.Fatal(err)
	}
	actual, err := json.MarshalIndent(marshaledSnapshot, "", "  ")
	if err != nil {
		t.Fatal(err)
	}
	actual = append(actual, '\n')
	expected, err := os.ReadFile("../../fixtures/eino-workflow-kind-v1.json")
	if err != nil {
		t.Fatal(err)
	}
	if string(actual) != string(expected) {
		t.Fatalf("node-kind projection does not match shared fixture\nactual:\n%s", actual)
	}
}

func TestProjectWithOptionsRejectsInvalidNodeKind(t *testing.T) {
	info := &compose.GraphInfo{
		Nodes: map[string]compose.GraphNodeInfo{
			"leaf": {Component: compose.ComponentOfLambda},
		},
		Edges: map[string][]string{},
	}
	for _, kind := range []NodeKind{"custom", NodeKindGraph} {
		_, err := ProjectWithOptions(info, ProjectOptions{
			ResolveNodeKind: func([]string, compose.GraphNodeInfo) (NodeKind, bool) {
				return kind, true
			},
		})
		if !errors.Is(err, ErrInvalidNodeKind) {
			t.Fatalf("kind %q: expected ErrInvalidNodeKind, got %v", kind, err)
		}
	}
}

func TestRealWorkflowMatchesSharedFixture(t *testing.T) {
	type prepared struct {
		Text string
	}

	nested := compose.NewGraph[string, string]()
	if err := nested.AddLambdaNode(
		"invoke",
		compose.InvokableLambda(func(_ context.Context, input string) (string, error) { return input, nil }),
		compose.WithNodeName("Invoke"),
	); err != nil {
		t.Fatal(err)
	}
	if err := nested.AddBranch(compose.START, compose.NewGraphBranch(
		func(_ context.Context, input string) (string, error) {
			if input == "" {
				return compose.END, nil
			}
			return "invoke", nil
		},
		map[string]bool{"invoke": true, compose.END: true},
	)); err != nil {
		t.Fatal(err)
	}
	if err := nested.AddEdge("invoke", compose.END); err != nil {
		t.Fatal(err)
	}

	workflow := compose.NewWorkflow[string, map[string]any]()
	workflow.AddLambdaNode(
		"prepare",
		compose.InvokableLambda(func(_ context.Context, input string) (prepared, error) {
			return prepared{Text: input}, nil
		}),
		compose.WithNodeName("Prepare"),
	).AddInput(compose.START)
	workflow.AddGraphNode(
		"answer",
		nested,
		compose.WithNodeName("Answer"),
	).AddInputWithOptions(
		"route",
		[]*compose.FieldMapping{compose.FromField("Text")},
		compose.WithNoDirectDependency(),
	)
	workflow.AddLambdaNode(
		"fallback",
		compose.InvokableLambda(func(_ context.Context, input string) (string, error) { return input, nil }),
		compose.WithNodeName("Fallback"),
	).AddInputWithOptions(
		"route",
		[]*compose.FieldMapping{compose.FromField("Text")},
		compose.WithNoDirectDependency(),
	)
	workflow.AddLambdaNode(
		"route",
		compose.InvokableLambda(func(_ context.Context, input prepared) (prepared, error) { return input, nil }),
		compose.WithNodeName("Route"),
	).AddInput("prepare")
	workflow.AddBranch("route", compose.NewGraphBranch(
		func(_ context.Context, input prepared) (string, error) {
			if input.Text == "" {
				return "fallback", nil
			}
			return "answer", nil
		},
		map[string]bool{"answer": true, "fallback": true},
	))
	workflow.End().AddInput("answer", compose.ToField("answer")).AddInput("fallback", compose.ToField("fallback"))

	var info *compose.GraphInfo
	runner, err := workflow.Compile(
		context.Background(),
		compose.WithGraphName("support-assistant"),
		compose.WithGraphCompileCallbacks(graphInfoCallback(func(_ context.Context, graph *compose.GraphInfo) {
			info = graph
		})),
	)
	if err != nil {
		t.Fatal(err)
	}
	if info == nil {
		t.Fatal("Eino did not invoke the graph compile callback")
	}
	recorder := NewExecutionRecorder("run-1")
	if _, err := runner.Invoke(
		context.Background(),
		"hello",
		compose.WithCallbacks(recorder.Handler()),
	); err != nil {
		t.Fatal(err)
	}
	// This test controls the branch input and can therefore authoritatively
	// identify the unselected route. Generic Eino callbacks do not report it.
	recorder.MarkSkipped([]string{"fallback"})
	execution := recorder.Execution()
	if len(execution.Nodes) == 0 {
		t.Fatal("Eino execution callbacks did not expose node paths")
	}
	if execution.StartedAtMS == nil || execution.FinishedAtMS == nil || execution.DurationMS == nil {
		t.Fatalf("workflow timing was not collected: %#v", execution)
	}
	foundSkipped := false
	for _, node := range execution.Nodes {
		if node.Status == NodeStatusSkipped {
			foundSkipped = true
			if !reflect.DeepEqual(node.Path, []string{"fallback"}) || node.DurationMS != nil {
				t.Fatalf("unexpected skipped execution state: %#v", node)
			}
		} else if node.Status != NodeStatusSuccess {
			t.Fatalf("unexpected execution state: %#v", execution)
		}
	}
	if !foundSkipped {
		t.Fatal("the unselected Eino branch was not represented as skipped")
	}

	snapshot, err := Project(info)
	if err != nil {
		t.Fatal(err)
	}
	snapshot.Execution = &Execution{ID: execution.ID}
	for _, node := range execution.Nodes {
		snapshot.Execution.Nodes = append(snapshot.Execution.Nodes, NodeExecution{
			Path:   node.Path,
			Status: node.Status,
		})
	}
	actual, err := json.MarshalIndent(snapshot, "", "  ")
	if err != nil {
		t.Fatal(err)
	}
	actual = append(actual, '\n')
	expected, err := os.ReadFile("../../fixtures/eino-workflow-v1.json")
	if err != nil {
		t.Fatal(err)
	}
	if string(actual) != string(expected) {
		t.Fatalf("real Eino projection does not match shared fixture\nactual:\n%s", actual)
	}

}

func TestExecutionRecorderCapturesFailure(t *testing.T) {
	wanted := errors.New("planned failure")
	workflow := compose.NewWorkflow[string, string]()
	workflow.AddLambdaNode(
		"fail",
		compose.InvokableLambda(func(_ context.Context, _ string) (string, error) {
			return "", wanted
		}),
	).AddInput(compose.START)
	workflow.End().AddInput("fail")
	runner, err := workflow.Compile(context.Background())
	if err != nil {
		t.Fatal(err)
	}

	recorder := NewExecutionRecorder("failed-run")
	if _, err := runner.Invoke(
		context.Background(),
		"input",
		compose.WithCallbacks(recorder.Handler()),
	); !errors.Is(err, wanted) {
		t.Fatalf("expected planned failure, got %v", err)
	}
	execution := recorder.Execution()
	if len(execution.Nodes) != 1 {
		t.Fatalf("expected one failed node, got %#v", execution.Nodes)
	}
	node := execution.Nodes[0]
	if !reflect.DeepEqual(node.Path, []string{"fail"}) || node.Status != "failed" || node.ErrorMessage != wanted.Error() {
		t.Fatalf("unexpected failed node state: %#v", node)
	}
}

func TestExecutionRecorderUsesErrorPresenceForFailure(t *testing.T) {
	wanted := errors.New("")
	workflow := compose.NewWorkflow[string, string]()
	workflow.AddLambdaNode(
		"fail",
		compose.InvokableLambda(func(_ context.Context, _ string) (string, error) {
			return "", wanted
		}),
	).AddInput(compose.START)
	workflow.End().AddInput("fail")
	runner, err := workflow.Compile(context.Background())
	if err != nil {
		t.Fatal(err)
	}

	recorder := NewExecutionRecorder("empty-message-failure")
	if _, err := runner.Invoke(
		context.Background(),
		"input",
		compose.WithCallbacks(recorder.Handler()),
	); !errors.Is(err, wanted) {
		t.Fatalf("expected empty-message failure, got %v", err)
	}
	execution := recorder.Execution()
	if len(execution.Nodes) != 1 {
		t.Fatalf("expected one failed node, got %#v", execution.Nodes)
	}
	node := execution.Nodes[0]
	if !reflect.DeepEqual(node.Path, []string{"fail"}) || node.Status != NodeStatusFailed || node.ErrorMessage != "" {
		t.Fatalf("non-nil error with an empty message must remain failed: %#v", node)
	}
}

func TestExecutionRecorderOmitsUnfinishedAndMarksSkipped(t *testing.T) {
	recorder := NewExecutionRecorder("partial-run")
	recorder.recordStart([]string{"unfinished"})
	recorder.MarkSkipped([]string{"route", "unused"})

	execution := recorder.Execution()
	if len(execution.Nodes) != 1 {
		t.Fatalf("expected only the final skipped record, got %#v", execution.Nodes)
	}
	node := execution.Nodes[0]
	if !reflect.DeepEqual(node.Path, []string{"route", "unused"}) || node.Status != NodeStatusSkipped {
		t.Fatalf("unexpected skipped node state: %#v", node)
	}
	if node.DurationMS != nil || node.StartedAtMS != nil || node.FinishedAtMS != nil {
		t.Fatalf("skipped node must not have timing: %#v", node)
	}

	encoded, err := json.Marshal(node)
	if err != nil {
		t.Fatal(err)
	}
	if string(encoded) != `{"path":["route","unused"],"status":"skipped","durationMs":null}` {
		t.Fatalf("unexpected skipped JSON: %s", encoded)
	}
}

func TestProjectRejectsInvalidGraphInfo(t *testing.T) {
	if _, err := Project(nil); !errors.Is(err, ErrNilGraphInfo) {
		t.Fatalf("expected ErrNilGraphInfo, got %v", err)
	}

	info := &compose.GraphInfo{Nodes: map[string]compose.GraphNodeInfo{}, Edges: map[string][]string{}}
	info.Nodes["self"] = compose.GraphNodeInfo{GraphInfo: info}
	if _, err := Project(info); !errors.Is(err, ErrRecursiveGraphInfo) {
		t.Fatalf("expected ErrRecursiveGraphInfo, got %v", err)
	}
}
