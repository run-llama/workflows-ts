import {
  fileParseWorkflow,
  messageEvent,
  startEvent,
} from "../workflows/file-parse-agent.js";
import { from, filter } from "rxjs";
import { eventSource } from "@llama-flow/core";
import type { WorkflowEventData } from "@llama-flow/core";

const directory = "..";

const { stream, sendEvent } = fileParseWorkflow.createContext();

from(stream as unknown as AsyncIterable<WorkflowEventData<any>>)
  .pipe(filter((ev) => eventSource(ev) === messageEvent))
  .subscribe((ev) => {
    console.log(ev.data);
  });

sendEvent(startEvent.with(directory));
