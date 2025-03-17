import type { Workflow, WorkflowEvent, WorkflowEventData } from "fluere";
import { eventSource } from "fluere";

export function logger<Start, Stop>(
  workflow: Workflow<Start, Stop>,
  logMap: WeakMap<WorkflowEvent<any>, (data: WorkflowEventData<any>) => void>,
): Workflow<Start, Stop> {
  const originalRun = workflow.run;
  return {
    ...workflow,
    run: (start) => {
      const executor = originalRun(start);
      const iterator = executor[Symbol.asyncIterator]();
      executor[Symbol.asyncIterator] = () => {
        const asyncIterator = {
          next: async () => {
            const result = await iterator.next();
            if (result.done) {
              return result;
            }
            const event = result.value;
            const logFn = logMap.get(eventSource(event));
            if (logFn) {
              logFn(event.data);
            }
            return result;
          },
          [Symbol.asyncIterator]: () => {
            return asyncIterator;
          },
        };
        return asyncIterator;
      };
      return executor;
    },
    get startEvent() {
      return workflow.startEvent;
    },
    get stopEvent() {
      return workflow.stopEvent;
    },
  };
}
