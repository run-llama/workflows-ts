import type { Workflow } from "@llamaindex/workflow-core";
import Sigma from "sigma";
import type { Settings } from "sigma/settings";
import { withGraph } from "./graph";
import { toSigma } from "./sigma";
import ForceSupervisor from "graphology-layout-force/worker";

export type DrawingOptions = {
  layout?: "force" | "none";
} & Partial<Settings>;

export type WithDrawingWorkflow = {
  draw(container: HTMLElement, options?: DrawingOptions): void;
};

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
