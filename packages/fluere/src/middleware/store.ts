import type { Workflow } from "fluere";

export function withStore<T, Start, Stop>(
  store: T,
  workflow: Workflow<Start, Stop>,
): Workflow<Start, Stop> & {
  getStore: () => T;
} {
  return {
    ...workflow,
    getStore: (): T => store,
  };
}
