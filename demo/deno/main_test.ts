import { assertEquals } from "@std/assert";
import { workflow, startEvent, endEvent } from "./main.ts";

Deno.test(function workflowRun() {
  const { sendEvent, stream } = workflow.createContext();
  sendEvent(startEvent.with());
  stream
    .pipeThrough(
      new TransformStream({
        transform: (event, controller) => {
          if (endEvent.include(event)) {
            controller.enqueue(event.data);
          }
        },
      }),
    )
    .pipeTo(
      new WritableStream({
        write: (data) => {
          assertEquals(data, "Hello World!");
        },
      }),
    );
});
