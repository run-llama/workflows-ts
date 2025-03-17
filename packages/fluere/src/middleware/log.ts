import type { Workflow, WorkflowEvent, WorkflowEventData } from "fluere";
import { eventSource } from "fluere";

export function logger<Start, Stop>(
  getExecutor: () => ReturnType<Workflow<Start, Stop>["run"]>,
  logMap: WeakMap<WorkflowEvent<any>, (data: WorkflowEventData<any>) => void>,
): ReturnType<Workflow<Start, Stop>["run"]> {
  const executor = getExecutor();
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
}
