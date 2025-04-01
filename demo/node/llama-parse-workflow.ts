import { llamaParseWorkflow } from "../workflows/llama-parse-workflow.js";
import { promiseHandler } from "@llamaindex/flow/interrupter/promise";

promiseHandler(llamaParseWorkflow, {
  inputFile: process.argv[2],
  apiKey: process.env.LLAMA_CLOUD_API!,
}).then(({ data }) => {
  console.log(data.markdown);
});
