import { runWorkflow } from "@llama-flow/core/stream/run";
import {
  fileParseWorkflow,
  startEvent,
  stopEvent,
} from "../workflows/file-parse-agent.js";
import { until } from "@llama-flow/core/stream/until";
import { nothing } from "@llama-flow/core/stream/consumer";

const directory = "..";

const { state, sendEvent, stream } = fileParseWorkflow.createContext();

sendEvent(startEvent.with(directory));

await nothing(until(stream, stopEvent));

console.log("r", state.output);
