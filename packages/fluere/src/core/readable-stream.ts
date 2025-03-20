import type { Executor, ExecutorResponse } from "./create-executor";
import type { WorkflowEvent, WorkflowEventData } from "./event";
import { isEventData, isPromiseLike } from "./utils";

export function readableStream<Start, Stop>(executor: Executor<Start, Stop>) {
  const targetingEvents = new Set<WorkflowEvent<any>>();

  async function handleIterator(
    controller: ReadableStreamDefaultController<WorkflowEventData<any>>,
    iterator: IterableIterator<ExecutorResponse, ExecutorResponse>,
  ) {
    while (true) {
      const { value: response } = iterator.next();
      switch (response.type) {
        case "start": {
          const { data } = response;
          controller.enqueue(data);
          break;
        }
        case "prepare": {
          const { iterate, onWait } = response;
          onWait(async (event: WorkflowEvent<any>) => {
            targetingEvents.add(event);
            await handleIterator(controller, iterate());
          });
          break;
        }
        case "running": {
          const { data, squeeze } = response;
          const pendingEvents: Promise<WorkflowEventData<any> | void>[] = [];
          data.forEach((ev) => {
            if (isPromiseLike(ev)) {
              pendingEvents.push(
                ev.then((ev) => {
                  if (ev) squeeze(ev);
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
          controller.close();
          return;
        }
        case "send": {
          const { data, execute } = response;
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
