import { type WorkflowEvent, type WorkflowEventData } from "./event";
import type { Subscribable } from "./utils";

export class WorkflowStream<Event extends WorkflowEvent<any>> {
  #subscribable: Subscribable<[event: WorkflowEventData<any>], void>;
  #stream: ReadableStream<ReturnType<Event["with"]>>;

  on<T extends Event>(
    event: T,
    handler: (event: ReturnType<T["with"]>) => void,
  ): () => void {
    return this.#subscribable.subscribe((ev) => {
      if (event.include(ev)) {
        handler(ev as ReturnType<T["with"]>);
      }
    });
  }

  constructor(
    subscribable: Subscribable<[event: WorkflowEventData<any>], void>,
    stream: ReadableStream<ReturnType<Event["with"]>>,
  ) {
    this.#subscribable = subscribable;
    this.#stream = stream;
  }

  get locked() {
    return this.#stream.locked;
  }

  [Symbol.asyncIterator](): ReadableStreamAsyncIterator<
    ReturnType<Event["with"]>
  > {
    return this.#stream[Symbol.asyncIterator]();
  }

  cancel(reason?: any): Promise<void> {
    return this.#stream.cancel(reason);
  }

  // make type compatible with Web ReadableStream API
  getReader(options: { mode: "byob" }): ReadableStreamBYOBReader;
  getReader(): ReadableStreamDefaultReader<ReturnType<Event["with"]>>;
  getReader(
    options?: ReadableStreamGetReaderOptions,
  ): ReadableStreamReader<ReturnType<Event["with"]>>;
  getReader(): any {
    return this.#stream.getReader();
  }

  pipeThrough<T>(
    transform: ReadableWritablePair<T, ReturnType<Event["with"]>>,
    options?: StreamPipeOptions,
  ): ReadableStream<T> {
    return this.#stream.pipeThrough(transform, options) as ReadableStream<T>;
  }

  pipeTo(
    destination: WritableStream<ReturnType<Event["with"]>>,
    options?: StreamPipeOptions,
  ): Promise<void> {
    return this.#stream.pipeTo(destination, options);
  }

  tee(): [WorkflowStream<Event>, WorkflowStream<Event>] {
    const [l, r] = this.#stream.tee();
    return [
      new WorkflowStream(this.#subscribable, l),
      new WorkflowStream(this.#subscribable, r),
    ];
  }

  values(
    options?: ReadableStreamIteratorOptions,
  ): ReadableStreamAsyncIterator<ReturnType<Event["with"]>> {
    return this.#stream.values(options);
  }
}
