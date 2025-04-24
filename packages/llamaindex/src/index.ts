import {
  createWorkflow,
  type WorkflowEvent as CoreWorkflowEvent,
  type WorkflowEventData as CoreWorkflowEventData,
  workflowEvent,
  getContext,
} from "@llama-flow/core";
import { until } from "@llama-flow/core/stream/until";
import { collect } from "@llama-flow/core/stream/consumer";
import { withStore } from "@llama-flow/core/middleware/store";

type Handler<
  AcceptEvents extends (typeof WorkflowEvent<any>)[],
  Result extends WorkflowEvent<any> | void,
> = (
  ...event: {
    [K in keyof AcceptEvents]: InstanceType<AcceptEvents[K]>;
  }
) => Result | Promise<Result>;

export type StepContext<T = unknown> = {
  sendEvent: (event: WorkflowEvent<any>) => void;
  get stream(): ReadableStream<WorkflowEvent<any>>;
  get data(): T;
};

export type StepHandler<
  ContextData,
  Inputs extends (typeof WorkflowEvent<any>)[],
  Outputs extends WorkflowEvent<any>[],
> = (
  context: StepContext<ContextData>,
  ...args: Parameters<Handler<Inputs, Outputs[number]>>
) => ReturnType<Handler<Inputs, Outputs[number]>>;

const eventWeakMap = new WeakMap<Function, CoreWorkflowEvent<any>>();
const eventDataWeakMap = new WeakMap<
  WorkflowEvent<any>,
  CoreWorkflowEventData<any>
>();
const coreEventWeakMap = new WeakMap<
  CoreWorkflowEventData<any>,
  WorkflowEvent<any>
>();

export class WorkflowEvent<Data> {
  displayName: string;
  data: Data;

  constructor(data: Data) {
    if (!eventWeakMap.has(this.constructor)) {
      eventWeakMap.set(
        this.constructor,
        workflowEvent({
          debugLabel: this.constructor.name,
        }),
      );
    }
    this.data = data;
    this.displayName = this.constructor.name;
    const coreEvent = eventWeakMap.get(this.constructor)!.with(data);
    eventDataWeakMap.set(this, coreEvent);
    coreEventWeakMap.set(coreEvent, this);
  }

  toString() {
    return this.displayName;
  }
}

export class StartEvent<T = string> extends WorkflowEvent<T> {
  constructor(data: T) {
    super(data);
  }
}

export class StopEvent<T = string> extends WorkflowEvent<T> {
  constructor(data: T) {
    super(data);
  }
}

export class Workflow<ContextData, Start, Stop> {
  #workflow = withStore((data: ContextData) => data, createWorkflow());

  addStep<AcceptEvents extends (typeof WorkflowEvent<any>)[]>(
    parameters: {
      inputs: AcceptEvents;
    },
    handler: (
      context: StepContext<ContextData>,
      ...args: Parameters<Handler<AcceptEvents, WorkflowEvent<any> | void>>
    ) => ReturnType<Handler<AcceptEvents, WorkflowEvent<any> | void>>,
  ) {
    this.#workflow.handle(
      parameters.inputs.map((i) => {
        if (!eventWeakMap.has(i)) {
          eventWeakMap.set(
            i,
            workflowEvent({
              debugLabel: i.name,
            }),
          );
        }
        return eventWeakMap.get(i)!;
      }),
      (...events) => {
        const context = getContext();
        const contextData = this.#workflow.getStore();
        const result = handler(
          {
            sendEvent: (event) => {
              const coreEvent = eventDataWeakMap.get(event)!;
              context.sendEvent(coreEvent);
            },
            get stream() {
              return context.stream.pipeThrough<WorkflowEvent<any>>(
                new TransformStream({
                  transform: (event, controller) => {
                    controller.enqueue(coreEventWeakMap.get(event)!);
                  },
                }),
              );
            },
            get data(): ContextData {
              return contextData;
            },
          },
          ...(events as Parameters<
            Handler<AcceptEvents, WorkflowEvent<any> | void>
          >),
        );
        if (result instanceof Promise) {
          return result.then((result) =>
            result instanceof WorkflowEvent
              ? eventWeakMap.get(result.constructor)!.with(result.data)
              : undefined,
          );
        } else {
          return result instanceof WorkflowEvent
            ? eventWeakMap.get(result.constructor)!.with(result.data)
            : undefined;
        }
      },
    );
  }

  async run(start: Start, context?: ContextData): Promise<Stop> {
    const { sendEvent, stream } = this.#workflow.createContext(context!);
    const startEvent = new StartEvent(start);
    const coreStartEvent = eventDataWeakMap.get(startEvent)!;
    sendEvent(coreStartEvent);
    const stopEvent = eventWeakMap.get(StopEvent)!;
    const events = await collect(until(stream, stopEvent));
    return events.at(-1)!.data;
  }
}
