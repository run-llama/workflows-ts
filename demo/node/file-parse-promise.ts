import { promiseHandler } from "fluere/interrupter/promise";
import {
  fileParseWorkflow,
  startEvent,
  stopEvent,
} from "../workflows/file-parse-agent.js";

const directory = "..";

promiseHandler(fileParseWorkflow, startEvent.with(directory), stopEvent).then(
  () => {
    console.log("r", fileParseWorkflow.getStore().output);
  },
);
