import {
  fileParseWorkflow,
  startEvent,
  stopEvent,
} from "../workflows/file-parse-agent.js";

const directory = "..";

const { state, sendEvent, stream } = fileParseWorkflow.createContext();

sendEvent(startEvent.with(directory));

await stream.until(stopEvent).toArray();

console.log(state.output);
