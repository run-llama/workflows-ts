import {
  eventSource,
  type InferWorkflowEventData,
  isWorkflowEvent,
  type WorkflowEvent,
  type WorkflowEventData,
} from "./event";
import { createSubscribable, type Subscribable } from "./utils";

class JsonEncodeTransform extends TransformStream<
  WorkflowEventData<any>,
  string
> {
  constructor() {
    super({
      transform: (
        event: WorkflowEventData<any>,
        controller: TransformStreamDefaultController<string>,
      ) => {
        if (eventSource(event)) {
          controller.enqueue(
            JSON.stringify({
              data: (event as WorkflowEventData<any>).data,
              uniqueId: eventSource(event)!.uniqueId,
            }) + "\n",
          );
        }
      },
    });
  }
}

class JsonDecodeTransform extends TransformStream<
  string,
  WorkflowEventData<any>
> {
  #eventMap: Record<string, WorkflowEvent<any>>;

  constructor(eventMap: Record<string, WorkflowEvent<any>>) {
    super({
      transform: (
        data: string,
        controller: TransformStreamDefaultController<WorkflowEventData<any>>,
      ) => {
        const lines = data
          .split("\n")
          .map((line) => line.trim())
          .filter((line) => line.length > 0);
        lines.forEach((line) => {
          const eventData = JSON.parse(line) as {
            data: ReturnType<WorkflowEvent<any>["with"]>;
            uniqueId: string;
          };
          const targetEvent = Object.values(this.#eventMap).find(
            (e) => e.uniqueId === eventData.uniqueId,
          );
          if (targetEvent) {
            const ev = targetEvent.with(
              eventData.data,
            ) as WorkflowEventData<any>;
            controller.enqueue(ev);
          } else {
            console.warn(`Unknown event: ${eventData.uniqueId}`);
          }
        });
      },
    });
    this.#eventMap = eventMap;
  }
}

/**
 * A reactive stream for processing workflow events.
 *
 * WorkflowStream extends the standard ReadableStream to provide specialized
 * methods for filtering, transforming, and consuming workflow events.
 * It supports reactive patterns and can be used to build complex event
 * processing pipelines.
 *
 * @typeParam R - The type of data flowing through the stream
 *
 * @example
 * ```typescript
 * // Get stream from workflow context
 * const stream = context.stream;
 *
 * // Filter for specific events
 * const userEvents = stream.filter(UserEvent);
 *
 * // Transform events
 * const processed = stream.map(event => ({
 *   type: event.constructor.name,
 *   timestamp: Date.now(),
 *   data: event.data
 * }));
 *
 * // Consume events
 * for await (const event of stream.take(10)) {
 *   console.log('Received:', event);
 * }
 * ```
 *
 * @category Streaming
 * @public
 */
