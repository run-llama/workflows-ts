import { withDrawingNode } from "@llamaindex/workflow-viz-node";
import { setupWorkflowEvents } from "./workflow";
import { createWorkflow } from "@llamaindex/workflow-core";

async function main() {
  const workflow = withDrawingNode(createWorkflow());
  setupWorkflowEvents(workflow);

  await workflow.drawToImage({
    layout: "force",
    width: 800,
    height: 600,
    output: "workflow.png",
  });
}

main().catch(console.error);
