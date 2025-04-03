export const createAsyncContext = <T>() => {
  let currentStore: T | null = null;
  return {
    /**
     * You must call `getContext()` in the top level of the workflow,
     *  otherwise we will lose the async context of the workflow.
     *
     * @example
     * ```
     * workflow.handle([startEvent], async () => {
     *   const { stream } = getContext(); // ✅ this is ok
     *   await fetchData();
     * });
     *
     * workflow.handle([startEvent], async () => {
     *   await fetchData();
     *   const { stream } = getContext(); // ❌ this is not ok
     *   // we have no way
     *   to know this code was originally part of the workflow
     *   // w/o AsyncContext
     * });
     * ```
     */
    getStore: () => {
      if (currentStore === null) {
        console.warn(
          "Woops! Looks like you are calling `getContext` after `await fn()`. Please move `getContext` to top level of handler.",
        );
      }
      return currentStore;
    },
    run<R>(store: T, fn: () => R) {
      currentStore = store;
      try {
        return fn();
      } finally {
        currentStore = null;
      }
    },
  };
};
