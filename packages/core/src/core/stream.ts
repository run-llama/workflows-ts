import {
  eventSource,
  type WorkflowEvent,
  type WorkflowEventData,
} from "./event";
import { createSubscribable, type Subscribable } from "./utils";

export class WorkflowStream<R = any>
  implements
    AsyncIterable<WorkflowEventData<any>>,
    ReadableStream<WorkflowEventData<any>>
{
  #stream: ReadableStream<WorkflowEventData<any>>;

  #subscribable: Subscribable<[event: WorkflowEventData<any>], void>;

  on(
    event: WorkflowEvent<any>,
    handler: (event: WorkflowEventData<any>) => void,
  ): () => void {
    return this.#subscribable.subscribe((ev) => {
      if (event.include(ev)) {
        handler(ev);
      }
    });
  }

  constructor(
    subscribable: Subscribable<[event: WorkflowEventData<any>], void>,
    rootStream: ReadableStream<WorkflowEventData<any>> | null,
  ) {
    this.#subscribable = subscribable;
    let unsubscribe: () => void;
    this.#stream =
      rootStream ??
      new ReadableStream<WorkflowEventData<any>>({
        start: (controller) => {
          unsubscribe = subscribable.subscribe((event) => {
            controller.enqueue(event);
          });
        },
        cancel: () => {
          unsubscribe();
        },
      });
  }

  static fromReadableStream(
    stream: ReadableStream<WorkflowEventData<any>>,
  ): WorkflowStream {
    const subscribable = createSubscribable<
      [event: WorkflowEventData<any>],
      void
    >();
    return new WorkflowStream(
      subscribable,
      stream.pipeThrough(
        new TransformStream<WorkflowEventData<any>>({
          transform: (event, controller) => {
            subscribable.publish(event);
            controller.enqueue(event);
          },
        }),
      ),
    );
  }

  static fromResponse(
    response: Response,
    eventMap: Record<string, WorkflowEvent<any>>,
  ): WorkflowStream {
    const body = response.body;
    if (!body) {
      throw new Error("Response body is not readable");
    }
    const subscribable = createSubscribable<
      [event: WorkflowEventData<any>],
      void
    >();
    const events = Object.values(eventMap);
    return new WorkflowStream(
      subscribable,
      body
        .pipeThrough(new TextDecoderStream())
        .pipeThrough<WorkflowEventData<any>>(
          new TransformStream({
            transform: (chunk, controller) => {
              const eventData = JSON.parse(chunk) as {
                data: ReturnType<WorkflowEvent<any>["with"]>;
                uniqueId: string;
              };
              const targetEvent = events.find(
                (e) => e.uniqueId === eventData.uniqueId,
              );
              if (targetEvent) {
                const ev = targetEvent.with(
                  eventData.data,
                ) as WorkflowEventData<any>;
                subscribable.publish(ev);
                controller.enqueue(ev);
              }
            },
          }),
        ),
    );
  }

  toResponse(
    init?: ResponseInit,
  ): R extends WorkflowEventData<any> ? Response : never {
    return new Response(
      this.#stream
        .pipeThrough(
          new TransformStream({
            transform: (event, controller) => {
              controller.enqueue(
                JSON.stringify({
                  data: event.data,
                  uniqueId: eventSource(event)!.uniqueId,
                }) + "\n",
              );
            },
          }),
        )
        .pipeThrough(new TextEncoderStream()),
      init,
    ) as any;
  }

  get locked() {
    return this.#stream.locked;
  }

  [Symbol.asyncIterator](): ReadableStreamAsyncIterator<
    WorkflowEventData<any>
  > {
    return this.#stream[Symbol.asyncIterator]();
  }

  cancel(reason?: any): Promise<void> {
    return this.#stream.cancel(reason);
  }

  // make type compatible with Web ReadableStream API
  getReader(options: { mode: "byob" }): ReadableStreamBYOBReader;
  getReader(): ReadableStreamDefaultReader<WorkflowEventData<any>>;
  getReader(
    options?: ReadableStreamGetReaderOptions,
  ): ReadableStreamReader<WorkflowEventData<any>>;
  getReader(): any {
    return this.#stream.getReader();
  }

  // @ts-expect-error
  pipeThrough<T>(
    transform: ReadableWritablePair<T, R>,
    options?: StreamPipeOptions,
  ): WorkflowStream<T> {
    const stream = this.#stream.pipeThrough(
      // @ts-expect-error
      transform,
      options,
    ) as any;
    return new WorkflowStream(this.#subscribable, stream);
  }

  // @ts-expect-error
  pipeTo(
    destination: WritableStream<R>,
    options?: StreamPipeOptions,
  ): Promise<void> {
    // @ts-expect-error
    return this.#stream.pipeTo(destination, options);
  }

  // @ts-expect-error
  tee(): [WorkflowStream, WorkflowStream] {
    const [l, r] = this.#stream.tee();
    return [
      new WorkflowStream(this.#subscribable, l),
      new WorkflowStream(this.#subscribable, r),
    ];
  }

  values(
    options?: ReadableStreamIteratorOptions,
  ): ReadableStreamAsyncIterator<WorkflowEventData<any>> {
    return this.#stream.values(options);
  }

  filter(predicate: WorkflowEvent<any>): WorkflowStream<R>;
  filter(
    predicate: (event: WorkflowEventData<any>) => boolean,
  ): WorkflowStream<R>;
  filter(
    predicate:
      | ((event: WorkflowEventData<any>) => boolean)
      | WorkflowEvent<any>,
  ): WorkflowStream<R> {
    return WorkflowStream.fromReadableStream(
      this.#stream.pipeThrough(
        new TransformStream({
          transform: (ev, controller) => {
            if (
              typeof predicate === "function"
                ? predicate(ev)
                : predicate.include(ev)
            ) {
              controller.enqueue(ev);
            }
          },
        }),
      ),
    );
  }

  until(event: WorkflowEvent<any>): WorkflowStream<R> {
    return WorkflowStream.fromReadableStream(
      this.#stream.pipeThrough(
        new TransformStream({
          transform: (ev, controller) => {
            controller.enqueue(ev);
            if (event.include(ev)) {
              controller.terminate();
            }
          },
        }),
      ),
    );
  }

  async toArray(): Promise<WorkflowEventData<any>[]> {
    const events: WorkflowEventData<any>[] = [];
    await this.#stream.pipeTo(
      new WritableStream({
        write: (event: WorkflowEventData<any>) => {
          events.push(event);
        },
      }),
    );
    return events;
  }
}
