export const createAsyncContext = <T>() => {
  let currentStore: T | null = null;
  return {
    getStore: () => currentStore,
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
