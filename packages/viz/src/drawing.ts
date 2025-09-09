import type { Workflow } from "@llamaindex/workflow-core";
import ForceSupervisor from "graphology-layout-force/worker";
import Sigma from "sigma";
import type { Settings } from "sigma/settings";
import { withGraph } from "./graph";
import { toSigma } from "./sigma";

export type DrawingOptions = {
  layout?: "force" | "none";
} & Partial<Settings>;

export type WithDrawingWorkflow = {
  draw(container: HTMLElement, options?: DrawingOptions): void;
};

/**
 * Adds visualization capabilities to a workflow, enabling it to be rendered as an interactive graph.
 *
 * This function enhances a workflow with drawing functionality, allowing you to visualize
 * the flow of events and handlers as an interactive graph in the browser using Sigma.js.
 *
 * @typeParam WorkflowLike - The workflow type to enhance with drawing capabilities
 *
 * @param workflow - The workflow instance to add visualization to
 * @returns The workflow enhanced with a `draw` method for rendering graphs
 *
 * @example
 * ```typescript
 * import { createWorkflow, workflowEvent } from "@llamaindex/workflow-core";
 * import { withDrawing } from "@llamaindex/workflow-viz";
 *
 * // Define events with debug labels for better visualization
 * const startEvent = workflowEvent<string>({ debugLabel: "start" });
 * const processEvent = workflowEvent<string>({ debugLabel: "process" });
 * const endEvent = workflowEvent<string>({ debugLabel: "end" });
 *
 * // Create workflow with drawing capabilities
 * const workflow = withDrawing(createWorkflow());
 *
 * // Add handlers
 * workflow.handle([startEvent], (context, event) => {
 *   return processEvent.with(`Processing: ${event.data}`);
 * });
 *
 * workflow.handle([processEvent], (context, event) => {
 *   return endEvent.with(`Completed: ${event.data}`);
 * });
 *
 * // Render the workflow graph
 * const container = document.getElementById("workflow-container");
 * workflow.draw(container, {
 *   layout: "force",
 *   defaultEdgeColor: "#999",
 *   defaultNodeColor: "#333"
 * });
 * ```
 *
 * @category Visualization
 * @public
 */
export function withDrawing<WorkflowLike extends Workflow>(
  workflow: WorkflowLike,
): WorkflowLike & WithDrawingWorkflow {
  const workflowWithGraph = withGraph(workflow);

  return {
    ...workflowWithGraph,
    draw: (container: HTMLElement, options?: DrawingOptions) => {
      const graph = toSigma(workflowWithGraph.getGraph());

      // simple radial positions so nodes don't overlap before layout
      const nodes = graph.nodes();
      const order = graph.order || nodes.length || 1;
      nodes.forEach((node, i) => {
        const angle = (i * 2 * Math.PI) / order;
        graph.setNodeAttribute(node, "x", 100 * Math.cos(angle));
        graph.setNodeAttribute(node, "y", 100 * Math.sin(angle));
      });

      // default to force layout unless explicitly disabled
      if ((options?.layout ?? "force") === "force") {
        const layout = new ForceSupervisor(graph);
        layout.start();
      }

      // create sigma renderer
      const { layout: _layout, ...sigmaSettings } = options ?? {};
      void _layout;
      new Sigma(graph, container, sigmaSettings);
    },
  };
}
