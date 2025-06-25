import {
  fileParseWorkflow,
  messageEvent,
  startEvent,
} from "../workflows/file-parse-agent.js";
import { filter, map } from "rxjs";
import { eventSource } from "@llamaindex/workflow-core";
import { toObservable } from "@llamaindex/workflow-core/observable";

const directory = "..";

const { stream, sendEvent } = fileParseWorkflow.createContext();

toObservable(stream)
  .pipe(
    filter((ev) => eventSource(ev) === messageEvent),
    map((ev) => ev.data),
  )
  .subscribe((data) => {
    console.log(data);
  });

sendEvent(startEvent.with(directory));
