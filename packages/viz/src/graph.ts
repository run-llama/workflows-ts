import { type Handler, type Workflow } from "@llamaindex/workflow-core";
import Graph from "graphology";
import type { ResultType } from "./types";
import type { AcceptEventsType } from "./types";
import {
  getAwaitedEventNames,
  getReturnedEventName,
  getSentEventNames,
} from "./parser";

export type WithGraphWorkflow = {
  getGraph(): Graph;
};

export function withGraph<WorkflowLike extends Workflow>(
  workflow: WorkflowLike,
): WithGraphWorkflow & WorkflowLike {
  const graph = new Graph();
  let counter = 1; // handle counter

  return {
    ...workflow,
    handle: <AcceptEvents extends AcceptEventsType, Result extends ResultType>(
      accept: AcceptEvents,
      handler: Handler<AcceptEvents, Result>,
    ): void => {
      const nodeName = `Handler ${counter++}`;
      const inEvents = [
        ...accept.map((event) => ensureEventName(event.debugLabel)),
        ...getAwaitedEventNames(handler).map(ensureEventName),
      ];
      const outEvents = [
        ensureEventName(getReturnedEventName(handler)),
        ...getSentEventNames(handler).map(ensureEventName),
      ];

      graph.addNode(nodeName, {
        type: "handler",
        label: nodeName,
      });

      for (const inEvent of inEvents) {
        graph.mergeNode(inEvent, {
          type: "event",
          label: inEvent,
        });
        graph.addEdge(inEvent, nodeName);
      }
      for (const outEvent of outEvents) {
        graph.mergeNode(outEvent, {
          type: "event",
          label: outEvent,
        });
        graph.addEdge(nodeName, outEvent);
      }

      return workflow.handle(accept, handler);
    },
    getGraph: () => graph,
  };
}

function ensureEventName(name: string | undefined): string {
  if (!name) {
    return "unknown";
  }
  return name.endsWith("Event") || name.endsWith("event")
    ? name
    : `${name}Event`;
}
