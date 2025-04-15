import { AsyncLocalStorage } from "node:async_hooks";

export const createAsyncContext = <T>() => {
  const als = new AsyncLocalStorage<T>();
  return {
    getStore: () => als.getStore(),
    run<R>(store: T, fn: () => R) {
      return als.run(store, fn);
    },
  };
};
