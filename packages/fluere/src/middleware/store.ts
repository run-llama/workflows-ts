import type { Workflow } from "../core";

export function withStore<T, Start, Stop>(
  store: T,
  workflow: Workflow<Start, Stop>,
): Workflow<Start, Stop> & {
  getStore: () => T;
} {
  return {
    ...workflow,
    getStore: (): T => store,
    get startEvent() {
      return workflow.startEvent;
    },
    get stopEvent() {
      return workflow.stopEvent;
    },
  };
}
