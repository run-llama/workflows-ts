import type Graph from "graphology";

export function toNodeCanvasGraph(graph: Graph): Graph {
	const g = graph.copy();

	g.forEachNode((node, attr) => {
		if (attr.type === "handler") {
			g.mergeNodeAttributes(node, { size: 20, color: "red" });
			g.removeNodeAttribute(node, "type");
		}
		if (attr.type === "event") {
			g.mergeNodeAttributes(node, { size: 10, color: "blue" });
			g.removeNodeAttribute(node, "type");
		}
	});

	g.forEachEdge((edge) => {
		g.mergeEdgeAttributes(edge, { size: 3 });
	});

	return g;
}
