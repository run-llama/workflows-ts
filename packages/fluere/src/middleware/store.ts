import type { Workflow } from "fluere";

export function withStore<T>(
  store: T,
  workflow: Workflow,
): Workflow & {
  getStore: () => T;
} {
  return {
    ...workflow,
    getStore: (): T => store,
  };
}
