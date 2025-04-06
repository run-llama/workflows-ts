# fluere

fluere 🌊 is a simple, lightweight workflow engine, inspired
by [LlamaIndex Workflow](https://docs.llamaindex.ai/en/stable/module_guides/workflow/)

[![Bundle Size](https://img.shields.io/bundlephobia/min/fluere)](https://bundlephobia.com/result?p=fluere)
[![Bundle Size](https://img.shields.io/bundlephobia/minzip/fluere)](https://bundlephobia.com/result?p=fluere)

- Minimal core API (<=2kb)
- 100% Type safe
- Event-driven, stream oriented programming
- Support multiple JS runtime/framework

## Usage

```shell
npm i fluere
```

### First, define events

```ts
import { workflowEvent } from "fluere";

const startEvent = workflowEvent<string>();
const stopEvent = workflowEvent<1 | -1>();
```

### Connect events with workflow

```ts
import { createWorkflow } from "fluere";

const convertEvent = workflowEvent();

const workflow = createWorkflow();

workflow.handle([startEvent], (start) => {
  return convertEvent.with(Number.parseInt(start.data, 10));
});
workflow.handle([convertEvent], (convert) => {
  return stopEvent.with(convert.data > 0 ? 1 : -1);
});
```

### Trigger workflow

```ts
import { pipeline } from "node:stream/promises";

const { stream, sendEvent } = workflow.createContext();
sendEvent(startEvent.with());
const result = await pipeline(stream, async function (source) {
  for await (const event of source) {
    if (stopEvent.include(event)) {
      return "stop received!";
    }
  }
});
console.log(result); // stop received!
```

### Fan-out (Parallelism)

By default, we provide a simple fan-out utility to run multiple workflows in parallel

- `getContext().sendEvent` will emit a new event to current workflow
- `getContext().stream` will return a stream of events emitted by the sub-workflow

```ts
import { until } from "fluere/stream";

let condition = false;
workflow.handle([startEvent], (start) => {
  const { sendEvent, stream } = getContext();
  for (let i = 0; i < 10; i++) {
    sendEvent(convertEvent.with(i));
  }
  // You define the condition to stop the workflow
  const results = until(stream, () => condition).filter((ev) =>
    convertStopEvent.includes(ev),
  );
  console.log(results.length); // 10
  return stopEvent.with();
});

workflow.handle([convertEvent], (convert) => {
  if (convert.data === 9) {
    condition = true;
  }
  return convertStopEvent.with(/* ... */);
});
```

### With RxJS, or any stream API

Workflow is event-driven, you can use any stream API to handle the workflow like `rxjs`

```ts
import { from, pipe } from "rxjs";

const { stream, sendEvent } = workflow.createContext();

from(stream)
  .pipe(filter((ev) => eventSource(ev) === messageEvent))
  .subscribe((ev) => {
    console.log(ev.data);
  });

sendEvent(fileParseWorkflow.startEvent(directory));
```

### Connect with Server endpoint

Workflow can be used as middleware in any server framework, like `express`, `hono`, `fastify`, etc.

```ts
import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { createHonoHandler } from "fluere/interrupter/hono";
import {
  agentWorkflow,
  startEvent,
  stopEvent,
} from "../workflows/tool-call-agent.js";

const app = new Hono();

app.post(
  "/workflow",
  createHonoHandler(
    agentWorkflow,
    async (ctx) => startEvent(await ctx.req.text()),
    stopEvent,
  ),
);

serve(app, ({ port }) => {
  console.log(`Server started at http://localhost:${port}`);
});
```

### Error Handling

You can use `signal` in `getContext` to handle error

```ts
workflow.handle([convertEvent], () => {
  const { signal } = getContext();

  signal.onabort = () => {
    console.error("error in convert event:", abort.reason);
  };
});
```

### Pitfall in **browser**

You must call `getContext()` in the top level of the workflow, otherwise we will lose the async context of the workflow.

```ts
workflow.handle([startEvent], async () => {
  const { stream } = getContext(); // ✅ this is ok
  await fetchData();
});

workflow.handle([startEvent], async () => {
  await fetchData();
  const { stream } = getContext(); // ❌ this is not ok
  // we have no way to know this code was originally part of the workflow
  // w/o AsyncContext
});
```

Due to missing API of `async_hooks` in browser, we are looking
for [Async Context](https://github.com/tc39/proposal-async-context) to solve this problem in the future.

## Middleware

### `withStore`

Adding a `getStore()` method to the workflow context, which returns a store object, each store is linked to the workflow
context.

```ts
import { withStore } from "fluere/middleware/store";

const workflow = withStore(
  () => ({
    pendingTasks: new Set<Promise<unknown>>(),
  }),
  createWorkflow(),
);

workflow.handle([startEvent], () => {
  workflow.getStore().pendingTasks.add(
    new Promise((resolve) => {
      setTimeout(() => {
        resolve();
      }, 100);
    }),
  );
});

const { getStore } = workflow.createContext();
```

### `withValidation`

Make first parameter of `handler` to be `sendEvent` and its type safe and runtime safe
when you create a workflow using `withValidation`.

```ts
// before:
workflow.handle([startEvent], (start) => {});
// after:
workflow.handle([startEvent], (sendEvent, start) => {});
```

```ts
import { withValidation } from "fluere/middleware/validation";

const startEvent = workflowEvent<void, "start">();
const disallowedEvent = workflowEvent<void, "disallowed">({
  debugLabel: "disallowed",
});
const parseEvent = workflowEvent<string, "parse">();
const stopEvent = workflowEvent<number, "stop">();
const workflow = withValidation(createWorkflow(), [
  [[startEvent], [stopEvent]],
  [[startEvent], [parseEvent]],
]);

workflow.handle([startEvent], (sendEvent, start) => {
  sendEvent(
    disallowedEvent.with(), // <-- ❌ Type Check Failed, Runtime Error
  );
  sendEvent(parseEvent.with("")); // <-- ✅
  sendEvent(stopEvent.with(1)); // <-- ✅
});
```

### `withTraceEvents`

Adds tracing capabilities to your workflow, allowing you to monitor/decorate handler and debug event flows easily.

When enabled,
it collects events based on the directed graph of the runtime and provide lifecycle hooks for each handler.

```ts
import { withTraceEvents, runOnce } from "fluere/middleware/trace-events";

const workflow = withTraceEvents(createWorkflow());

workflow.handle(
  [messageEvent],
  runOnce(() => {
    console.log("This message handler will only run once");
  }),
);

workflow.handle([startEvent], () => {
  getContext().sendEvent(messageEvent.with());
  getContext().sendEvent(messageEvent.with());
});

{
  const { sendEvent } = workflow.createContext();
  sendEvent(startEvent.with());
  sendEvent(messageEvent.with());
  // This message handler will only run once!
}
{
  const { sendEvent } = workflow.createContext();
  // For each new context, the hook is isolated.
  sendEvent(startEvent.with());
  sendEvent(messageEvent.with());
  // This message handler will only run once!
}
```

#### `createHandlerDecorator`

You can create your own handler decorator to modify the behavior of the handler.

```ts
import { createHandlerDecorator } from "fluere/middleware/trace-events";

const noop: (...args: any[]) => void = function noop() {};
export const runOnce = createHandlerDecorator({
  debugLabel: "onceHook",
  getInitialValue: () => false,
  onBeforeHandler: (handler, handlerContext, tracked) =>
    tracked ? noop : handler,
  onAfterHandler: () => true,
});
```

#### `HandlerContext`

The `HandlerContext` includes the runtime information of the handler in the directed graph of the workflow.

```ts
type BaseHandlerContext = {
  // ... some other properties are hidden
  handler: Handler<WorkflowEvent<any>[], any>;
  inputEvents: WorkflowEvent<any>[];
  // events data that are accepted by the handler
  inputs: WorkflowEventData<any>[];
  // events data that are emitted by the handler
  outputs: WorkflowEventData<any>[];

  //#region linked list data structure
  prev: HandlerContext;
  next: Set<HandlerContext>;
  root: HandlerContext;
  //#endregion
};

type SyncHandlerContext = BaseHandlerContext & {
  async: false;
  pending: null;
};

type AsyncHandlerContext = BaseHandlerContext & {
  async: true;
  pending: Promise<WorkflowEventData<any> | void> | null;
};

type HandlerContext = AsyncHandlerContext | SyncHandlerContext;
```

For example, when you send two `startEvent` events, and send `messageEvent` twice (once in the handler and once in the global),
the `HandlerContext` from root to leaf is:

```ts
let once = false;
workflow.handle([startEvent], () => {
  const { sendEvent } = getContext();
  if (once) {
    return;
  }
  once = true;
  sendEvent(messageEvent.with());
});
const { sendEvent } = workflow.createContext();
sendEvent(startEvent.with());
sendEvent(startEvent.with());
sendEvent(messageEvent.with());
```

```
rootHandlerContext(0)
  ├── startEventContext(0)
  │   └── messageEventContext(0)
  ├── startEventContext(1)
  └── messageEventContext(1)
```

You can use any directed graph library to visualize the directed graph of the workflow.

# LICENSE

MIT
