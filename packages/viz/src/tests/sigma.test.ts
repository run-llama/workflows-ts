import Graph from "graphology";
import { describe, expect, it } from "vitest";
import { toSigma } from "../sigma";

describe("toSigma", () => {
  it("should transform handler nodes with correct attributes", () => {
    const graph = new Graph();
    graph.addNode("handler1", { type: "handler", label: "Handler 1" });
    graph.addNode("handler2", { type: "handler", label: "Handler 2" });

    const result = toSigma(graph);

    expect(result.getNodeAttribute("handler1", "size")).toBe(20);
    expect(result.getNodeAttribute("handler1", "color")).toBe("red");
    expect(result.getNodeAttribute("handler1", "type")).toBeUndefined();
    expect(result.getNodeAttribute("handler1", "label")).toBe("Handler 1");

    expect(result.getNodeAttribute("handler2", "size")).toBe(20);
    expect(result.getNodeAttribute("handler2", "color")).toBe("red");
    expect(result.getNodeAttribute("handler2", "type")).toBeUndefined();
    expect(result.getNodeAttribute("handler2", "label")).toBe("Handler 2");
  });

  it("should transform event nodes with correct attributes", () => {
    const graph = new Graph();
    graph.addNode("event1", { type: "event", label: "Event 1" });
    graph.addNode("event2", { type: "event", label: "Event 2" });

    const result = toSigma(graph);

    expect(result.getNodeAttribute("event1", "size")).toBe(10);
    expect(result.getNodeAttribute("event1", "color")).toBe("blue");
    expect(result.getNodeAttribute("event1", "type")).toBeUndefined();
    expect(result.getNodeAttribute("event1", "label")).toBe("Event 1");

    expect(result.getNodeAttribute("event2", "size")).toBe(10);
    expect(result.getNodeAttribute("event2", "color")).toBe("blue");
    expect(result.getNodeAttribute("event2", "type")).toBeUndefined();
    expect(result.getNodeAttribute("event2", "label")).toBe("Event 2");
  });

  it("should transform edges with correct attributes", () => {
    const graph = new Graph();
    graph.addNode("node1", { label: "Node 1" });
    graph.addNode("node2", { label: "Node 2" });
    const edge = graph.addEdge("node1", "node2");

    const result = toSigma(graph);

    expect(result.getEdgeAttribute(edge, "type")).toBe("arrow");
    expect(result.getEdgeAttribute(edge, "size")).toBe(3);
  });
});
