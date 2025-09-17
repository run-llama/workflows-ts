import type { Workflow } from "@llamaindex/workflow-core";
import { withGraph } from "@llamaindex/workflow-graph";
import { createCanvas } from "canvas";
import fs from "fs";
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
				await forceLayout.assign(graph, { maxIterations: 200 });
			}

			// Compute bounding box for scaling
			let minX = Infinity,
				maxX = -Infinity,
				minY = Infinity,
				maxY = -Infinity;

			graph.forEachNode((_node, attr) => {
				const x = attr.x ?? 0;
				const y = attr.y ?? 0;
				if (x < minX) minX = x;
				if (x > maxX) maxX = x;
				if (y < minY) minY = y;
				if (y > maxY) maxY = y;
			});

			const padding = 50;
			const scaleX = (width - padding * 2) / (maxX - minX || 1);
			const scaleY = (height - padding * 2) / (maxY - minY || 1);

			const mapX = (x: number) => (x - minX) * scaleX + padding;
			const mapY = (y: number) => (y - minY) * scaleY + padding;

			// Create canvas
			const canvas = createCanvas(width, height);
			const ctx = canvas.getContext("2d");

			// Background
			ctx.fillStyle = "#ffffff";
			ctx.fillRect(0, 0, width, height);

			// Draw edges with arrows
			graph.forEachEdge((_edge, attr, source, target) => {
				const sx = mapX(graph.getNodeAttribute(source, "x"));
				const sy = mapY(graph.getNodeAttribute(source, "y"));
				const tx = mapX(graph.getNodeAttribute(target, "x"));
				const ty = mapY(graph.getNodeAttribute(target, "y"));

				const angle = Math.atan2(ty - sy, tx - sx);
				const arrowLength = 10;
				const arrowAngle = Math.PI / 6;

				ctx.strokeStyle = attr.color || "#999";
				ctx.lineWidth = attr.size ?? 2;
				ctx.beginPath();
				ctx.moveTo(sx, sy);
				ctx.lineTo(tx, ty);
				ctx.stroke();

				// Arrow head
				ctx.beginPath();
				ctx.moveTo(tx, ty);
				ctx.lineTo(
					tx - arrowLength * Math.cos(angle - arrowAngle),
					ty - arrowLength * Math.sin(angle - arrowAngle)
				);
				ctx.lineTo(
					tx - arrowLength * Math.cos(angle + arrowAngle),
					ty - arrowLength * Math.sin(angle + arrowAngle)
				);
				ctx.closePath();
				ctx.fillStyle = attr.color || "#999";
				ctx.fill();
			});

			// Draw nodes with labels
			graph.forEachNode((_node, attr) => {
				const x = mapX(attr.x ?? 0);
				const y = mapY(attr.y ?? 0);

				ctx.fillStyle = attr.color;
				ctx.beginPath();
				ctx.arc(x, y, attr.size ?? 10, 0, 2 * Math.PI);
				ctx.fill();

				if (attr.label) {
					ctx.fillStyle = "#000";
					ctx.font = "14px sans-serif";
					ctx.textAlign = "center";
					ctx.fillText(attr.label, x, y + (attr.size ?? 10) + 12); // below the node
				}
			});

			const buffer = canvas.toBuffer("image/png");
			if (options?.output) fs.writeFileSync(options.output, buffer);

			return buffer;
		},
	};
}
