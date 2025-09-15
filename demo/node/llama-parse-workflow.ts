import { runWorkflow } from "@llamaindex/workflow-core/stream/run";
import {
  llamaParseWorkflow,
  startEvent,
  stopEvent,
} from "./workflows/llama-parse-workflow.js";

runWorkflow(
  llamaParseWorkflow,
  startEvent.with({
    inputFile: process.argv[2],
    apiKey: process.env.LLAMA_CLOUD_API!,
  }),
  stopEvent,
).then(({ data }) => {
  console.log(data.markdown);
});
