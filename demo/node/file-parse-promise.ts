import { promiseHandler } from "@llamaindex/flow/interrupter/promise";
import { fileParseWorkflow } from "../workflows/file-parse-agent.js";

const directory = "..";

promiseHandler(fileParseWorkflow, directory).then((r) => {
  console.log("r", fileParseWorkflow.getStore().output);
});