export class WorkflowStream<R = any>
  extends ReadableStream<R>
  implements AsyncIterable<R>
{
  #stream: ReadableStream<R>;
  #subscribable: Subscribable<[data: R], void>;

  /**
   * Subscribe to specific workflow events.
   *
   * @param event - The event type to listen for
   * @param handler - Function to handle the event
   * @returns Unsubscribe function
   *
   * @example
   * ```typescript
   * const unsubscribe = stream.on(UserEvent, (event) => {
   *   console.log('User event:', event.data);
   * });
   *
   * // Later...
   * unsubscribe();
   * ```
   */
  on<T>(
    event: WorkflowEvent<T>,
    handler: (event: WorkflowEventData<T>) => void,
  ): () => void {
    return this.#subscribable.subscribe((ev) => {
      if (event.include(ev)) {
        handler(ev);
      }
    });
  }

  constructor(
    subscribable: Subscribable<[R], void>,
    rootStream: ReadableStream<R>,
  );
  constructor(subscribable: Subscribable<[R], void>, rootStream: null);
  constructor(subscribable: null, rootStream: ReadableStream<R> | null);
  constructor(
    subscribable: Subscribable<[R], void> | null,
    rootStream: ReadableStream<R> | null,
  ) {
    if (!subscribable && !rootStream) {
      throw new TypeError(
        "Either subscribable or root stream must be provided",
      );
    }
    super();
    if (!subscribable) {
      this.#subscribable = createSubscribable<[data: R], void>();
      this.#stream = rootStream!.pipeThrough(
        new TransformStream({
          transform: (ev, controller) => {
            this.#subscribable.publish(ev);
            controller.enqueue(ev);
          },
        }),
      );
      return;
    } else {
      this.#subscribable = subscribable;
      let unsubscribe: () => void;
      this.#stream =
        rootStream ??
        new ReadableStream<R>({
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
  }

  /**
   * Create a WorkflowStream from a standard ReadableStream.
   *
   * @param stream - The ReadableStream to wrap
   * @returns A new WorkflowStream instance
   */
  static fromReadableStream<T = any>(
    stream: ReadableStream<WorkflowEventData<any>>,
  ): WorkflowStream<T> {
    return new WorkflowStream(
      null,
      stream.pipeThrough(
        new TransformStream<WorkflowEventData<any>>({
          transform: (event, controller) => {
            controller.enqueue(event);
          },
        }),
      ),
    );
  }

  /**
   * Create a WorkflowStream from an HTTP Response.
   *
   * @param response - The HTTP Response containing workflow events
   * @param eventMap - Map of event unique IDs to event constructors
   * @returns A new WorkflowStream instance
   */
  static fromResponse(
    response: Response,
    eventMap: Record<string, WorkflowEvent<any>>,
  ): WorkflowStream<WorkflowEventData<any>> {
    const body = response.body;
    if (!body) {
      throw new Error("Response body is not readable");
    }
    return new WorkflowStream(
      null,
      body
        .pipeThrough(new TextDecoderStream())
        .pipeThrough(new JsonDecodeTransform(eventMap)),
    );
  }

  /**
   * Convert the stream to an HTTP Response.
   *
   * @param init - Optional ResponseInit parameters
   * @param transformer - Optional custom transformer (defaults to JSON encoding)
   * @returns HTTP Response containing the stream data
   */
  toResponse(
    init?: ResponseInit,
    transformer = new JsonEncodeTransform(),
  ): R extends WorkflowEventData<any> ? Response : never {
    return new Response(
      (this.#stream as ReadableStream<WorkflowEventData<any>>)
        .pipeThrough<string>(transformer)
        .pipeThrough(new TextEncoderStream()),
      init,
    ) as any;
  }

  // ReadableStream compatibility methods - marked as internal to hide from main API docs
  /** @internal */
  get locked() {
    return this.#stream.locked;
  }

  /** @internal */
  [Symbol.asyncIterator](): ReadableStreamAsyncIterator<R> {
    return this.#stream[Symbol.asyncIterator]();
  }

  /** @internal */
  cancel(reason?: any): Promise<void> {
    return this.#stream.cancel(reason);
  }

  /** @internal */
  getReader(options: { mode: "byob" }): ReadableStreamBYOBReader;
  /** @internal */
  getReader(): ReadableStreamDefaultReader<R>;
  /** @internal */
  getReader(options?: ReadableStreamGetReaderOptions): ReadableStreamReader<R>;
  getReader(): any {
    return this.#stream.getReader();
  }

  /** @internal */
  pipeThrough<T>(
    transform: ReadableWritablePair<T, R>,
    options?: StreamPipeOptions,
  ): WorkflowStream<T> {
    const stream = this.#stream.pipeThrough(transform, options) as any;
    return new WorkflowStream<T>(null, stream);
  }

  /** @internal */
  pipeTo(
    destination: WritableStream<R>,
    options?: StreamPipeOptions,
  ): Promise<void> {
    return this.#stream.pipeTo(destination, options);
  }

  /** @internal */
  tee(): [WorkflowStream<R>, WorkflowStream<R>] {
    const [l, r] = this.#stream.tee();
    return [
      new WorkflowStream(this.#subscribable, l),
      new WorkflowStream(this.#subscribable, r),
    ];
  }

  /**
   * Process each item in the stream with a callback function.
   *
   * @param callback - Function to call for each item
   * @returns Promise that resolves when all items are processed
   *
   * @example
   * ```typescript
   * await stream.forEach(event => {
   *   console.log('Processing:', event);
   * });
   * ```
   */
  forEach(callback: (item: R) => void): Promise<void> {
    return this.#stream.pipeTo(
      new WritableStream({
        write: (item: R) => {
          callback(item);
        },
      }),
    );
  }

  /**
   * Transform each item in the stream.
   *
   * @param callback - Function to transform each item
   * @returns A new WorkflowStream with transformed items
   *
   * @example
   * ```typescript
   * const timestamps = stream.map(event => ({
   *   ...event,
   *   timestamp: Date.now()
   * }));
   * ```
   */
  map<T>(callback: (item: R) => T): WorkflowStream<T> {
    return this.pipeThrough<T>(
      new TransformStream({
        transform: (item, controller) => {
          controller.enqueue(callback(item));
        },
      }),
    );
  }

  /** @internal */
  values(
    options?: ReadableStreamIteratorOptions,
  ): ReadableStreamAsyncIterator<R> {
    return this.#stream.values(options);
  }

  /**
   * Take only the first N items from the stream.
   *
   * @param limit - Maximum number of items to take
   * @returns A new WorkflowStream limited to the specified number of items
   *
   * @example
   * ```typescript
   * const firstTen = stream.take(10);
   * for await (const event of firstTen) {
   *   console.log(event);
   * }
   * ```
   */
  take(limit: number): WorkflowStream<R> {
    let count = 0;
    return this.pipeThrough(
      new TransformStream({
        transform: (ev, controller) => {
          if (count < limit) {
            controller.enqueue(ev);
            count++;
          }
          if (count >= limit) {
            controller.terminate();
          }
        },
      }),
    );
  }

  /**
   * Filter the stream to include only items matching the predicate.
   *
   * @param predicate - Event type, function, or value to filter by
   * @returns A new WorkflowStream containing only matching items
   *
   * @example
   * ```typescript
   * // Filter by event type
   * const userEvents = stream.filter(UserEvent);
   *
   * // Filter by function
   * const importantEvents = stream.filter(event => event.priority === 'high');
   *
   * // Filter by specific value
   * const specificEvent = stream.filter(myEventInstance);
   * ```
   */
  filter(
    predicate: R extends WorkflowEventData<any>
      ? WorkflowEvent<InferWorkflowEventData<R>>
      : never,
  ): WorkflowStream<R>;
  filter(predicate: R): WorkflowStream<R>;
  filter(predicate: (event: R) => boolean): WorkflowStream<R>;
  filter(
    predicate:
      | WorkflowEvent<InferWorkflowEventData<R>>
      | ((event: R) => boolean)
      | R,
  ): WorkflowStream<R> {
    return this.pipeThrough(
      new TransformStream({
        transform: (ev, controller) => {
          if (
            typeof predicate === "function"
              ? (predicate as Function)(ev)
              : isWorkflowEvent(predicate)
                ? predicate.include(ev)
                : predicate === ev
          ) {
            controller.enqueue(ev);
          }
        },
      }),
    );
  }

  /**
   * Continue the stream until the predicate is met, then terminate.
   *
   * @param predicate - Event type, function, or value to stop at
   * @returns A new WorkflowStream that terminates when the predicate is met
   *
   * @example
   * ```typescript
   * // Stop at completion event
   * const processingEvents = stream.until(CompletionEvent);
   *
   * // Stop when condition is met
   * const beforeError = stream.until(event => event.type === 'error');
   *
   * // Stop at specific event instance
   * const beforeSpecific = stream.until(myEventInstance);
   * ```
   */
  until(
    predicate: R extends WorkflowEventData<any>
      ? WorkflowEvent<InferWorkflowEventData<R>>
      : never,
  ): WorkflowStream<R>;
  until(predicate: (item: R) => boolean): WorkflowStream<R>;
  until(item: R): WorkflowStream<R>;
  until(
    predicate:
      | WorkflowEvent<InferWorkflowEventData<R>>
      | R
      | ((item: R) => boolean),
  ): WorkflowStream<R> {
    return this.pipeThrough(
      new TransformStream({
        transform: (ev, controller) => {
          controller.enqueue(ev);
          if (
            typeof predicate === "function"
              ? (predicate as Function)(ev)
              : isWorkflowEvent(predicate)
                ? predicate.include(ev)
                : predicate === ev
          ) {
            controller.terminate();
          }
        },
      }),
    );
  }

  /**
   * Collect all items from the stream into an array.
   *
   * @returns Promise resolving to an array of all stream items
   *
   * @example
   * ```typescript
   * const events = await stream.take(5).toArray();
   * console.log('Collected events:', events);
   * ```
   */
  async toArray(): Promise<R[]> {
    const events: R[] = [];
    await this.pipeTo(
      new WritableStream({
        write: (event) => {
          events.push(event);
        },
      }),
    );
    return events;
  }
}
