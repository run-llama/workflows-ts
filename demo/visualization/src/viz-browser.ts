import { withDrawing } from "@llamaindex/workflow-viz";
import "./style.css";
import { setupWorkflowEvents } from "./workflow";
import { createWorkflow } from "@llamaindex/workflow-core";

const container = document.getElementById("app") as HTMLElement;

const workflow = withDrawing(createWorkflow());

setupWorkflowEvents(workflow);

workflow.draw(container, {
  defaultEdgeColor: "#999",
  layout: "force",
});
