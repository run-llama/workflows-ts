export const createAsyncContext = <T>() => {
  let currentStore: T | null = null;
  return {
    getStore: () => currentStore,
    run(store: T, fn: () => void) {
      currentStore = store;
      try {
        fn();
      } finally {
        currentStore = null;
      }
    },
  };
};
