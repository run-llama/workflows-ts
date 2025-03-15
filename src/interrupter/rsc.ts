import type { Workflow, WorkflowEvent } from "../core";
import type { ComponentType } from "react";
import { createStreamableUI } from "ai/rsc";
import { createElement } from "react";

const runWithoutBlocking = (fn: () => Promise<unknown>): void => {
  fn().catch();
};

export const createRSCHandler = <Start, Stop>(
  workflow: Workflow<Start, Stop>,
  eventMap: Map<WorkflowEvent<any>, ComponentType>,
) => {
  return (start: Start) => {
    const uiWrapper = createStreamableUI();
    const executor = workflow.run(workflow.startEvent(start));

    runWithoutBlocking(async () => {
      for await (const event of executor) {
        const UI = eventMap.get(event.event);
        if (UI) {
          uiWrapper.update(createElement(UI, {}));
        }
      }
    });

    return uiWrapper.value;
  };
};
