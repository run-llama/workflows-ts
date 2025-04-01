import {
  fileParseWorkflow,
  messageEvent,
} from "../workflows/file-parse-agent.js";
import { from, filter } from "rxjs";
import { eventSource } from "@llamaindex/flow";
import type { WorkflowEventData } from "@llamaindex/flow";

const directory = "..";

const { stream, sendEvent } = fileParseWorkflow.createContext();

from(stream as unknown as AsyncIterable<WorkflowEventData<any>>)
  .pipe(filter((ev) => eventSource(ev) === messageEvent))
  .subscribe((ev) => {
    console.log(ev.data);
  });

sendEvent(fileParseWorkflow.startEvent(directory));
