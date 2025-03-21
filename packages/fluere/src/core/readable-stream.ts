import type { Executor, ExecutorResponse } from "./create-executor";
import {
  type WorkflowEvent,
  type WorkflowEventData,
  eventSource,
} from "./event";
import { isEventData, isPromiseLike } from "./utils";

export function readableStream<Start, Stop>(executor: Executor<Start, Stop>) {
  // By default, we assume the stop event is the last event,
  //  but it's interesting
  //  that we can allow the user to specify the stop event.
  //  Or even there's no stop event at all
  const targetingEvent = executor.stop;
  const allEvents = new WeakSet<WorkflowEvent<any>>();
  async function handleIterator(
    controller: ReadableStreamDefaultController<WorkflowEventData<any>>,
    iterator: IterableIterator<ExecutorResponse, ExecutorResponse>,
  ) {
    while (true) {
      const { value: response } = iterator.next();
      switch (response.type) {
        case "start": {
          const { data } = response;
          allEvents.add(eventSource(data));
          controller.enqueue(data);
          break;
        }
        case "running": {
          const { data, squeeze } = response;
          const pendingEvents: Promise<WorkflowEventData<any> | void>[] = [];
          data.forEach((ev) => {
            if (isPromiseLike(ev)) {
              pendingEvents.push(
                ev.then((ev) => {
                  if (ev) {
                    squeeze(ev);
                  }
                }),
              );
            } else if (isEventData(ev)) {
              squeeze(ev);
            }
          });
          await Promise.all(pendingEvents);
          break;
        }
        case "empty": {
          // todo: check if we have encountered stop event
          if (allEvents.has(targetingEvent)) {
            controller.close();
            return;
          } else {
            await new Promise((resolve) => setTimeout(resolve, 0));
            break;
          }
        }
        case "send": {
          const { data, execute, deplete } = response;
          deplete.forEach((event) => {
            allEvents.add(eventSource(event));
            controller.enqueue(event);
          });
          for (const ev of data) {
            execute(ev);
          }
        }
      }
    }
  }

  return new ReadableStream({
    start: (controller) => {
      handleIterator(controller, executor[Symbol.iterator]()).catch((err) => {
        controller.error(err);
      });
    },
  });
}
