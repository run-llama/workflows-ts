import { runWorkflow } from "@llama-flow/core/stream/run";
import {
  fileParseWorkflow,
  startEvent,
  stopEvent,
} from "../workflows/file-parse-agent.js";

const directory = "..";

runWorkflow(fileParseWorkflow, startEvent.with(directory), stopEvent).then(
  () => {
    console.log("r", fileParseWorkflow.getStore().output);
  },
);
