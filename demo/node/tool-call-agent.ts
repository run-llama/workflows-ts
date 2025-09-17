import { runWorkflow } from "@llamaindex/workflow-core/stream/run";
import {
  startEvent,
  stopEvent,
  toolCallWorkflow,
} from "./workflows/tool-call-agent.js";

runWorkflow(
  toolCallWorkflow,
  startEvent.with("what is weather today, im in san francisco"),
  stopEvent,
).then(({ data }) => {
  console.log("AI response", data);
});
