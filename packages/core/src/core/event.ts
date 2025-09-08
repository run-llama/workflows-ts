declare const opaqueSymbol: unique symbol;

type Callback = (evd: WorkflowEventData<any>) => void;

type Cleanup = () => void;

const eventMap = new WeakMap<WorkflowEvent<any>, WeakSet<object>>();
const refMap = new WeakMap<WorkflowEventData<any>, WorkflowEvent<any>>();
const initCallbackMap = new WeakMap<WorkflowEvent<any>, Set<Callback>>();
let i = 0;
let j = 0;

export type InferWorkflowEventData<T> = T extends WorkflowEventData<infer U>
  ? U
  : T extends WorkflowEvent<infer U>
    ? U
    : never;

/**
 * Represents event data flowing through a workflow.
 *
 * Event data is created when an event is instantiated with the `.with()` method.
 * It carries the actual payload and can be processed by event handlers.
 *
 * @typeParam Data - The type of data this event carries
 * @typeParam DebugLabel - Optional debug label for development/debugging
 *
 * @category Events
 * @public
 */
export type WorkflowEventData<Data, DebugLabel extends string = string> = {
  get data(): Data;
} & { readonly [opaqueSymbol]: DebugLabel };

/**
 * Represents a workflow event type that can be instantiated with data.
 *
 * Events are the core building blocks of workflows. They define the structure
 * of data that flows through the system and can be used to trigger handlers.
 *
 * @typeParam Data - The type of data this event can carry
 * @typeParam DebugLabel - Optional debug label for development/debugging
 *
 * @example
 * ```typescript
 * // Create an event type
 * const UserLoginEvent = workflowEvent<{ userId: string; timestamp: Date }>();
 *
 * // Create event data
 * const loginData = UserLoginEvent.with({
 *   userId: 'user123',
 *   timestamp: new Date()
 * });
 *
 * // Check if data belongs to this event type
 * if (UserLoginEvent.include(someEventData)) {
 *   console.log('User ID:', someEventData.data.userId);
 * }
 * ```
 *
 * @category Events
 * @public
 */
export type WorkflowEvent<Data, DebugLabel extends string = string> = {
  /**
   * Optional label used for debugging and logging purposes.
   */
  debugLabel?: DebugLabel;
  /**
   * Unique identifier for the event type, used for serialization and network communication.
   */
  readonly uniqueId: string;

  /**
   * Creates event data with the provided payload.
   *
   * @param data - The data payload for this event instance
   * @returns Event data that can be sent through workflow contexts
   */
  with(data: Data): WorkflowEventData<Data, DebugLabel>;

  /**
   * Type guard to check if unknown event data belongs to this event type.
   *
   * @param event - Unknown event data to check
   * @returns True if the event data is of this event type
   */
  include(event: unknown): event is WorkflowEventData<Data, DebugLabel>;

  /**
   * Registers a callback to be called when this event type is instantiated.
   *
   * @param callback - Function to call when event is created
   * @returns Cleanup function to remove the callback
   */
  onInit(callback: Callback): Cleanup;
} & { readonly [opaqueSymbol]: DebugLabel };

/**
 * Configuration options for creating workflow events.
 *
 * @typeParam DebugLabel - Optional debug label type
 *
 * @category Events
 * @public
 */
export type WorkflowEventConfig<DebugLabel extends string = string> = {
  /** Optional debug label for development and logging */
  debugLabel?: DebugLabel;
  /** Optional unique identifier for the event type */
  uniqueId?: string;
};

/**
 * Creates a new workflow event type.
 *
 * This is the primary factory function for creating event types that can be used
 * in workflows. Each event type can carry specific data and be used to trigger
 * handlers throughout the workflow system.
 *
 * @typeParam Data - The type of data this event will carry (defaults to void)
 * @typeParam DebugLabel - Optional debug label type for development
 *
 * @param config - Optional configuration for the event type
 * @returns A new workflow event type that can be instantiated with data
 *
 * @example
 * ```typescript
 * // Create a simple event with no data
 * const StartEvent = workflowEvent();
 *
 * // Create an event that carries user data
 * const UserEvent = workflowEvent<{ name: string; email: string }>({
 *   debugLabel: 'UserEvent'
 * });
 *
 * // Create event instances
 * const start = StartEvent.with();
 * const user = UserEvent.with({ name: 'John', email: 'john@example.com' });
 * ```
 *
 * @category Events
 * @public
 */
