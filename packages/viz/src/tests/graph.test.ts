import { createWorkflow, workflowEvent } from "@llamaindex/workflow-core";
import { describe, expect, it } from "vitest";
import { withGraph } from "../graph";

describe("withGraph", () => {
  it("should return a workflow with getGraph method", () => {
    const workflow = createWorkflow();
    const workflowWithGraph = withGraph(workflow);

    expect(workflowWithGraph.getGraph).toBeDefined();
    expect(typeof workflowWithGraph.getGraph).toBe("function");
  });

  it("should preserve all original workflow methods", () => {
    const workflow = createWorkflow();
    const workflowWithGraph = withGraph(workflow);

    // Check that all original workflow methods are preserved
    expect(workflowWithGraph.handle).toBeDefined();
    expect(typeof workflowWithGraph.handle).toBe("function");
  });

  it("should create nodes and edges when handle is called", () => {
    const workflow = withGraph(createWorkflow());

    const event1 = workflowEvent();
    const event2 = workflowEvent();

    workflow.handle([event1], async () => {
      return event2.with();
    });

    const graph = workflow.getGraph();

    const allNodes = graph.nodes();
    const allEdges = graph.edges();
    const allHandlerNodes = graph.filterNodes(
      (_, attributes) => attributes.type === "handler",
    );

    expect(allNodes.length).toBe(3);
    expect(allEdges.length).toBe(2);
    expect(allHandlerNodes.length).toBe(1);
  });

  it("should increment handler counter for each handler", () => {
    const workflow = createWorkflow();
    const workflowWithGraph = withGraph(workflow);

    const event1 = workflowEvent<string>({ debugLabel: "event1" });
    const event2 = workflowEvent<string>({ debugLabel: "event2" });
    const event3 = workflowEvent<string>({ debugLabel: "event3" });
    const stopEvent = workflowEvent<string>({ debugLabel: "stop" });

    workflowWithGraph.handle([event1], async (ctx) => {
      return event2.with("data 1");
    });

    workflowWithGraph.handle([event2], async (ctx) => {
      return event3.with("data 2");
    });

    workflowWithGraph.handle([event3], async (ctx) => {
      return stopEvent.with("data 3");
    });

    const graph = workflowWithGraph.getGraph();

    // Check that handlers have sequential names
    const handler1 = graph.findNode(
      (_node, attributes) => attributes.label === "Handler 1",
    );
    const handler2 = graph.findNode(
      (_node, attributes) => attributes.label === "Handler 2",
    );
    const handler3 = graph.findNode(
      (_node, attributes) => attributes.label === "Handler 3",
    );

    expect(handler1).toBeDefined();
    expect(handler2).toBeDefined();
    expect(handler3).toBeDefined();
  });

  it("should detect context.sendEvent and sendEvent calls", () => {
    const workflow = createWorkflow();
    const workflowWithGraph = withGraph(workflow);

    const eventA = workflowEvent({ debugLabel: "eventA" });
    const eventB1 = workflowEvent({ debugLabel: "eventB1" });
    const eventB2 = workflowEvent({ debugLabel: "eventB2" });
    const stopEvent = workflowEvent({ debugLabel: "stop" });

    workflowWithGraph.handle([eventA], async (ctx) => {
      const { sendEvent } = ctx;
      ctx.sendEvent(eventB1.with()); // ctx.sendEvent should be detected
      sendEvent(eventB2.with()); // sendEvent should be detected
    });

    workflowWithGraph.handle([eventB1], async (ctx) => {
      return stopEvent.with();
    });

    workflowWithGraph.handle([eventB2], async (ctx) => {
      return stopEvent.with();
    });

    const graph = workflowWithGraph.getGraph();

    const eventB1Node = graph.findNode(
      (_node, attributes) => attributes.label === "eventB1Event",
    );
    const eventB2Node = graph.findNode(
      (_node, attributes) => attributes.label === "eventB2Event",
    );

    expect(eventB1Node).toBeDefined();
    expect(eventB2Node).toBeDefined();
  });

  it("should handle complex workflow with multiple events and handlers", () => {
    const startEvent = workflowEvent<string>({
      debugLabel: "start",
    });
    const branchAEvent = workflowEvent<string>({
      debugLabel: "branchA",
    });
    const branchBEvent = workflowEvent<string>({
      debugLabel: "branchB",
    });
    const branchCEvent = workflowEvent<string>({
      debugLabel: "branchC",
    });
    const branchCompleteEvent = workflowEvent<string>({
      debugLabel: "branchComplete",
    });
    const allCompleteEvent = workflowEvent<string>({
      debugLabel: "allComplete",
    });
    const stopEvent = workflowEvent<string>({
      debugLabel: "stop",
    });

    const workflow = withGraph(createWorkflow());

    workflow.handle([startEvent], async (ctx) => {
      const { sendEvent, stream } = ctx;
      sendEvent(branchAEvent.with("Branch A"));
      sendEvent(branchBEvent.with("Branch B"));
      sendEvent(branchCEvent.with("Branch C"));

      const results = await stream
        .filter(branchCompleteEvent)
        .take(3)
        .toArray();

      return allCompleteEvent.with(results.map((e) => e.data).join(", "));
    });

    workflow.handle([branchAEvent], (ctx, branchA) => {
      return branchCompleteEvent.with(branchA.data);
    });

    workflow.handle([branchBEvent], (ctx, branchB) => {
      return branchCompleteEvent.with(branchB.data);
    });

    workflow.handle([branchCEvent], (ctx, branchC) => {
      return branchCompleteEvent.with(branchC.data);
    });

    workflow.handle([allCompleteEvent], (ctx, allComplete) => {
      return stopEvent.with(allComplete.data);
    });

    const graph = workflow.getGraph();

    expect(graph.nodes().length).toBe(12);
    expect(graph.edges().length).toBe(14);
  });
});
