import {
  type WorkflowContext,
  type Workflow as WorkflowCore,
  workflowEvent,
  getContext,
  type WorkflowEvent,
  type WorkflowEventData,
} from "@llama-flow/core";
import type { HandlerContext } from "../core/context";

const snapshotEvent = workflowEvent<WorkflowEvent<any>>();

export const request = <T>(
  event: WorkflowEvent<T>,
): WorkflowEventData<WorkflowEvent<T>> => {
  return snapshotEvent.with(event);
};

export function withSnapshot<Workflow extends WorkflowCore>(
  workflow: Workflow,
): Workflow {
  const contextMap = new WeakMap<WorkflowContext, Set<HandlerContext>>();
  // fallback handle for snapshotEvent
  // workflow.handle([snapshotEvent], () => {
  //   const context = getContext()
  //   const handlerContext = contextMap.get(context)
  //   if (!handlerContext) {
  //     console.warn('cannot find context')
  //   }
  // })
  return {
    ...workflow,
    handle: (...args) => {
      const events = args[0];
      if (events.includes(snapshotEvent)) {
        throw new TypeError("You cannot handle snapshot event in workflow");
      }
      return workflow.handle(...args);
    },
    createContext(): WorkflowContext {
      const context = workflow.createContext();
      context.__internal__call_context.subscribe((args, next) => {
        next(args);
      });
      return context;
    },
  };
}
