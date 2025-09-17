import type { Workflow } from "@llamaindex/workflow-core";
import { withGraph } from "@llamaindex/workflow-graph";
import { createCanvas } from "canvas";
import fs from "fs";
import { render } from "graphology-canvas";
import forceLayout from "graphology-layout-force";
import { toNodeCanvasGraph } from "./canvas";

export type DrawingOptionsNode = {
	layout?: "force" | "none";
	width?: number;
	height?: number;
	output?: string; // file path to save PNG
};

export type WithDrawingWorkflowNode = {
	drawToImage(options?: DrawingOptionsNode): Promise<Buffer>;
};

/**
 * Adds server-side drawing capabilities to a workflow, rendering to PNG in Node.
 */
export function withDrawingNode<WorkflowLike extends Workflow>(
	workflow: WorkflowLike
): WorkflowLike & WithDrawingWorkflowNode {
	const workflowWithGraph = withGraph(workflow);

	return {
		...workflowWithGraph,
		async drawToImage(options?: DrawingOptionsNode): Promise<Buffer> {
			const width = options?.width ?? 1200;
			const height = options?.height ?? 800;

			const graph = toNodeCanvasGraph(workflowWithGraph.getGraph());

			// Assign default radial positions to avoid overlaps
			const nodes = graph.nodes();
			const order = graph.order || nodes.length || 1;
			nodes.forEach((node, i) => {
				const angle = (i * 2 * Math.PI) / order;
				if (graph.getNodeAttribute(node, "x") === undefined)
					graph.setNodeAttribute(node, "x", 100 * Math.cos(angle));
				if (graph.getNodeAttribute(node, "y") === undefined)
					graph.setNodeAttribute(node, "y", 100 * Math.sin(angle));
			});

			// Apply force layout if requested
			if ((options?.layout ?? "force") === "force") {
				forceLayout.assign(graph, { maxIterations: 200 });
			}

			// Create canvas
			const canvas = createCanvas(width, height);
			const ctx = canvas.getContext("2d");

			// Optional background
			ctx.fillStyle = "#ffffff";
			ctx.fillRect(0, 0, width, height);

			// Render graph to canvas
			render(graph, ctx, { width, height });

			const buffer = canvas.toBuffer("image/png");

			if (options?.output) {
				fs.writeFileSync(options.output, buffer);
			}

			return buffer;
		},
	};
}
