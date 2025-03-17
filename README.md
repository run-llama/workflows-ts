# fluere

fluere 🌊 is a simple, lightweight workflow engine, inspired
by [LlamaIndex Workflow](https://docs.llamaindex.ai/en/stable/module_guides/workflow/)

[![Bundle Size](https://img.shields.io/bundlephobia/min/fluere)](https://bundlephobia.com/result?p=fluere)
[![Bundle Size](https://img.shields.io/bundlephobia/minzip/fluere)](https://bundlephobia.com/result?p=fluere)

- Minimal core API (<=2kb)
- 100% Type safe
- Event-driven execution engine
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

const workflow = createWorkflow({
  startEvent,
  stopEvent,
});

workflow.handle([startEvent], (start) => {
  return convertEvent(Number.parseInt(start.data, 10));
});
workflow.handle([convertEvent], (convert) => {
  return stopEvent(convert.data > 0 ? 1 : -1);
});
```

### Run workflow in multiple JS runtime/framework

#### Node.js/Bun/Deno

```ts
// One shot execution
import { promiseHandler } from "fluere/interrupter/promise";

await promiseHandler(() => workflow.run("100"));
```

### Hono.js

```ts
import { Hono } from "hono";
import { createHonoHandler } from "fluere/interrupter/hono";

const app = new Hono();

app.post(
  "/workflow",
  createHonoHandler(async (ctx) => workflow.run(await ctx.req.text())),
);
```

## Todo list

- [x] minimal API
  - basic logic: `if`, `else if`, `loop` case
- [x] context API
  - [x] `sendEvent`, `requireEvent`
  - [ ] detect cycle dependency
  - [ ] `@fluere/ui` for visualizing workflow
  - ...
- [x] concept API
  - [x] `interrupter/*` for interrupting the workflow
    - [ ] promise
    - [ ] timeout
    - [ ] `next.js`
    - [ ] `hono.js`
    - ...
  - [ ] `middleware/*` for processing the workflow
    - [x] log
    - [x] `zod` schema validation
    - ...
- [x] third party integration
  - [x] hono.js
  - [x] cloudflare worker
    - [ ] `createWorkerHandler` for handling the workflow
    - [ ] bundler plugin for [remote-procedure call](https://developers.cloudflare.com/workers/runtime-apis/rpc/)
    - ...
  - ...

## Why not...

### Event Emitter

Node.js Event Emitter is a great tool for handling events, however:

1. It's hard to maintain the event flow;
   for the typesafety, it's hard to maintain the string name of the event.
   Also, it's hard to control the event flow, like prohibit event `a` calling event `b`.
   In `fluere`, event is checked by object reference, and the event flow is checked by the internal graph algorithm.
2. It's hard to handle the async event, you have to handle the async event by yourself.

   ```ts
   import { EventEmitter } from "node:events";

   const ee = new EventEmitter();
   ee.on("start", (start) => {
     ee.emit("convert:stop"); // <-- how to get the data from `convert:stop` event with correct one?
   });
   ee.once("convert", async (data) => {
     const result = fetch("...").then((res) => res.json()); // <-- async fetch
     ee.emit("convert:stop", result);
   });
   ee.on("stop", (stop) => {});
   ```

### RxJS

It's too heavy, few people can understand the concept of RxJS, and maintaining the RxJS code is hard.

# LICENSE

MIT