export const workflowEvent = <Data = void, DebugLabel extends string = string>(
  config?: WorkflowEventConfig<DebugLabel>,
): WorkflowEvent<Data, DebugLabel> => {
  const l1 = `${i++}`;
  const cb = new Set<Callback>();
  const event = {
    debugLabel: config?.debugLabel ?? l1,
    include: (
      instance: WorkflowEventData<any>,
    ): instance is WorkflowEventData<Data> => s.has(instance),
    with: (data: Data) => {
      const l2 = `${j++}`;
      const ref = {
        [Symbol.toStringTag]:
          config?.debugLabel ?? `WorkflowEvent(${l1}.${l2})`,
        toString: () =>
          config?.debugLabel ? config.debugLabel : `WorkflowEvent(${l1}.${l2})`,
        toJSON: () => {
          return {
            type: config?.debugLabel ? config.debugLabel : l1,
            data,
          };
        },
        get data() {
          return data;
        },
      } as unknown as WorkflowEventData<Data, DebugLabel>;
      s.add(ref);
      refMap.set(ref, event);
      cb.forEach((c) => c(ref));
      return ref;
    },
    onInit: (callback: Callback) => {
      cb.add(callback);
      return () => {
        cb.delete(callback);
      };
    },
  } as unknown as WorkflowEvent<Data, DebugLabel>;

  const s = new WeakSet();
  eventMap.set(event, s);

  initCallbackMap.set(event, cb);

  Object.defineProperty(event, Symbol.toStringTag, {
    get: () => event?.debugLabel ?? `WorkflowEvent<${l1}>`,
  });

  Object.defineProperty(event, "displayName", {
    value: event?.debugLabel ?? `WorkflowEvent<${l1}>`,
  });

  let uniqueId = config?.uniqueId;

  Object.defineProperty(event, "uniqueId", {
    get: () => {
      if (!uniqueId) {
        uniqueId = l1;
      }
      return uniqueId;
    },
    set: () => {
      throw new Error("uniqueId is readonly");
    },
  });

  event.toString = () => config?.debugLabel ?? `WorkflowEvent<${l1}>`;
  return event;
};

// utils
export const isWorkflowEvent = (
  instance: unknown,
): instance is WorkflowEvent<any> =>
  typeof instance === "object" && instance !== null
    ? eventMap.has(instance as any)
    : false;
export const isWorkflowEventData = (
  instance: unknown,
): instance is WorkflowEventData<any> =>
  typeof instance === "object" && instance !== null
    ? refMap.has(instance as any)
    : false;
export const eventSource = (
  instance: unknown,
): WorkflowEvent<any> | undefined =>
  typeof instance === "object" && instance !== null
    ? refMap.get(instance as any)
    : undefined;

// OR Event Implementation

export type OrEvent<Events extends WorkflowEvent<any>[]> =
  WorkflowEvent<any> & {
    _type: "or";
    events: Events;
  };

export const or = <const Events extends WorkflowEvent<any>[]>(
  ...events: Events
): OrEvent<Events> => {
  const debugLabel = `or(${events.map((e) => e.debugLabel || e.uniqueId).join(", ")})`;
  const l1 = `or_${i++}`;

  const orEvent = {
    _type: "or" as const,
    events,
    debugLabel,
    include: (eventData: unknown): eventData is WorkflowEventData<any> => {
      // Accept events from any constituent event OR events created by this OR event
      return (
        events.some((event) => event.include(eventData)) ||
        s.has(eventData as any)
      );
    },
    with: (data: any) => {
      const ref = {
        [Symbol.toStringTag]: debugLabel,
        toString: () => debugLabel,
        toJSON: () => ({
          type: debugLabel,
          data,
        }),
        get data() {
          return data;
        },
      } as unknown as WorkflowEventData<any>;
      s.add(ref);
      refMap.set(ref, orEvent);
      return ref;
    },
  } as unknown as OrEvent<Events>;

  const s = new WeakSet();
  eventMap.set(orEvent as any, s);

  let uniqueId: string;
  Object.defineProperty(orEvent, "uniqueId", {
    get: () => {
      if (!uniqueId) {
        uniqueId = l1;
      }
      return uniqueId;
    },
    set: () => {
      throw new Error("uniqueId is readonly");
    },
  });

  Object.defineProperty(orEvent, Symbol.toStringTag, {
    get: () => debugLabel,
  });

  Object.defineProperty(orEvent, "displayName", {
    value: debugLabel,
  });

  (orEvent as any).toString = () => debugLabel;

  return orEvent;
};
