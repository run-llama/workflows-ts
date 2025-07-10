import { AsyncLocalStorage } from "node:async_hooks";

class AsyncVariable<T> {
  als = new AsyncLocalStorage<T>();

  get(): T | undefined {
    return this.als.getStore();
  }

  run<R>(value: T, fn: () => R): R {
    return this.als.run(value, fn);
  }
}

export class AsyncContext {
  static Variable = AsyncVariable;
}
