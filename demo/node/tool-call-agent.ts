import { promiseHandler } from "fluere/interrupter/promise";
import {
  toolCallWorkflow,
  startEvent,
  stopEvent,
} from "../workflows/tool-call-agent.js";

promiseHandler(
  toolCallWorkflow,
  startEvent.with("what is weather today, im in san francisco"),
  stopEvent,
).then(({ data }) => {
  console.log("AI response", data);
});
