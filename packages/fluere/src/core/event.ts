const eventMap = new WeakMap<WorkflowEvent<any>, WeakSet<object>>();
const refMap = new WeakMap<WorkflowEventData<any>, WorkflowEvent<any>>();
let i = 0;
let j = 0;

export type WorkflowEventData<Data> = {
  get data(): Data;
};

export type WorkflowEvent<Data> = {
  (data: Data): WorkflowEventData<Data>;
  include(event: WorkflowEventData<any>): event is WorkflowEventData<Data>;
};

export const workflowEvent = <Data>(config?: {
  debugLabel?: string;
}): WorkflowEvent<Data> => {
  const l1 = `${i++}`;
  const fn = (data: Data) => {
    const l2 = `${j++}`;
    const ref = {
      [Symbol.toStringTag]: config?.debugLabel ?? `WorkflowEvent(${l1}.${l2})`,
      toString: () =>
        config?.debugLabel
          ? `${config.debugLabel}(${l2})`
          : `WorkflowEvent(${l1}.${l2})`,
      toJSON: () => {
        return {
          event: l1,
          data,
        };
      },
      get data() {
        return data;
      },
    };
    s.add(ref);
    refMap.set(ref, fn);
    return ref;
  };

  const s = new WeakSet();
  eventMap.set(fn, s);

  Object.defineProperty(fn, Symbol.toStringTag, {
    get: () => config?.debugLabel ?? `WorkflowEvent<${l1}>`,
  });

  fn.toString = () => config?.debugLabel ?? `WorkflowEvent<${l1}>`;
  fn.include = (
    instance: WorkflowEventData<any>,
  ): instance is WorkflowEventData<Data> => s.has(instance);
  Object.freeze(fn);

  return fn;
};

// utils
export const eventSource = (instance: WorkflowEventData<any>) =>
  refMap.get(instance)!;
